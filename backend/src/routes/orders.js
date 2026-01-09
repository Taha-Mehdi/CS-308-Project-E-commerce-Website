const express = require("express");
const { z } = require("zod");
const { db } = require("../db");
const {
  orders,
  orderItems,
  products,
  users,
  cartItems,
  returnRequests,
} = require("../db/schema");
const { eq, inArray, and, sql } = require("drizzle-orm");

const {
  authMiddleware,
  requireProductManagerOrAdmin,
  requireSalesManager,
} = require("../middleware/auth");

const { sendInvoiceEmail, sendRefundApprovalEmail } = require("../utils/email");
const { buildInvoicePdf } = require("./invoice");

const router = express.Router();

const orderItemInputSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
});

// ✅ UPDATED: include paymentMethod
const orderCreateSchema = z.object({
  items: z.array(orderItemInputSchema).min(1),
  shippingAddress: z.string().min(5).max(500).optional(),
  paymentMethod: z.enum(["credit_card", "account"]).optional(),
});

const statusUpdateSchema = z.object({
  status: z.enum(["processing", "in_transit", "delivered", "cancelled", "refunded"]),
});

function isPrivileged(reqUser) {
  const role = reqUser?.roleName || reqUser?.role || reqUser?.role_name;
  return role === "admin" || role === "product_manager" || role === "sales_manager";
}

function daysBetween(a, b) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return ms / (1000 * 60 * 60 * 24);
}

/**
 * ✅ Helper: compute purchase-time unit price reliably.
 * If a discount campaign exists (originalPrice + discountRate),
 * store the discounted purchase price in order_items.unit_price.
 *
 * This ensures refunds always match the purchase-time price
 * even after the campaign ends.
 */
function computePurchaseUnitPrice(productRow) {
  const price = Number(productRow?.price);
  const originalPrice = Number(productRow?.originalPrice);
  const discountRate = Number(productRow?.discountRate);

  const hasDiscount =
    Number.isFinite(originalPrice) &&
    originalPrice > 0 &&
    Number.isFinite(discountRate) &&
    discountRate > 0;

  if (hasDiscount) {
    const discounted = originalPrice * (1 - discountRate / 100);
    // Guard against negative/NaN
    if (Number.isFinite(discounted) && discounted >= 0) {
      return discounted;
    }
  }

  // Fallback to current product price
  return Number.isFinite(price) ? price : 0;
}

/* =========================================================
   CUSTOMER — REQUEST SELECTIVE RETURN
========================================================= */
const returnRequestSchema = z.object({
  reason: z.string().max(1000).optional(),
});

router.post("/:orderId/items/:orderItemId/return-request", authMiddleware, async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    const orderItemId = Number(req.params.orderItemId);
    if (!Number.isInteger(orderId) || !Number.isInteger(orderItemId)) {
      return res.status(400).json({ message: "Invalid orderId/orderItemId" });
    }

    const parsed = returnRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
    }

    const userId = req.user.id;
    const reason = parsed.data.reason;

    const result = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return { error: { status: 404, message: "Order not found" } };

      if (order.userId !== userId) {
        return { error: { status: 403, message: "Access denied" } };
      }

      const status = String(order.status || "").toLowerCase();
      if (status !== "delivered") {
        return {
          error: {
            status: 409,
            message: 'Return requests are allowed only if the order is "delivered".',
          },
        };
      }

      const createdAt = order.createdAt ? new Date(order.createdAt) : null;
      if (!createdAt || daysBetween(new Date(), createdAt) > 30) {
        return {
          error: {
            status: 409,
            message: "Return requests are allowed only within 30 days of purchase.",
          },
        };
      }

      const [item] = await tx
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.id, orderItemId), eq(orderItems.orderId, orderId)))
        .limit(1);

      if (!item) {
        return { error: { status: 404, message: "Order item not found for this order" } };
      }

      const existing = await tx
        .select()
        .from(returnRequests)
        .where(eq(returnRequests.orderItemId, orderItemId))
        .limit(1);

      if (existing.length > 0) {
        return { error: { status: 409, message: "A return request already exists for this item." } };
      }

      const [inserted] = await tx
        .insert(returnRequests)
        .values({
          orderId,
          orderItemId,
          customerId: userId,
          status: "requested",
          reason: reason || null,
        })
        .returning();

      return { inserted };
    });

    if (result?.error) return res.status(result.error.status).json({ message: result.error.message });

    return res.status(201).json({
      message: "Return request submitted.",
      request: result.inserted,
    });
  } catch (err) {
    console.error("Return request error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   SALES MANAGER — LIST RETURN REQUESTS
========================================================= */
router.get("/returns", authMiddleware, requireSalesManager, async (req, res) => {
  try {
    const rows = await db.select().from(returnRequests);
    return res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error("List return requests error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   CUSTOMER — LIST OWN RETURN REQUESTS
========================================================= */
router.get("/returns/my", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const rows = await db
      .select()
      .from(returnRequests)
      .where(eq(returnRequests.customerId, userId));

    return res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error("Get my return requests error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   SALES MANAGER — APPROVE / REJECT
========================================================= */
const returnDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(1000).optional(),
});

router.patch("/returns/:returnId/decision", authMiddleware, requireSalesManager, async (req, res) => {
  try {
    const returnId = Number(req.params.returnId);
    if (!Number.isInteger(returnId)) return res.status(400).json({ message: "Invalid return id" });

    const parsed = returnDecisionSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
    }

    const { decision, note } = parsed.data;

    const result = await db.transaction(async (tx) => {
      const [rr] = await tx.select().from(returnRequests).where(eq(returnRequests.id, returnId)).limit(1);
      if (!rr) return { error: { status: 404, message: "Return request not found" } };

      if (String(rr.status) !== "requested") {
        return { error: { status: 409, message: "Only requested returns can be decided." } };
      }

      const newStatus = decision === "approve" ? "approved" : "rejected";

      const [updated] = await tx
        .update(returnRequests)
        .set({
          status: newStatus,
          decidedBy: req.user.id,
          decidedAt: new Date(),
          decisionNote: note || null,
        })
        .where(eq(returnRequests.id, returnId))
        .returning();

      return { updated };
    });

    if (result?.error) return res.status(result.error.status).json({ message: result.error.message });

    return res.json({
      message: "Decision saved.",
      request: result.updated,
    });
  } catch (err) {
    console.error("Return decision error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   SALES MANAGER — MARK RECEIVED -> REFUND + RESTOCK + EMAIL
========================================================= */
router.patch("/returns/:returnId/receive", authMiddleware, requireSalesManager, async (req, res) => {
  try {
    const returnId = Number(req.params.returnId);
    if (!Number.isInteger(returnId)) return res.status(400).json({ message: "Invalid return id" });

    const result = await db.transaction(async (tx) => {
      const [rr] = await tx
        .select()
        .from(returnRequests)
        .where(eq(returnRequests.id, returnId))
        .limit(1);

      if (!rr) return { error: { status: 404, message: "Return request not found" } };

      if (String(rr.status) !== "approved") {
        return { error: { status: 409, message: "Only approved returns can be marked received/refunded." } };
      }

      const [order] = await tx.select().from(orders).where(eq(orders.id, rr.orderId)).limit(1);
      if (!order) return { error: { status: 404, message: "Order not found" } };

      const [item] = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.id, rr.orderItemId))
        .limit(1);

      if (!item) return { error: { status: 404, message: "Order item not found" } };

      const [prod] = await tx
        .select()
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);

      if (!prod) return { error: { status: 404, message: "Product not found" } };

      // ✅ Refund uses PURCHASE-TIME unitPrice stored in order_items
      const refundAmount = Number(item.unitPrice || 0) * Number(item.quantity || 0);

      const newStock = Number(prod.stock || 0) + Number(item.quantity || 0);
      await tx.update(products).set({ stock: newStock }).where(eq(products.id, prod.id));

      const refundMethod = String(order.paymentMethod || "credit_card").toLowerCase();

      if (refundMethod === "account") {
        await tx
          .update(users)
          .set({
            accountBalance: sql`${users.accountBalance} + ${refundAmount}`,
          })
          .where(eq(users.id, rr.customerId));
      }

      const [updatedRR] = await tx
        .update(returnRequests)
        .set({
          status: "refunded",
          receivedAt: new Date(),
          refundedAt: new Date(),
          refundAmount: refundAmount.toFixed(2),
          refundMethod,
          refundReference:
            refundMethod === "account" ? "ACCOUNT_CREDIT" : "SIMULATED_CARD_REFUND",
        })
        .where(eq(returnRequests.id, returnId))
        .returning();

      const allItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      const allItemIds = allItems.map((x) => x.id);

      let refundedCount = 0;
      if (allItemIds.length) {
        const relatedReturns = await tx
          .select()
          .from(returnRequests)
          .where(inArray(returnRequests.orderItemId, allItemIds));

        refundedCount = relatedReturns.filter((x) => String(x.status) === "refunded").length;
      }

      if (allItemIds.length > 0 && refundedCount === allItemIds.length) {
        await tx.update(orders).set({ status: "refunded" }).where(eq(orders.id, order.id));
      }

      const [customer] = await tx.select().from(users).where(eq(users.id, rr.customerId)).limit(1);

      return {
        updatedRR,
        customerEmail: customer?.email || null,
        productName: prod?.name || "Item",
        orderId: order.id,
        refundAmount,
        refundMethod,
      };
    });

    if (result?.error) return res.status(result.error.status).json({ message: result.error.message });

    try {
      if (result.customerEmail) {
        await sendRefundApprovalEmail(result.customerEmail, {
          orderId: result.orderId,
          productName: result.productName,
          refundAmount: result.refundAmount,
          refundMethod: result.refundMethod,
        });
      }
    } catch (emailErr) {
      console.error("Failed to send refund approval email:", emailErr);
    }

    return res.json({
      message: "Return received. Refund processed and stock updated.",
      request: result.updatedRR,
      refundedAmount: Number(result.refundAmount || 0).toFixed(2),
      refundedTo: result.refundMethod || "credit_card",
    });
  } catch (err) {
    console.error("Return receive/refund error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   ✅ POST /orders  (UPDATED for paymentMethod + discounted purchase price)
========================================================= */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const parsed = orderCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
    }

    const { items, shippingAddress } = parsed.data;
    const paymentMethod = (parsed.data.paymentMethod || "credit_card").toLowerCase();

    const userId = req.user.id;

    const result = await db.transaction(async (tx) => {
      const productIds = [...new Set(items.map((i) => i.productId))];

      const dbProducts = await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIds));

      if (dbProducts.length !== productIds.length) {
        throw new Error("One or more products not found");
      }

      const productMap = new Map();
      dbProducts.forEach((p) => productMap.set(p.id, p));

      let total = 0;

      // ✅ Compute totals using purchase-time effective price
      for (const item of items) {
        const p = productMap.get(item.productId);
        if (!p || !p.isActive) throw new Error(`Product ${item.productId} is not available`);
        if (p.stock < item.quantity) throw new Error(`Not enough stock for product ${p.name}`);

        const unitPriceNumber = computePurchaseUnitPrice(p);
        total += unitPriceNumber * item.quantity;
      }

      const userRows = await tx.select().from(users).where(eq(users.id, userId));
      const userInfo = userRows[0];

      const finalShippingAddress = shippingAddress || userInfo?.address || "";

      // ✅ If paying by account balance: enforce + deduct
      if (paymentMethod === "account") {
        const bal = Number(userInfo?.accountBalance || 0);
        if (bal < total) {
          return { error: { status: 409, message: "Insufficient account balance." } };
        }

        await tx
          .update(users)
          .set({
            accountBalance: sql`${users.accountBalance} - ${total}`,
          })
          .where(eq(users.id, userId));
      }

      const insertedOrders = await tx
        .insert(orders)
        .values({
          userId,
          status: "processing",
          total: total.toFixed(2),
          shippingAddress: finalShippingAddress,
          paymentMethod: paymentMethod === "account" ? "account" : "credit_card",
        })
        .returning();

      const order = insertedOrders[0];

      // ✅ Store PURCHASE-TIME unitPrice (discounted if campaign applied)
      const orderItemsToInsert = items.map((item) => {
        const p = productMap.get(item.productId);
        const unitPriceNumber = computePurchaseUnitPrice(p);
        return {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: unitPriceNumber.toFixed(2),
        };
      });

      await tx.insert(orderItems).values(orderItemsToInsert);
      
      // changed
      for (const item of items) {
        const updated = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${item.quantity}` })
          .where(
            and(
              eq(products.id, item.productId),
              eq(products.isActive, true),
              sql`${products.stock} >= ${item.quantity}`
            )
          )
          .returning({ id: products.id });

        if (updated.length === 0) {
          throw new Error(`Not enough stock for product ${item.productId}`);
        }
      }


      await tx.delete(cartItems).where(eq(cartItems.userId, userId));

      return { order, orderItemsToInsert, userInfo };
    });

    if (result?.error) return res.status(result.error.status).json({ message: result.error.message });

    const { order, orderItemsToInsert, userInfo } = result;

    try {
      const pdfBuffer = await buildInvoicePdf(order, userInfo, orderItemsToInsert);
      await sendInvoiceEmail(userInfo.email, pdfBuffer, order.id);
    } catch (emailErr) {
      console.error("Failed to send invoice email:", emailErr);
    }

    return res.status(201).json({
      message: "Order created",
      orderId: order.id,
      total: order.total,
      status: order.status,
      paymentMethod: order.paymentMethod,
    });
  } catch (err) {
    console.error("Create order error:", err);
    const msg = err?.message || "Server error";
    if (
      msg.startsWith("One or more products not found") ||
      msg.startsWith("Product ") ||
      msg.startsWith("Not enough stock")
    ) {
      return res.status(400).json({ message: msg });
    }
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   GET /orders/my
========================================================= */
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const userOrders = await db.select().from(orders).where(eq(orders.userId, userId));

    if (userOrders.length === 0) {
      return res.json({ orders: [], items: [] });
    }

    const orderIds = userOrders.map((o) => o.id);

    const items = await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    return res.json({
      orders: userOrders,
      items,
    });
  } catch (err) {
    console.error("Get my orders error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   ✅ CUSTOMER: CANCEL ORDER
========================================================= */
router.post("/:id/cancel", authMiddleware, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId)) return res.status(400).json({ message: "Invalid order id" });

    const userId = req.user.id;

    const result = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return { error: { status: 404, message: "Order not found" } };

      if (order.userId !== userId && !isPrivileged(req.user)) {
        return { error: { status: 403, message: "Access denied" } };
      }

      const status = String(order.status || "").toLowerCase();
      if (status !== "processing") {
        return { error: { status: 409, message: 'Order can only be cancelled if it is in "processing" status.' } };
      }

      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));

      for (const it of items) {
        const [p] = await tx
          .select({ id: products.id, stock: products.stock })
          .from(products)
          .where(eq(products.id, it.productId))
          .limit(1);

        if (p) {
          const newStock = Number(p.stock || 0) + Number(it.quantity || 0);
          await tx.update(products).set({ stock: newStock }).where(eq(products.id, it.productId));
        }
      }

      const [updated] = await tx
        .update(orders)
        .set({ status: "cancelled" })
        .where(eq(orders.id, orderId))
        .returning();

      return { updated };
    });

    if (result?.error) return res.status(result.error.status).json({ message: result.error.message });

    return res.json({
      message: "Order cancelled.",
      order: result.updated,
    });
  } catch (err) {
    console.error("Cancel order error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   NOTE: Existing full-order /refund endpoint kept for backward compatibility
========================================================= */
async function refundOrReturnHandler(req, res) {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId)) return res.status(400).json({ message: "Invalid order id" });

    const userId = req.user.id;

    const result = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return { error: { status: 404, message: "Order not found" } };

      if (order.userId !== userId && !isPrivileged(req.user)) {
        return { error: { status: 403, message: "Access denied" } };
      }

      const status = String(order.status || "").toLowerCase();
      if (status !== "delivered") {
        return { error: { status: 409, message: 'Order can only be refunded/returned if it is in "delivered" status.' } };
      }

      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));

      for (const it of items) {
        const [p] = await tx
          .select({ id: products.id, stock: products.stock })
          .from(products)
          .where(eq(products.id, it.productId))
          .limit(1);

        if (p) {
          const newStock = Number(p.stock || 0) + Number(it.quantity || 0);
          await tx.update(products).set({ stock: newStock }).where(eq(products.id, it.productId));
        }
      }

      const [updated] = await tx
        .update(orders)
        .set({ status: "refunded" })
        .where(eq(orders.id, orderId))
        .returning();

      return { updated };
    });

    if (result?.error) return res.status(result.error.status).json({ message: result.error.message });

    return res.json({
      message: "Order refunded.",
      order: result.updated,
    });
  } catch (err) {
    console.error("Refund/return order error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

router.post("/:id/refund", authMiddleware, refundOrReturnHandler);
router.post("/:id/return", authMiddleware, refundOrReturnHandler);

// --------------------------------------------------------
// ADMIN / PRODUCT MANAGER ROUTES
// --------------------------------------------------------

router.get("/", authMiddleware, requireProductManagerOrAdmin, async (req, res) => {
  try {
    const allOrders = await db.select().from(orders);
    res.json(allOrders);
  } catch (err) {
    console.error("Admin list orders error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", authMiddleware, requireProductManagerOrAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    const foundOrders = await db.select().from(orders).where(eq(orders.id, orderId));
    if (foundOrders.length === 0) return res.status(404).json({ message: "Order not found" });

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

    return res.json({
      order: foundOrders[0],
      items,
    });
  } catch (err) {
    console.error("Admin get order error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/status", authMiddleware, requireProductManagerOrAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const parsed = statusUpdateSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid status", errors: parsed.error.flatten() });
    }

    const { status } = parsed.data;

    const updated = await db.update(orders).set({ status }).where(eq(orders.id, orderId)).returning();
    if (updated.length === 0) return res.status(404).json({ message: "Order not found" });

    return res.json({
      message: "Order status updated",
      order: updated[0],
    });
  } catch (err) {
    console.error("Admin update order status error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

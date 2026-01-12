const express = require("express");
const { z } = require("zod");
const { db } = require("../db");
const {
    orders,
    orderItems,
    products,
    returnRequests,
    users,
} = require("../db/schema");
const { and, eq, gt, sql } = require("drizzle-orm");
const {
    authMiddleware,
    requireSalesManager,
} = require("../middleware/auth");
const { sendRefundApprovalEmail } = require("../utils/email"); //

const router = express.Router();

/* =========================
   CUSTOMER: REQUEST RETURN
========================= */
router.post(
    "/",
    authMiddleware,
    async (req, res) => {
        const schema = z.object({
            orderId: z.number(),
            orderItemId: z.number(),
            reason: z.string().optional(),
        });

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: "Invalid input" });
        }

        const { orderId, orderItemId, reason } = parsed.data;

        try {
            const order = await db.query.orders.findFirst({
                where: and(
                    eq(orders.id, orderId),
                    eq(orders.userId, req.user.id)
                ),
            });

            if (!order) {
                return res.status(404).json({ message: "Order not found" });
            }

            if (order.status !== "delivered") {
                return res.status(400).json({ message: "Order not delivered yet" });
            }

            const daysSincePurchase =
                (Date.now() - new Date(order.createdAt).getTime()) /
                (1000 * 60 * 60 * 24);

            if (daysSincePurchase > 30) {
                return res.status(400).json({ message: "Return window expired" });
            }

            const item = await db.query.orderItems.findFirst({
                where: and(
                    eq(orderItems.id, orderItemId),
                    eq(orderItems.orderId, orderId)
                ),
            });

            if (!item) {
                return res.status(404).json({ message: "Order item not found" });
            }

            const [created] = await db
                .insert(returnRequests)
                .values({
                    orderId,
                    orderItemId,
                    customerId: req.user.id,
                    reason,
                    refundAmount: item.price,
                })
                .returning();

            res.status(201).json(created);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

/* =========================
   SALES MANAGER: LIST
========================= */
router.get(
    "/",
    authMiddleware,
    requireSalesManager,
    async (_, res) => {
        const returns = await db.query.returnRequests.findMany({
            orderBy: (r, { desc }) => [desc(r.requestedAt)],
        });
        res.json(returns);
    }
);

/* =========================
   SALES MANAGER: APPROVE / REJECT
========================= */
router.patch(
    "/:id/decision",
    authMiddleware,
    requireSalesManager,
    async (req, res) => {
        const { decision, note } = req.body;

        if (!["approved", "rejected"].includes(decision)) {
            return res.status(400).json({ message: "Invalid decision" });
        }

        const [updated] = await db
            .update(returnRequests)
            .set({
                status: decision,
                decidedAt: new Date(),
                decidedBy: req.user.id,
                decisionNote: note,
            })
            .where(eq(returnRequests.id, Number(req.params.id)))
            .returning();

        if (!updated) {
            return res.status(404).json({ message: "Return request not found" });
        }

        res.json(updated);
    }
);

/* =========================
   SALES MANAGER: MARK RECEIVED
========================= */
router.patch(
    "/:id/received",
    authMiddleware,
    requireSalesManager,
    async (req, res) => {
        const [updated] = await db
            .update(returnRequests)
            .set({
                status: "received",
                receivedAt: new Date(),
            })
            .where(eq(returnRequests.id, Number(req.params.id)))
            .returning();

        res.json(updated);
    }
);

/* =========================
   SALES MANAGER: REFUND + RESTOCK
========================= */
router.patch(
    "/:id/refund",
    authMiddleware,
    requireSalesManager,
    async (req, res) => {
        try {
            // Perform DB updates in a transaction and gather email data
            const emailData = await db.transaction(async (tx) => {
                const ret = await tx.query.returnRequests.findFirst({
                    where: eq(returnRequests.id, Number(req.params.id)),
                });

                if (!ret || ret.status !== "received") {
                    throw new Error("Return not eligible for refund (must be 'received')");
                }

                const item = await tx.query.orderItems.findFirst({
                    where: eq(orderItems.id, ret.orderItemId),
                });

                // Fetch product details for the email
                const product = await tx.query.products.findFirst({
                    where: eq(products.id, item.productId),
                });

                // Fetch customer details for the email
                const customer = await tx.query.users.findFirst({
                    where: eq(users.id, ret.customerId),
                });

                // 1. Restock product
                await tx
                    .update(products)
                    .set({ stock: sql`${products.stock} + 1` })
                    .where(eq(products.id, item.productId));

                // 2. Refund to user balance
                await tx
                    .update(users)
                    .set({ accountBalance: sql`${users.accountBalance} + ${ret.refundAmount}` })
                    .where(eq(users.id, ret.customerId));

                // 3. Mark request as refunded
                await tx
                    .update(returnRequests)
                    .set({
                        status: "refunded",
                        refundedAt: new Date(),
                        refundMethod: "account",
                    })
                    .where(eq(returnRequests.id, ret.id));

                // Return data needed for the email
                return {
                    email: customer.email,
                    orderId: ret.orderId,
                    productName: product ? product.name : "Product",
                    refundAmount: ret.refundAmount,
                };
            });

            // Send email notification (outside transaction)
            if (emailData) {
                await sendRefundApprovalEmail(emailData.email, {
                    orderId: emailData.orderId,
                    productName: emailData.productName,
                    refundAmount: emailData.refundAmount,
                    refundMethod: "account",
                });
            }

            res.json({ message: "Refund processed and email sent" });
        } catch (err) {
            console.error("Refund error:", err);
            res.status(400).json({ message: err.message || "Server error" });
        }
    }
);

module.exports = router;
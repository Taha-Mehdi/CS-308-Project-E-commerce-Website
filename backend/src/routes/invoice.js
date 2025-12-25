const express = require("express");
const PDFDocument = require("pdfkit");
const { db } = require("../db");
const { orders, orderItems, users, roles } = require("../db/schema");
const { eq, and, gte, lte, desc, inArray } = require("drizzle-orm");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

function buildInvoicePdf(order, userInfo, items) {
  const doc = new PDFDocument({ margin: 50 });
  const chunks = [];

  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("error", (err) => {
    console.error("PDF error:", err);
  });

  // Header
  doc.fontSize(22).text("INVOICE", { align: "center" });
  doc.moveDown(1.5);

  const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString() : "";

  // Order info
  doc.fontSize(12).text(`Order ID: ${order.id}`);
  doc.text(`Status: ${order.status}`);
  if (createdAt) doc.text(`Date: ${createdAt}`);
  doc.moveDown();

  // Customer info
  doc.text(`Customer: ${userInfo.fullName}`);
  doc.text(`Email: ${userInfo.email}`);
  doc.moveDown(1.5);

  // Items header
  doc.fontSize(14).text("Items", { underline: true });
  doc.moveDown(0.5);

  items.forEach((item) => {
    const unitPriceNum = Number(item.unitPrice || 0);
    const quantityNum = Number(item.quantity || 0);
    const subtotal = unitPriceNum * quantityNum;

    doc.fontSize(12).text(`Product #${item.productId}`);
    doc.text(`Quantity: ${quantityNum}`);
    doc.text(`Unit Price: $${unitPriceNum.toFixed(2)}`);
    doc.text(`Subtotal: $${subtotal.toFixed(2)}`);
    doc.moveDown();
  });

  // Total
  const totalNum = Number(order.total || 0);
  doc.moveDown(0.5);
  doc.fontSize(14).text(`Total: $${totalNum.toFixed(2)}`, { align: "right" });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.once("error", reject);
    doc.once("end", () => resolve(Buffer.concat(chunks)));
  });
}

// Helper: parse YYYY-MM-DD into a Date
function parseDateParam(raw) {
  if (!raw || typeof raw !== "string") return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function getRoleNameById(roleId) {
  const rid = Number(roleId);
  if (!Number.isInteger(rid)) return null;
  const roleRows = await db.select().from(roles).where(eq(roles.id, rid));
  return roleRows.length ? roleRows[0].name : null;
}

function isPrivilegedRole(roleName) {
  return roleName === "admin" || roleName === "sales_manager";
}

// GET /invoice?from=YYYY-MM-DD&to=YYYY-MM-DD
// List invoices (orders) in date range (sales_manager/admin)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const roleName = await getRoleNameById(req.user.roleId);
    if (!isPrivilegedRole(roleName)) {
      return res
        .status(403)
        .json({ message: "Sales manager or admin access required" });
    }

    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);

    if (!from || !to) {
      return res.status(400).json({
        message: "from and to are required. Use format YYYY-MM-DD",
      });
    }

    // Make "to" inclusive to the end of that day
    const toInclusive = new Date(to);
    toInclusive.setHours(23, 59, 59, 999);

    const rows = await db
      .select()
      .from(orders)
      .where(and(gte(orders.createdAt, from), lte(orders.createdAt, toInclusive)))
      .orderBy(desc(orders.createdAt));

    const userIds = [...new Set(rows.map((o) => o.userId))];

    let usersById = new Map();
    if (userIds.length > 0) {
      const userRows = await db.select().from(users).where(inArray(users.id, userIds));
      usersById = new Map(userRows.map((u) => [u.id, u]));
    }

    const invoices = rows.map((o) => {
      const u = usersById.get(o.userId);
      return {
        orderId: o.id,
        createdAt: o.createdAt,
        status: o.status,
        total: o.total,
        shippingAddress: o.shippingAddress,
        customer: u
          ? { id: u.id, fullName: u.fullName, email: u.email }
          : { id: o.userId, fullName: null, email: null },
        pdfUrl: `/invoice/${o.id}`,
      };
    });

    return res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      count: invoices.length,
      invoices,
    });
  } catch (err) {
    console.error("GET /invoice (range) error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /invoice/:orderId  (admin OR sales_manager OR owner of order)
// returns PDF buffer
router.get("/:orderId", authMiddleware, async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    const userId = req.user.id;

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const foundOrders = await db.select().from(orders).where(eq(orders.id, orderId));
    if (foundOrders.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }
    const order = foundOrders[0];

    const roleName = await getRoleNameById(req.user.roleId);
    const privileged = isPrivilegedRole(roleName);

    if (!privileged && order.userId !== userId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const userInfoArr = await db.select().from(users).where(eq(users.id, order.userId));
    const userInfo = userInfoArr[0];
    if (!userInfo) {
      return res.status(500).json({ message: "User not found for order" });
    }

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

    const pdfBuffer = await buildInvoicePdf(order, userInfo, items);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=invoice_${orderId}.pdf`);

    return res.send(pdfBuffer);
  } catch (err) {
    console.error("Invoice PDF error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = {
  router,
  buildInvoicePdf,
};

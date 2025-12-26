const express = require("express");
const PDFDocument = require("pdfkit");
const { db } = require("../db");
const { orders, orderItems, users } = require("../db/schema");
const { eq, and, gte, lte, desc, inArray } = require("drizzle-orm");
const { authMiddleware, requireSalesManager } = require("../middleware/auth");

const router = express.Router();

function buildInvoicePdf(order, userInfo, items) {
  const doc = new PDFDocument({ margin: 50 });
  const chunks = [];

  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("error", (err) => console.error("PDF error:", err));

  doc.fontSize(22).text("INVOICE", { align: "center" });
  doc.moveDown(1.5);

  const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString() : "";

  doc.fontSize(12).text(`Order ID: ${order.id}`);
  doc.text(`Status: ${order.status}`);
  if (createdAt) doc.text(`Date: ${createdAt}`);
  doc.moveDown();

  doc.text(`Customer: ${userInfo.fullName}`);
  doc.text(`Email: ${userInfo.email}`);
  doc.moveDown(1.5);

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

  const totalNum = Number(order.total || 0);
  doc.moveDown(0.5);
  doc.fontSize(14).text(`Total: $${totalNum.toFixed(2)}`, { align: "right" });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.once("error", reject);
    doc.once("end", () => resolve(Buffer.concat(chunks)));
  });
}

function parseDateParam(raw) {
  if (!raw || typeof raw !== "string") return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// GET /invoice (range) - Sales Manager Only
router.get("/", authMiddleware, requireSalesManager, async (req, res) => {
  try {
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);

    if (!from || !to) {
      return res.status(400).json({ message: "from/to required (YYYY-MM-DD)" });
    }

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
        customer: u ? { id: u.id, fullName: u.fullName } : { id: o.userId },
        pdfUrl: `/invoice/${o.id}`,
      };
    });

    return res.json({ from, to, count: invoices.length, invoices });
  } catch (err) {
    console.error("GET /invoice error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /invoice/:orderId - PDF Download
router.get("/:orderId", authMiddleware, async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    const userId = req.user.id;

    if (!Number.isInteger(orderId)) return res.status(400).json({ message: "Invalid ID" });

    const foundOrders = await db.select().from(orders).where(eq(orders.id, orderId));
    if (foundOrders.length === 0) return res.status(404).json({ message: "Order not found" });

    const order = foundOrders[0];
    const roleName = req.user.roleName || "";

    // ✅ PERMISSION CHECK:
    const isStaff = ["admin", "sales_manager", "product_manager"].includes(roleName);

    if (!isStaff && order.userId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const userInfoArr = await db.select().from(users).where(eq(users.id, order.userId));
    const userInfo = userInfoArr[0] || { fullName: "Unknown", email: "N/A" };

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

module.exports = router;
module.exports.buildInvoicePdf = buildInvoicePdf;
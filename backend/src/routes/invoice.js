const express = require('express');
const PDFDocument = require('pdfkit');
const { db } = require('../db');
const { orders, orderItems, users } = require('../db/schema');
const { eq } = require('drizzle-orm');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function buildInvoicePdf(order, userInfo, items) {
  const doc = new PDFDocument({ margin: 50 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('error', (err) => {
    console.error('PDF error:', err);
  });

  // Header
  doc.fontSize(22).text('INVOICE', { align: 'center' });
  doc.moveDown(1.5);

  const createdAt = order.createdAt
    ? new Date(order.createdAt).toLocaleString()
    : '';

  // Order info
  doc.fontSize(12).text(`Order ID: ${order.id}`);
  doc.text(`Status: ${order.status}`);
  if (createdAt) {
    doc.text(`Date: ${createdAt}`);
  }
  doc.moveDown();

  // Customer info
  doc.text(`Customer: ${userInfo.fullName}`);
  doc.text(`Email: ${userInfo.email}`);
  doc.moveDown(1.5);

  // Items header
  doc.fontSize(14).text('Items', { underline: true });
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
  doc
    .fontSize(14)
    .text(`Total: $${totalNum.toFixed(2)}`, { align: 'right' });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.once('error', reject);
    doc.once('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      resolve(pdfBuffer);
    });
  });
}

// GET /invoice/:orderId (admin only OR owner of order)
router.get('/:orderId', authMiddleware, async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    const userId = req.user.id;
    const roleId = req.user.roleId;

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ message: 'Invalid order id' });
    }

    // Load order
    const foundOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));

    if (foundOrders.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = foundOrders[0];

    // Only admin OR the user who owns the order can download invoice
    if (roleId !== 1 && order.userId !== userId) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    // Load user info
    const userInfoArr = await db
      .select()
      .from(users)
      .where(eq(users.id, order.userId));

    const userInfo = userInfoArr[0];
    if (!userInfo) {
      return res.status(500).json({ message: 'User not found for order' });
    }

    // Load order items
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Build PDF and send as response
    const pdfBuffer = await buildInvoicePdf(order, userInfo, items);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice_${orderId}.pdf`
    );

    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Invoice error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = {
  router,
  buildInvoicePdf,
};

const express = require('express');
const PDFDocument = require('pdfkit');
const { db } = require('../db');
const { orders, orderItems, products, users } = require('../db/schema');
const { eq } = require('drizzle-orm');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const path = require('path');

const router = express.Router();

function buildInvoicePdf(order, userInfo, items) {
  const doc = new PDFDocument();
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('error', (err) => {
    console.error('PDF error:', err);
  });

  // title
  doc.fontSize(22).text('INVOICE', { align: 'center' });
  doc.moveDown();

  // order info
  doc.fontSize(12);
  doc.text(`Order ID: ${order.id}`);
  doc.text(`Status: ${order.status}`);
  doc.text(`Date: ${order.createdAt}`);
  doc.moveDown();

  // user info
  doc.text(`Customer: ${userInfo.fullName}`);
  doc.text(`Email: ${userInfo.email}`);
  doc.moveDown();

  // items
  doc.fontSize(14).text('Items:', { underline: true });
  doc.moveDown(0.5);

  for (const item of items) {
    doc.fontSize(12).text(`Product #${item.productId}`);
    doc.text(`Quantity: ${item.quantity}`);
    doc.text(`Unit Price: $${item.unitPrice}`);
    const subtotal = Number(item.unitPrice) * item.quantity;
    doc.text(`Subtotal: $${subtotal.toFixed(2)}`);
    doc.moveDown();
  }

  // total
  doc.fontSize(14).text(`Total: $${order.total}`, { align: 'right' });

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => {
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

    // Load user
    const userInfoArr = await db
        .select()
        .from(users)
        .where(eq(users.id, order.userId));

    const userInfo = userInfoArr[0];

    // Load order items
    const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

    // build pdf and send as response
    const pdfBuffer = await buildInvoicePdf(order, userInfo, items);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        `attachment; filename=invoice_${orderId}.pdf`
    );

    res.send(pdfBuffer);
  } catch (err) {
    console.error('Invoice error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

const express = require('express');
const PDFDocument = require('pdfkit');
const { db } = require('../db');
const { orders, orderItems, products, users } = require('../db/schema');
const { eq } = require('drizzle-orm');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const path = require('path');

const router = express.Router();

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

    // Start PDF
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice_${orderId}.pdf`
    );

    doc.pipe(res);

    // Title
    doc.fontSize(22).text('INVOICE', { align: 'center' });
    doc.moveDown();

    // Order Info
    doc.fontSize(12);
    doc.text(`Order ID: ${order.id}`);
    doc.text(`Status: ${order.status}`);
    doc.text(`Date: ${order.createdAt}`);
    doc.moveDown();

    // User Info
    doc.text(`Customer: ${userInfo.fullName}`);
    doc.text(`Email: ${userInfo.email}`);
    doc.moveDown();

    // Items header
    doc.fontSize(14).text('Items:', { underline: true });
    doc.moveDown(0.5);

    // Items list
    for (const item of items) {
      doc.fontSize(12).text(`Product #${item.productId}`);
      doc.text(`Quantity: ${item.quantity}`);
      doc.text(`Unit Price: $${item.unitPrice}`);
      const subtotal = Number(item.unitPrice) * item.quantity;
      doc.text(`Subtotal: $${subtotal.toFixed(2)}`);
      doc.moveDown();
    }

    // Total
    doc.fontSize(14).text(`Total: $${order.total}`, { align: 'right' });

    doc.end();
  } catch (err) {
    console.error('Invoice error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

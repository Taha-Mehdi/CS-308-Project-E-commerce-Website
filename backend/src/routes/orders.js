const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const { orders, orderItems, products } = require('../db/schema');
const { eq, inArray } = require('drizzle-orm');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Zod schema for order creation
const orderItemInputSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
});

const orderCreateSchema = z.object({
  items: z.array(orderItemInputSchema).min(1),
});

// Allowed statuses
const statusUpdateSchema = z.object({
  status: z.enum(['pending', 'paid', 'shipped', 'delivered', 'cancelled']),
});

// POST /orders - create a new order for the logged-in user
router.post('/', authMiddleware, async (req, res) => {
  try {
    const parsed = orderCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid data', errors: parsed.error.flatten() });
    }

    const { items } = parsed.data;
    const userId = req.user.id;

    const productIds = [...new Set(items.map((i) => i.productId))];

    const dbProducts = await db
      .select()
      .from(products)
      .where(inArray(products.id, productIds));

    if (dbProducts.length !== productIds.length) {
      return res
        .status(400)
        .json({ message: 'One or more products not found' });
    }

    const productMap = new Map();
    dbProducts.forEach((p) => productMap.set(p.id, p));

    let total = 0;

    for (const item of items) {
      const p = productMap.get(item.productId);
      if (!p || !p.isActive) {
        return res
          .status(400)
          .json({ message: `Product ${item.productId} is not available` });
      }

      if (p.stock < item.quantity) {
        return res
          .status(400)
          .json({ message: `Not enough stock for product ${p.name}` });
      }

      const priceNumber = Number(p.price);
      total += priceNumber * item.quantity;
    }

    const insertedOrders = await db
      .insert(orders)
      .values({
        userId,
        status: 'pending',
        total: total.toFixed(2),
      })
      .returning();

    const order = insertedOrders[0];

    const orderItemsToInsert = items.map((item) => {
      const p = productMap.get(item.productId);
      return {
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: p.price,
      };
    });

    await db.insert(orderItems).values(orderItemsToInsert);

    for (const item of items) {
      const p = productMap.get(item.productId);
      const newStock = p.stock - item.quantity;
      await db
        .update(products)
        .set({ stock: newStock })
        .where(eq(products.id, item.productId));
    }

    return res.status(201).json({
      message: 'Order created',
      orderId: order.id,
      total: order.total,
    });
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /orders/my - get current user's orders
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId));

    if (userOrders.length === 0) {
      return res.json([]);
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
    console.error('Get my orders error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ----------------------
// ADMIN ROUTES BELOW
// ----------------------

// GET /orders - list ALL orders (admin only)
router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const allOrders = await db.select().from(orders);
    res.json(allOrders);
  } catch (err) {
    console.error('Admin list orders error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /orders/:id - get a single order + its items (admin only)
router.get('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    const foundOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));

    if (foundOrders.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    return res.json({
      order: foundOrders[0],
      items,
    });
  } catch (err) {
    console.error('Admin get order error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /orders/:id/status - update order status (admin only)
router.patch('/:id/status', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const parsed = statusUpdateSchema.safeParse(req.body);

    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid status', errors: parsed.error.flatten() });
    }

    const { status } = parsed.data;

    const updated = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, orderId))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.json({
      message: 'Order status updated',
      order: updated[0],
    });
  } catch (err) {
    console.error('Admin update order status error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

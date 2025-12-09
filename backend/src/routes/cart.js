const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const { cartItems, products } = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Coerce incoming values to numbers so JSON "1" also works.
const addToCartSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().default(1),
});

// POST /cart/add
router.post('/add', authMiddleware, async (req, res) => {
  const parsed = addToCartSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data' });
  }

  const { productId, quantity } = parsed.data;
  const userId = req.user.id;

  // Check product exists
  const productRows = await db
    .select()
    .from(products)
    .where(eq(products.id, productId));

  if (productRows.length === 0) {
    return res.status(404).json({ message: 'Product not found' });
  }

  const product = productRows[0];

  // Requirement 7: out-of-stock must not be addable to cart
  if (product.stock <= 0) {
    return res
      .status(400)
      .json({ message: 'This product is out of stock and cannot be added to the cart.' });
  }

  // Check if already in cart
  const existing = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)));

  if (existing.length > 0) {
    const currentQty = existing[0].quantity;
    const newQty = currentQty + quantity;

    if (newQty > product.stock) {
      return res.status(400).json({
        message: `Only ${product.stock} unit(s) available for ${product.name}.`,
      });
    }

    const updated = await db
      .update(cartItems)
      .set({
        quantity: newQty,
      })
      .where(eq(cartItems.id, existing[0].id))
      .returning();

    return res.json({
      message: 'Cart updated',
      item: updated[0],
    });
  }

  // Insert new cart item
  if (quantity > product.stock) {
    return res.status(400).json({
      message: `Only ${product.stock} unit(s) available for ${product.name}.`,
    });
  }

  const inserted = await db
    .insert(cartItems)
    .values({
      userId,
      productId,
      quantity,
    })
    .returning();

  return res.status(201).json({
    message: 'Added to cart',
    item: inserted[0],
  });
});

// GET /cart
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  const items = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.userId, userId));

  return res.json(items);
});

// PUT /cart/update
router.put('/update', authMiddleware, async (req, res) => {
  const parsed = addToCartSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid data' });
  }

  const { productId, quantity } = parsed.data;
  const userId = req.user.id;

  // If quantity is 0 or below, just remove the item
  if (quantity <= 0) {
    const deleted = await db
      .delete(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    return res.json({
      message: 'Item removed from cart',
      item: deleted[0],
    });
  }

  // Check product stock before updating
  const productRows = await db
    .select()
    .from(products)
    .where(eq(products.id, productId));

  if (productRows.length === 0) {
    return res.status(404).json({ message: 'Product not found' });
  }

  const product = productRows[0];

  if (product.stock <= 0) {
    return res
      .status(400)
      .json({ message: 'This product is out of stock and cannot be added to the cart.' });
  }

  if (quantity > product.stock) {
    return res.status(400).json({
      message: `Only ${product.stock} unit(s) available for ${product.name}.`,
    });
  }

  const updated = await db
    .update(cartItems)
    .set({ quantity })
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
    .returning();

  if (updated.length === 0) {
    return res.status(404).json({ message: 'Item not found in cart' });
  }

  return res.json({
    message: 'Cart item updated',
    item: updated[0],
  });
});

// DELETE /cart/remove/:productId
router.delete('/remove/:productId', authMiddleware, async (req, res) => {
  const productId = Number(req.params.productId);
  const userId = req.user.id;

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: 'Invalid product id' });
  }

  const deleted = await db
    .delete(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
    .returning();

  if (deleted.length === 0) {
    return res.status(404).json({ message: 'Item not found' });
  }

  return res.json({
    message: 'Item removed',
    item: deleted[0],
  });
});

module.exports = router;

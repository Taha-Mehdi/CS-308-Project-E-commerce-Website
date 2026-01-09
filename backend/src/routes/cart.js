const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const { cartItems, products } = require('../db/schema');
const { eq, and, sql } = require('drizzle-orm'); // <--- Ensure 'sql' is imported
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

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

  try {
    // 1. Get Product (Check Existence & Stock)
    const productRows = await db
        .select()
        .from(products)
        .where(eq(products.id, productId));

    if (productRows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const product = productRows[0];
    // added
    if (!product.isActive) {
      return res.status(400).json({ message: "Product is not available." });
    }


    if (product.stock <= 0) {
      return res.status(400).json({ message: 'Product out of stock.' });
    }

    // 2. ATOMIC UPSERT (The Permanent Fix)
    // This allows the database to handle the merge logic safely.
    const result = await db
        .insert(cartItems)
        .values({
          userId,
          productId,
          quantity,
        })
        .onConflictDoUpdate({
          target: [cartItems.userId, cartItems.productId], // Uses your Unique Index
          set: {
            // Logic: New Quantity = Old Quantity + Added Quantity
            quantity: sql`${cartItems.quantity} + ${quantity}`
          }
        })
        .returning();

    // 3. Stock Cap Logic
    // If the math pushed us over the limit, cap it at max stock.
    const finalItem = result[0];

    if (finalItem.quantity > product.stock) {
      await db.update(cartItems)
          .set({ quantity: product.stock })
          .where(eq(cartItems.id, finalItem.id));

      finalItem.quantity = product.stock;
    }

    return res.status(200).json({
      message: 'Cart updated',
      item: finalItem,
    });

  } catch (err) {
    console.error("Cart Add Error:", err);
    res.status(500).json({ message: 'Cart update failed' });
  }
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
  if (!parsed.success) return res.status(400).json({ message: 'Invalid data' });

  const { productId, quantity } = parsed.data;
  const userId = req.user.id;

  if (quantity <= 0) {
    const deleted = await db
        .delete(cartItems)
        .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
        .returning();
    if (deleted.length === 0) return res.status(404).json({ message: 'Item not found in cart' });
    return res.json({ message: 'Item removed from cart', item: deleted[0] });
  }

  const productRows = await db.select().from(products).where(eq(products.id, productId));
  if (productRows.length === 0) return res.status(404).json({ message: 'Product not found' });

  const product = productRows[0];
  // added 
  if (!product.isActive) {
    return res.status(400).json({ message: "Product is not available." });
  }


  if (product.stock <= 0) return res.status(400).json({ message: 'Product is out of stock.' });
  if (quantity > product.stock) return res.status(400).json({ message: `Only ${product.stock} unit(s) available.` });

  const updated = await db
      .update(cartItems)
      .set({ quantity })
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
      .returning();

  if (updated.length === 0) return res.status(404).json({ message: 'Item not found in cart' });
  return res.json({ message: 'Cart item updated', item: updated[0] });
});

// DELETE /cart/remove/:productId
router.delete('/remove/:productId', authMiddleware, async (req, res) => {
  const productId = Number(req.params.productId);
  const userId = req.user.id;

  if (!Number.isInteger(productId) || productId <= 0) return res.status(400).json({ message: 'Invalid product id' });

  const deleted = await db
      .delete(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
      .returning();

  if (deleted.length === 0) return res.status(404).json({ message: 'Item not found' });
  return res.json({ message: 'Item removed', item: deleted[0] });
});

module.exports = router;
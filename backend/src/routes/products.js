const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const { products } = require('../db/schema');
const { eq } = require('drizzle-orm');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Zod schemas for validation
const productCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().positive(), 
  stock: z.coerce.number().int().nonnegative().default(0),
  isActive: z.boolean().optional(),
});

const productUpdateSchema = productCreateSchema.partial();

// GET /products — list all products (public)
router.get('/', async (req, res) => {
  try {
    const list = await db.select().from(products);
    res.json(list);
  } catch (err) {
    console.error('Products list error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /products/:id — product details (public)
router.get('/:id', async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const found = await db.select().from(products).where(eq(products.id, productId));

    if (found.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(found[0]);
  } catch (err) {
    console.error('Product detail error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /products — create product (admin only)
router.post('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const parsed = productCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid data', errors: parsed.error.flatten() });
    }

    const data = parsed.data;

    const inserted = await db
      .insert(products)
      .values({
        name: data.name,
        description: data.description ?? null,
        price: data.price.toString(),
        stock: data.stock,
        isActive: data.isActive ?? true,
      })
      .returning();

    res.status(201).json(inserted[0]);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /products/:id — update product (admin only)
router.put('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);

    const parsed = productUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid data', errors: parsed.error.flatten() });
    }

    const data = parsed.data;

    const updates = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.price !== undefined) updates.price = data.price.toString();
    if (data.stock !== undefined) updates.stock = data.stock;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    const updated = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, productId))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(updated[0]);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /products/:id — delete product (admin only)
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);

    const deleted = await db
      .delete(products)
      .where(eq(products.id, productId))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product deleted', product: deleted[0] });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

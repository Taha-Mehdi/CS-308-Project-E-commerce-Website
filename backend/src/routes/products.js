const express = require('express');
const { db } = require('../db');
const { products } = require('../db/schema');
const { eq } = require('drizzle-orm');

const router = express.Router();

// GET /products — list all products
router.get('/', async (req, res) => {
  try {
    const list = await db.select().from(products);
    res.json(list);
  } catch (err) {
    console.error('Products list error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /products/:id — product details
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

module.exports = router;

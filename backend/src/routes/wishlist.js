const express = require("express");
const { z } = require("zod");
const { db } = require("../db");
const { wishlistItems, products } = require("../db/schema");
const { eq, and, inArray } = require("drizzle-orm");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// GET /wishlist  (current user's wishlist)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const items = await db
      .select()
      .from(wishlistItems)
      .where(eq(wishlistItems.userId, userId));

    if (items.length === 0) return res.json({ items: [], products: [] });

    const productIds = items.map((i) => i.productId);

    const wishlistProducts = await db
      .select()
      .from(products)
      .where(inArray(products.id, productIds));

    return res.json({ items, products: wishlistProducts });
  } catch (err) {
    console.error("GET /wishlist error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

const addSchema = z.object({
  productId: z.coerce.number().int().positive(),
});

// POST /wishlist  body: { productId }
router.post("/", authMiddleware, async (req, res) => {
  try {
    const parsed = addSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
    }

    const userId = req.user.id;
    const { productId } = parsed.data;

    // ensure product exists
    const found = await db.select().from(products).where(eq(products.id, productId));
    if (found.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    // insert (unique index prevents duplicates)
    const inserted = await db
      .insert(wishlistItems)
      .values({ userId, productId })
      .onConflictDoNothing()
      .returning();

    return res.status(201).json({
      message: inserted.length ? "Added to wishlist" : "Already in wishlist",
    });
  } catch (err) {
    console.error("POST /wishlist error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

const removeSchema = z.object({
  productId: z.coerce.number().int().positive(),
});

// DELETE /wishlist  body: { productId }
router.delete("/", authMiddleware, async (req, res) => {
  try {
    const parsed = removeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
    }

    const userId = req.user.id;
    const { productId } = parsed.data;

    const deleted = await db
      .delete(wishlistItems)
      .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)))
      .returning();

    return res.json({
      message: deleted.length ? "Removed from wishlist" : "Not in wishlist",
    });
  } catch (err) {
    console.error("DELETE /wishlist error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

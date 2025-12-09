const express = require("express");
const { z } = require("zod");
const { db } = require("../db");
const { cartItems, products } = require("../db/schema");
const { eq, and } = require("drizzle-orm");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// Schema for add/update cart operations
const addToCartSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().default(1),
});

router.post("/add", authMiddleware, async (req, res) => {
  try {
    const parsed = addToCartSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid data" });
    }

    const { productId, quantity } = parsed.data;
    const userId = req.user.id;

    // Check product exists & is active
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));

    if (!product || product.isActive === false) {
      return res.status(404).json({ message: "Product not found or inactive" });
    }

    if (product.stock <= 0) {
      return res.status(400).json({ message: "Product is out of stock" });
    }

    // Check if already in cart
    const [existing] = await db
      .select()
      .from(cartItems)
      .where(
        and(eq(cartItems.userId, userId), eq(cartItems.productId, productId))
      );

    if (existing) {
      const newQuantity = existing.quantity + quantity;
      if (newQuantity > product.stock) {
        return res.status(400).json({
          message: "Not enough stock available for the requested quantity",
        });
      }

      const [updated] = await db
        .update(cartItems)
        .set({ quantity: newQuantity })
        .where(eq(cartItems.id, existing.id))
        .returning();

      return res.json({
        message: "Cart updated",
        item: updated,
      });
    }

    // New cart item
    if (quantity > product.stock) {
      return res.status(400).json({
        message: "Not enough stock available for the requested quantity",
      });
    }

    const [inserted] = await db
      .insert(cartItems)
      .values({
        userId,
        productId,
        quantity,
      })
      .returning();

    return res.status(201).json({
      message: "Added to cart",
      item: inserted,
    });
  } catch (err) {
    console.error("POST /cart/add error:", err);
    return res.status(500).json({ message: "Failed to add item to cart" });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

// Check product exists
const [productRow] = await db
  .select()
  .from(products)
  .where(eq(products.id, productId));

if (!productRow) {
  return res.status(404).json({ message: "Product not found" });
}

// ⛔ Block adding if out of stock
if (productRow.stock <= 0) {
  return res
    .status(400)
    .json({ message: "Product is out of stock and cannot be added to cart" });
}

    const items = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userId));

    return res.json(items);
  } catch (err) {
    console.error("GET /cart error:", err);
    return res.status(500).json({ message: "Failed to fetch cart items" });
  }
});

router.put("/update", authMiddleware, async (req, res) => {
  try {
    const parsed = addToCartSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid data" });
    }

    const { productId, quantity } = parsed.data;
    const userId = req.user.id;

    // Check product exists & is active
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));

    if (!product || product.isActive === false) {
      return res.status(404).json({ message: "Product not found or inactive" });
    }

    if (quantity > product.stock) {
      return res.status(400).json({
        message: "Not enough stock available for the requested quantity",
      });
    }

    const updated = await db
      .update(cartItems)
      .set({ quantity })
      .where(
        and(eq(cartItems.userId, userId), eq(cartItems.productId, productId))
      )
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    return res.json({
      message: "Cart item updated",
      item: updated[0],
    });
  } catch (err) {
    console.error("PUT /cart/update error:", err);
    return res.status(500).json({ message: "Failed to update cart item" });
  }
});

router.delete("/remove/:productId", authMiddleware, async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const userId = req.user.id;

    const deleted = await db
      .delete(cartItems)
      .where(
        and(eq(cartItems.userId, userId), eq(cartItems.productId, productId))
      )
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    return res.json({
      message: "Item removed",
      item: deleted[0],
    });
  } catch (err) {
    console.error("DELETE /cart/remove/:productId error:", err);
    return res.status(500).json({ message: "Failed to remove item from cart" });
  }
});

module.exports = router;

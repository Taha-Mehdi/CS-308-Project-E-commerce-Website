const express = require("express");
const router = express.Router();
const { db } = require("../db");
const { reviews, orders, orderItems, users } = require("../db/schema");
const { eq, and, desc, inArray } = require("drizzle-orm");
const { authMiddleware, requireAdmin, optionalAuthMiddleware } = require("../middleware/auth");

// GET ALL PENDING REVIEWS (Admin Dashboard)
router.get("/pending", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const pendingReviews = await db.select().from(reviews).where(eq(reviews.status, "pending"));
    return res.json(pendingReviews);
  } catch (err) {
    console.error("Error fetching pending reviews:", err);
    return res.status(500).json({ message: "Failed to load pending reviews" });
  }
});

// GET REVIEWS FOR A PRODUCT (Public + Author + Admin Context)
router.get("/product/:productId", optionalAuthMiddleware, async (req, res) => {
  try {
    const productIdNum = Number(req.params.productId);
    if (!Number.isInteger(productIdNum) || productIdNum <= 0) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const currentUserId = req.user ? req.user.id : -1;

    // ✅ FIX: do NOT assume roleId=1 is admin
    const isAdmin = req.user?.roleName === "admin";

    const result = await db
      .select({
        id: reviews.id,
        userId: reviews.userId,
        rating: reviews.rating,
        comment: reviews.comment,
        status: reviews.status,
        createdAt: reviews.createdAt,
        userName: users.fullName,
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.productId, productIdNum))
      .orderBy(desc(reviews.createdAt));

    const cleanReviews = result.map((r) => {
      const isOwner = r.userId === currentUserId;

      const isHiddenPending = r.status === "pending" && !isOwner && !isAdmin;

      return {
        id: r.id,
        userId: r.userId,
        userName: r.userName || "Anonymous",
        rating: r.rating,
        comment: isHiddenPending ? null : r.comment,
        status: isHiddenPending ? "approved" : r.status,
        createdAt: r.createdAt,
      };
    });

    return res.json(cleanReviews);
  } catch (err) {
    console.error("Error loading product reviews:", err);
    return res.status(500).json({ message: "Failed to load reviews" });
  }
});

// POST REVIEW (Protected)
router.post("/", authMiddleware, async (req, res) => {
  const { productId, rating, comment } = req.body;
  const userId = req.user.id;
  const productIdNum = Number(productId);
  const ratingNum = Number(rating);

  if (!Number.isInteger(productIdNum) || productIdNum <= 0)
    return res.status(400).json({ message: "Invalid product id" });
  if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5)
    return res.status(400).json({ message: "Rating must be between 1 and 5" });

  try {
    const userOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.status, "delivered")));

    if (userOrders.length === 0)
      return res.status(403).json({ message: "Item not purchased or not delivered." });

    const orderIds = userOrders.map((o) => o.id);
    const validItems = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.productId, productIdNum), inArray(orderItems.orderId, orderIds)))
      .limit(1);

    if (validItems.length === 0)
      return res.status(403).json({ message: "You have not purchased this product." });

    await db.insert(reviews).values({
      userId,
      productId: productIdNum,
      rating: ratingNum,
      comment: comment || null,
      status: "pending",
    });

    return res.status(201).json({ message: "Review submitted! Awaiting approval." });
  } catch (err) {
    console.error("Review error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// APPROVE REVIEW (Admin Only)
router.put("/:id/approve", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const reviewId = Number(req.params.id);
    await db.update(reviews).set({ status: "approved" }).where(eq(reviews.id, reviewId));
    return res.json({ message: "Review approved." });
  } catch (err) {
    return res.status(500).json({ message: "Failed to approve." });
  }
});

// DELETE REVIEW (Admin Only)
router.delete("/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const reviewId = Number(req.params.id);
    await db.delete(reviews).where(eq(reviews.id, reviewId));
    return res.json({ message: "Review deleted." });
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete." });
  }
});

module.exports = router;

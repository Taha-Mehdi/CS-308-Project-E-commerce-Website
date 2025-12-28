const express = require("express");
const router = express.Router();
const { db } = require("../db");
const { reviews, orders, orderItems, users } = require("../db/schema");
const { eq, and, desc, inArray } = require("drizzle-orm");
const { authMiddleware, requireAdmin, optionalAuthMiddleware, requireProductManagerOrAdmin } = require("../middleware/auth");

// GET ALL PENDING REVIEWS
router.get("/pending", authMiddleware, requireProductManagerOrAdmin, async (req, res) => {
  try {
    const pendingReviews = await db.select().from(reviews).where(eq(reviews.status, "pending"));
    return res.json(pendingReviews);
  } catch (err) {
    console.error("Error fetching pending reviews:", err);
    return res.status(500).json({ message: "Failed to load pending reviews" });
  }
});

// GET REVIEWS FOR A PRODUCT
router.get("/product/:productId", optionalAuthMiddleware, async (req, res) => {
  try {
    const productIdNum = Number(req.params.productId);
    if (!Number.isInteger(productIdNum) || productIdNum <= 0) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const currentUserId = req.user ? req.user.id : -1;
    const role = req.user?.roleName;
    const canSeeHidden = role === "admin" || role === "product_manager";

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
      // Hide review text if it's pending and you aren't the owner/admin
      const isHiddenPending = r.status === "pending" && !isOwner && !canSeeHidden;

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

// POST REVIEW
// ✅ FIXED: Auto-approve if no text comment
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
    // 1. Check if user has a DELIVERED order for this product
    const userOrders = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.userId, userId), eq(orders.status, "delivered")));

    if (userOrders.length === 0)
      return res.status(403).json({ message: "You can only review delivered items." });

    const orderIds = userOrders.map((o) => o.id);
    const validItems = await db
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.productId, productIdNum), inArray(orderItems.orderId, orderIds)))
        .limit(1);

    if (validItems.length === 0)
      return res.status(403).json({ message: "You have not purchased this product." });

    // 2. Prevent duplicate reviews
    const existingReview = await db.select().from(reviews).where(and(eq(reviews.userId, userId), eq(reviews.productId, productIdNum)));
    if (existingReview.length > 0) {
      return res.status(409).json({ message: "You have already reviewed this product." });
    }

    // ✅ LOGIC: If comment is empty, AUTO-APPROVE. If text exists, PENDING.
    const hasComment = comment && typeof comment === 'string' && comment.trim().length > 0;
    const initialStatus = hasComment ? "pending" : "approved";

    await db.insert(reviews).values({
      userId,
      productId: productIdNum,
      rating: ratingNum,
      comment: hasComment ? comment.trim() : null,
      status: initialStatus,
    });

    const msg = initialStatus === "approved"
        ? "Rating submitted!"
        : "Review submitted! Awaiting approval.";

    return res.status(201).json({ message: msg, status: initialStatus });
  } catch (err) {
    console.error("Review error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// APPROVE REVIEW (Keeps text, sets status approved)
router.put("/:id/approve", authMiddleware, requireProductManagerOrAdmin, async (req, res) => {
  try {
    const reviewId = Number(req.params.id);
    await db.update(reviews).set({ status: "approved" }).where(eq(reviews.id, reviewId));
    return res.json({ message: "Review approved." });
  } catch (err) {
    return res.status(500).json({ message: "Failed to approve." });
  }
});

// DELETE REVIEW (Deletes text only, approves stars)
router.delete("/:id", authMiddleware, requireProductManagerOrAdmin, async (req, res) => {
  try {
    const reviewId = Number(req.params.id);
    await db.update(reviews)
        .set({ comment: null, status: "approved" })
        .where(eq(reviews.id, reviewId));

    return res.json({ message: "Review text removed. Rating approved." });
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete review text." });
  }
});

module.exports = router;
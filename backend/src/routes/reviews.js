const express = require("express");
const router = express.Router();
const { db } = require("../db");
const { reviews, orders, orderItems, users } = require("../db/schema");
const { eq, and, desc } = require("drizzle-orm");
const {
  authMiddleware,
  requireProductManagerOrAdmin,
  optionalAuthMiddleware,
} = require("../middleware/auth");

/* ===========================
   GET REVIEWS FOR PRODUCT
   =========================== */
router.get("/product/:productId", optionalAuthMiddleware, async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const currentUserId = req.user?.id ?? null;
    const role = req.user?.roleName;
    const canModerate = role === "admin" || role === "product_manager";

    const rows = await db
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
      .where(eq(reviews.productId, productId))
      .orderBy(desc(reviews.createdAt));

    const cleaned = rows.map((r) => {
      const isOwner = r.userId === currentUserId;
      const hideComment =
        r.status !== "approved" && !isOwner && !canModerate;

      return {
        id: r.id,
        userName: r.userName || "User",
        rating: r.rating, // ⭐ rating is ALWAYS shown
        comment: hideComment ? null : r.comment,
        status: hideComment ? "approved" : r.status,
        createdAt: r.createdAt,
      };
    });

    res.json(cleaned);
  } catch (err) {
    console.error("Load reviews error:", err);
    res.status(500).json({ message: "Failed to load reviews" });
  }
});

/* ===========================
   POST / UPSERT REVIEW
   Delivered-only enforcement
   =========================== */
router.post("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const productId = Number(req.body.productId);
  const rating = Number(req.body.rating);
  const commentRaw = req.body.comment;

  if (!Number.isInteger(productId)) {
    return res.status(400).json({ message: "Invalid product id" });
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be between 1 and 5" });
  }

  const hasComment =
    typeof commentRaw === "string" && commentRaw.trim().length > 0;

  try {
    /* -------------------------------------------
       DELIVERED-ONLY PURCHASE ENFORCEMENT
       ------------------------------------------- */
    const delivered = await db
      .select({ id: orders.id })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orders.userId, userId),
          eq(orderItems.productId, productId),
          eq(orders.status, "delivered") // 🔒 STRICT POLICY
        )
      )
      .limit(1);

    if (delivered.length === 0) {
      return res.status(403).json({
        message:
          "You can review this product only after your order has been delivered.",
      });
    }

    /* -------------------------------------------
       UPSERT (one rating per user per product)
       ------------------------------------------- */
    const existing = await db
      .select()
      .from(reviews)
      .where(
        and(eq(reviews.userId, userId), eq(reviews.productId, productId))
      )
      .limit(1);

    const status = hasComment ? "pending" : "approved";

    if (existing.length === 0) {
      await db.insert(reviews).values({
        userId,
        productId,
        rating,
        comment: hasComment ? commentRaw.trim() : null,
        status,
      });
    } else {
      await db
        .update(reviews)
        .set({
          rating,
          comment: hasComment ? commentRaw.trim() : null,
          status,
        })
        .where(eq(reviews.id, existing[0].id));
    }

    return res.status(201).json({
      message: hasComment
        ? "Review submitted and awaiting moderation."
        : "Rating submitted.",
      status,
    });
  } catch (err) {
    console.error("Review submit error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   MODERATION (comment only)
   =========================== */
router.put(
  "/:id/approve",
  authMiddleware,
  requireProductManagerOrAdmin,
  async (req, res) => {
    await db
      .update(reviews)
      .set({ status: "approved" })
      .where(eq(reviews.id, Number(req.params.id)));
    res.json({ message: "Comment approved." });
  }
);

router.put(
  "/:id/reject",
  authMiddleware,
  requireProductManagerOrAdmin,
  async (req, res) => {
    await db
      .update(reviews)
      .set({ status: "rejected" })
      .where(eq(reviews.id, Number(req.params.id)));
    res.json({
      message: "Comment rejected. Rating preserved.",
    });
  }
);

module.exports = router;

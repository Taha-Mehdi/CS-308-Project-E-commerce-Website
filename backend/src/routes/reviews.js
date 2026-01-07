const express = require("express");
const router = express.Router();
const { db } = require("../db");
const { reviews, orders, orderItems, users } = require("../db/schema");
const { eq, and, desc, or } = require("drizzle-orm");
const {
  authMiddleware,
  requireProductManagerOrAdmin,
  optionalAuthMiddleware,
} = require("../middleware/auth");

/* ===========================
   GET REVIEWS FOR PRODUCT
   Public rules:
   - Public sees ONLY approved reviews
   - Owner can see their own review (pending/rejected too)
   - Admin/Product Manager can see all
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

    // If not moderator: show approved + (owner's own review)
    const whereClause = canModerate
      ? eq(reviews.productId, productId)
      : and(
          eq(reviews.productId, productId),
          or(eq(reviews.status, "approved"), eq(reviews.userId, currentUserId ?? -1))
        );

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
      .where(whereClause)
      .orderBy(desc(reviews.createdAt));

    // Public must not see pending/rejected (except owner)
    const cleaned = rows.map((r) => {
      const isOwner = currentUserId != null && r.userId === currentUserId;

      // If not moderator and not owner, row is approved already due to whereClause
      const hideComment = !canModerate && !isOwner && r.status !== "approved";

      return {
        id: r.id,
        userName: r.userName || "User",
        rating: r.rating,
        comment: hideComment ? null : r.comment,
        status: canModerate || isOwner ? r.status : "approved",
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
   ADMIN: LIST PENDING REVIEWS (for existing frontend calls)
   =========================== */
router.get(
  "/pending",
  authMiddleware,
  requireProductManagerOrAdmin,
  async (req, res) => {
    try {
      const rows = await db
        .select({
          id: reviews.id,
          userId: reviews.userId,
          productId: reviews.productId,
          rating: reviews.rating,
          comment: reviews.comment,
          status: reviews.status,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .where(eq(reviews.status, "pending"))
        .orderBy(desc(reviews.createdAt));

      res.json(rows);
    } catch (err) {
      console.error("Load pending reviews error:", err);
      res.status(500).json({ message: "Failed to load pending reviews" });
    }
  }
);

/* ===========================
   ADMIN: LIST REVIEWS FOR MODERATION (pending + rejected)
   (This is what you want for “admin reviews section”)
   =========================== */
router.get(
  "/moderation",
  authMiddleware,
  requireProductManagerOrAdmin,
  async (req, res) => {
    try {
      const rows = await db
        .select({
          id: reviews.id,
          userId: reviews.userId,
          productId: reviews.productId,
          rating: reviews.rating,
          comment: reviews.comment,
          status: reviews.status,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .where(or(eq(reviews.status, "pending"), eq(reviews.status, "rejected")))
        .orderBy(desc(reviews.createdAt));

      res.json(rows);
    } catch (err) {
      console.error("Load moderation reviews error:", err);
      res.status(500).json({ message: "Failed to load moderation reviews" });
    }
  }
);

/* ===========================
   POST REVIEW
   Rules:
   - Delivered-only enforcement
   - ✅ User cannot submit more than 1 review per product (NO UPSERT)
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
          eq(orders.status, "delivered")
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
       ✅ ONE REVIEW PER USER PER PRODUCT (NO UPDATE)
       ------------------------------------------- */
    const existing = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.userId, userId), eq(reviews.productId, productId)))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({
        message: "You have already submitted a review for this product.",
      });
    }

    const status = hasComment ? "pending" : "approved";

    await db.insert(reviews).values({
      userId,
      productId,
      rating,
      comment: hasComment ? commentRaw.trim() : null,
      status,
    });

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
   MODERATION
   - Reject does NOT delete
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
    res.json({ message: "Review approved." });
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
      message: "Review rejected. It is kept for admin visibility.",
    });
  }
);

module.exports = router;

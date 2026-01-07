const express = require("express");
const router = express.Router();

const { db } = require("../db");
const { reviews, orders, orderItems, users, products } = require("../db/schema");
const { eq, and, desc, sql } = require("drizzle-orm");

const {
  authMiddleware,
  requireProductManagerOrAdmin,
  optionalAuthMiddleware,
} = require("../middleware/auth");

const { sendReviewModerationEmail } = require("../utils/email");

function isModerator(user) {
  const role = user?.roleName || user?.role || user?.role_name;
  return role === "admin" || role === "product_manager";
}

function cleanCommentForViewer({
  comment,
  status,
  viewerUserId,
  ownerUserId,
  viewerIsModerator,
}) {
  const normalizedStatus = String(status || "").toLowerCase();

  // Moderators always see everything
  if (viewerIsModerator) {
    return { comment, status: normalizedStatus || "approved" };
  }

  const isOwner = viewerUserId != null && ownerUserId === viewerUserId;

  // Owner may see their own pending/rejected comment (optional; helpful UX)
  if (isOwner) {
    return { comment, status: normalizedStatus || "approved" };
  }

  // Public: only approved comments are visible
  if (normalizedStatus === "approved") {
    return { comment, status: "approved" };
  }

  // Pending / rejected: rating should count, comment must not be visible publicly.
  return { comment: null, status: "approved" };
}

/* ===========================
   GET REVIEWS FOR PRODUCT

   - Returns ALL rating rows so avg + rating count include pending/rejected too.
   - Public only sees APPROVED comments (others hidden).
   =========================== */
router.get("/product/:productId", optionalAuthMiddleware, async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const viewerUserId = req.user?.id ?? null;
    const viewerIsModerator = isModerator(req.user);

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
      const { comment, status } = cleanCommentForViewer({
        comment: r.comment,
        status: r.status,
        viewerUserId,
        ownerUserId: r.userId,
        viewerIsModerator,
      });

      return {
        id: r.id,
        userName: r.userName || "User",
        rating: r.rating,
        comment,
        status,
        createdAt: r.createdAt,
      };
    });

    return res.json(cleaned);
  } catch (err) {
    console.error("Load reviews error:", err);
    return res.status(500).json({ message: "Failed to load reviews" });
  }
});

/* ===========================
   GET MY REVIEWS (Account page)
   totalReviews = COUNT(approved comments) where comment IS NOT NULL
   =========================== */
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const myRows = await db
      .select({
        id: reviews.id,
        productId: reviews.productId,
        productName: products.name,
        productImageUrl: products.imageUrl,
        rating: reviews.rating,
        comment: reviews.comment,
        status: reviews.status,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .innerJoin(products, eq(reviews.productId, products.id))
      .where(eq(reviews.userId, userId))
      .orderBy(desc(reviews.createdAt));

    const [{ count } = { count: 0 }] = await db
      .select({
        count: sql`count(*)`.mapWith(Number),
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.userId, userId),
          eq(reviews.status, "approved"),
          sql`${reviews.comment} IS NOT NULL`
        )
      );

    return res.json({
      totalReviews: Number(count) || 0,
      reviews: myRows,
    });
  } catch (err) {
    console.error("Get my reviews error:", err);
    return res.status(500).json({ message: "Failed to load your reviews" });
  }
});

/* ===========================
   ADMIN: LIST REVIEWS FOR MODERATION (comments only)
   ?status=all|pending|approved|rejected  (default all)
   =========================== */
router.get(
  "/moderation",
  authMiddleware,
  requireProductManagerOrAdmin,
  async (req, res) => {
    try {
      const status = String(req.query.status || "all").toLowerCase();

      const baseWhere = sql`${reviews.comment} IS NOT NULL`;

      const whereClause =
        status === "pending" || status === "approved" || status === "rejected"
          ? and(baseWhere, eq(reviews.status, status))
          : baseWhere; // all

      const rows = await db
        .select({
          id: reviews.id,
          userId: reviews.userId,
          userName: users.fullName,
          userEmail: users.email,
          productId: reviews.productId,
          productName: products.name,
          rating: reviews.rating,
          comment: reviews.comment,
          status: reviews.status,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .leftJoin(users, eq(reviews.userId, users.id))
        .leftJoin(products, eq(reviews.productId, products.id))
        .where(whereClause)
        .orderBy(desc(reviews.createdAt));

      return res.json(rows);
    } catch (err) {
      console.error("Load moderation reviews error:", err);
      return res.status(500).json({ message: "Failed to load moderation reviews" });
    }
  }
);

/* ===========================
   POST REVIEW
   - Delivered-only
   - One review per user per product
   - rating always accepted; comment => pending
   - ✅ NEW: if comment is pending, email admin for moderation
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

  const hasComment = typeof commentRaw === "string" && commentRaw.trim().length > 0;

  try {
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
        message: "You can review this product only after your order has been delivered.",
      });
    }

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
    const comment = hasComment ? commentRaw.trim() : null;

    const [inserted] = await db
      .insert(reviews)
      .values({
        userId,
        productId,
        rating,
        comment,
        status,
      })
      .returning({
        id: reviews.id,
        createdAt: reviews.createdAt,
      });

    // ✅ Send to admin for moderation (non-blocking; do not fail the review if email fails)
    if (hasComment) {
      try {
        const [p] = await db
          .select({ id: products.id, name: products.name })
          .from(products)
          .where(eq(products.id, productId))
          .limit(1);

        await sendReviewModerationEmail({
          productId,
          productName: p?.name || "",
          rating,
          comment,
          userId,
          userName: req.user?.fullName || "",
          userEmail: req.user?.email || "",
          reviewId: inserted?.id,
          createdAt: inserted?.createdAt || new Date().toISOString(),
        });
      } catch (emailErr) {
        console.error("Review moderation email error (ignored):", emailErr);
      }
    }

    return res.status(201).json({
      message: hasComment ? "Review submitted and awaiting moderation." : "Rating submitted.",
      status,
    });
  } catch (err) {
    console.error("Review submit error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   USER: ADD / EDIT COMMENT (resubmit flow)
   - Approved comment (non-null) is locked
   - Rating-only approved can add comment => pending
   - Pending can edit
   - Rejected can edit/resubmit => pending
   =========================== */
router.put("/:id/comment", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const reviewId = Number(req.params.id);
    const raw = req.body?.comment;

    if (!Number.isInteger(reviewId)) {
      return res.status(400).json({ message: "Invalid review id" });
    }

    const comment = typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;

    const [row] = await db
      .select({
        id: reviews.id,
        userId: reviews.userId,
        status: reviews.status,
        comment: reviews.comment,
        productId: reviews.productId,
        rating: reviews.rating,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!row) return res.status(404).json({ message: "Review not found" });
    if (row.userId !== userId) return res.status(403).json({ message: "Access denied" });

    const currentStatus = String(row.status || "").toLowerCase();

    if (currentStatus === "approved" && row.comment) {
      return res.status(409).json({ message: "Approved comments cannot be edited." });
    }

    if (!comment) {
      await db
        .update(reviews)
        .set({ comment: null, status: "approved" })
        .where(eq(reviews.id, reviewId));
      return res.json({ message: "Comment removed.", status: "approved" });
    }

    await db.update(reviews).set({ comment, status: "pending" }).where(eq(reviews.id, reviewId));

    // ✅ Email admin again on resubmission (non-blocking)
    try {
      const [p] = await db
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(eq(products.id, row.productId))
        .limit(1);

      await sendReviewModerationEmail({
        productId: row.productId,
        productName: p?.name || "",
        rating: row.rating,
        comment,
        userId,
        userName: req.user?.fullName || "",
        userEmail: req.user?.email || "",
        reviewId: row.id,
        createdAt: row.createdAt || new Date().toISOString(),
      });
    } catch (emailErr) {
      console.error("Review moderation email error (ignored):", emailErr);
    }

    return res.json({ message: "Comment submitted for moderation.", status: "pending" });
  } catch (err) {
    console.error("Update comment error:", err);
    return res.status(500).json({ message: "Failed to update comment" });
  }
});

/* ===========================
   MODERATION
   - Only pending comments can be approved/rejected
   - Reject does NOT delete
   - ✅ NEW: store moderatedBy + moderatedAt (+ optional rejectionReason)
   =========================== */
router.put("/:id/approve", authMiddleware, requireProductManagerOrAdmin, async (req, res) => {
  try {
    const reviewId = Number(req.params.id);
    if (!Number.isInteger(reviewId)) return res.status(400).json({ message: "Invalid review id" });

    const [row] = await db
      .select({ id: reviews.id, status: reviews.status, comment: reviews.comment })
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!row) return res.status(404).json({ message: "Review not found" });
    if (!row.comment) return res.status(400).json({ message: "No comment to approve" });

    const s = String(row.status || "").toLowerCase();
    if (s !== "pending") return res.status(409).json({ message: "Only pending comments can be approved." });

    await db
      .update(reviews)
      .set({
        status: "approved",
        moderatedBy: req.user.id,
        moderatedAt: new Date(),
        rejectionReason: null,
      })
      .where(eq(reviews.id, reviewId));

    return res.json({ message: "Comment approved." });
  } catch (err) {
    console.error("Approve review error:", err);
    return res.status(500).json({ message: "Failed to approve review" });
  }
});

router.put("/:id/reject", authMiddleware, requireProductManagerOrAdmin, async (req, res) => {
  try {
    const reviewId = Number(req.params.id);
    if (!Number.isInteger(reviewId)) return res.status(400).json({ message: "Invalid review id" });

    const [row] = await db
      .select({ id: reviews.id, status: reviews.status, comment: reviews.comment })
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!row) return res.status(404).json({ message: "Review not found" });
    if (!row.comment) return res.status(400).json({ message: "No comment to reject" });

    const s = String(row.status || "").toLowerCase();
    if (s !== "pending") return res.status(409).json({ message: "Only pending comments can be rejected." });

    const rejectionReason =
      typeof req.body?.reason === "string" && req.body.reason.trim().length > 0
        ? req.body.reason.trim()
        : null;

    await db
      .update(reviews)
      .set({
        status: "rejected",
        moderatedBy: req.user.id,
        moderatedAt: new Date(),
        rejectionReason,
      })
      .where(eq(reviews.id, reviewId));

    return res.json({ message: "Comment rejected. It is kept for admin visibility." });
  } catch (err) {
    console.error("Reject review error:", err);
    return res.status(500).json({ message: "Failed to reject review" });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { reviews, orders, orderItems, users } = require('../db/schema');
const { eq, and, desc, inArray } = require('drizzle-orm');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

// SPECIFIC ROUTES (MUST BE FIRST)
// GET ALL PENDING REVIEWS (Admin Only)
router.get('/pending', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const pendingReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.status, 'pending'));

    return res.json(pendingReviews);
  } catch (err) {
    console.error('Error fetching pending reviews:', err);
    return res
      .status(500)
      .json({ message: 'Failed to load pending reviews' });
  }
});

// 2. DYNAMIC ROUTES
// GET REVIEWS FOR A PRODUCT (Public)
router.get('/product/:productId', async (req, res) => {
  try {
    const productIdNum = Number(req.params.productId);
    if (!Number.isInteger(productIdNum) || productIdNum <= 0) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

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

    const cleanReviews = result.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.userName || 'Anonymous',
      rating: r.rating,
      // Comment only visible if approved; otherwise null
      comment: r.status === 'approved' ? r.comment : null,
      status: r.status,
      createdAt: r.createdAt,
    }));

    return res.json(cleanReviews);
  } catch (err) {
    console.error('Error loading product reviews:', err);
    return res.status(500).json({ message: 'Failed to load reviews' });
  }
});

// POST REVIEW (Protected)
router.post('/', authMiddleware, async (req, res) => {
  const { productId, rating, comment } = req.body;
  const userId = req.user.id;

  const productIdNum = Number(productId);
  const ratingNum = Number(rating);

  if (!Number.isInteger(productIdNum) || productIdNum <= 0) {
    return res.status(400).json({ message: 'Invalid product id' });
  }

  if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res
      .status(400)
      .json({ message: 'Rating must be between 1 and 5' });
  }

  try {
    // DELIVERY CHECK 

    // Find all DELIVERED orders for this user
    const userOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(eq(orders.userId, userId), eq(orders.status, 'delivered'))
      );

    if (userOrders.length === 0) {
      return res.status(403).json({
        message:
          "You haven't purchased this item or it hasn't been delivered yet.",
      });
    }

    const orderIds = userOrders.map((o) => o.id);

    // Check if product is in those delivered orders
    const validItems = await db
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.productId, productIdNum),
          inArray(orderItems.orderId, orderIds)
        )
      )
      .limit(1);

    if (validItems.length === 0) {
      return res.status(403).json({
        message: 'You have not purchased this specific product.',
      });
    }

    // SUBMIT REVIEW 
    await db.insert(reviews).values({
      userId,
      productId: productIdNum,
      rating: ratingNum,
      comment: comment || null,
      // Ratings are live immediately, but comment text is hidden
      // until a manager/admin sets status to 'approved'.
      status: 'pending',
    });

    return res.status(201).json({
      message:
        'Review submitted! Your rating is visible, and your comment is awaiting manager approval.',
    });
  } catch (err) {
    console.error('Review error:', err);
    return res
      .status(500)
      .json({ message: 'Server error submitting review' });
  }
});

// APPROVE REVIEW (Manager/Admin Only)
router.put('/:id/approve', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const reviewId = Number(req.params.id);
    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      return res.status(400).json({ message: 'Invalid review id' });
    }

    await db
      .update(reviews)
      .set({ status: 'approved' })
      .where(eq(reviews.id, reviewId));

    return res.json({ message: 'Review approved successfully.' });
  } catch (err) {
    console.error('Approval error:', err);
    return res
      .status(500)
      .json({ message: 'Failed to approve review.' });
  }
});

// REJECT/DELETE REVIEW (Manager/Admin Only)
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const reviewId = Number(req.params.id);
    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      return res.status(400).json({ message: 'Invalid review id' });
    }

    await db.delete(reviews).where(eq(reviews.id, reviewId));

    return res.json({ message: 'Review deleted successfully.' });
  } catch (err) {
    console.error('Delete error:', err);
    return res
      .status(500)
      .json({ message: 'Failed to delete review.' });
  }
});

module.exports = router;

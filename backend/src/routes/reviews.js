// backend/src/routes/reviews.js
const express = require('express');
const router = express.Router();
const { db } = require('../db');
// Import your tables
const { reviews, orders, orderItems, users } = require('../db/schema');
const { eq, and, desc, inArray } = require('drizzle-orm');
// Import auth middleware
const { authMiddleware, requireAdmin } = require('../middleware/auth');

// =========================================================
// 1. SPECIFIC ROUTES (MUST BE FIRST)
// =========================================================

// GET ALL PENDING REVIEWS (Admin Only)
// This MUST come before '/product/:productId' or else "pending"
// will be treated as a product ID!
router.get('/pending', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const pendingReviews = await db
            .select()
            .from(reviews)
            .where(eq(reviews.status, 'pending'));

        res.json(pendingReviews);
    } catch (err) {
        console.error("Error fetching pending reviews:", err);
        res.status(500).json({ message: "Failed to load pending reviews" });
    }
});

// =========================================================
// 2. DYNAMIC ROUTES
// =========================================================

// GET REVIEWS FOR A PRODUCT (Public)
// GET REVIEWS FOR A PRODUCT (Public)
// GET REVIEWS FOR A PRODUCT (Public)
router.get('/product/:productId', async (req, res) => {
    try {
        const { productId } = req.params;

        const result = await db
            .select({
                id: reviews.id,
                userId: reviews.userId,
                rating: reviews.rating,
                comment: reviews.comment,
                status: reviews.status,
                createdAt: reviews.createdAt,
                // CHANGED: Get 'fullName' instead of 'email'
                userName: users.fullName
            })
            .from(reviews)
            .leftJoin(users, eq(reviews.userId, users.id))
            .where(eq(reviews.productId, productId))
            .orderBy(desc(reviews.createdAt));

        const cleanReviews = result.map(r => ({
            id: r.id,
            userId: r.userId,
            // CHANGED: Return 'userName' to frontend
            userName: r.userName || "Anonymous",
            rating: r.rating,
            comment: r.status === 'approved' ? r.comment : null,
            status: r.status,
            createdAt: r.createdAt
        }));

        res.json(cleanReviews);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load reviews" });
    }
});

// POST REVIEW (Protected)
router.post('/', authMiddleware, async (req, res) => {
    const { productId, rating, comment } = req.body;
    const userId = req.user.id;

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    try {
        // --- DELIVERY CHECK ---

        // 1. Find all DELIVERED orders for this user
        const userOrders = await db
            .select({ id: orders.id })
            .from(orders)
            .where(and(
                eq(orders.userId, userId),
                eq(orders.status, 'delivered')
            ));

        if (userOrders.length === 0) {
            return res.status(403).json({ message: "You haven't purchased this item or it hasn't arrived yet." });
        }

        const orderIds = userOrders.map(o => o.id);

        // 2. Check if product is in those orders
        const validItems = await db
            .select()
            .from(orderItems)
            .where(and(
                eq(orderItems.productId, productId),
                inArray(orderItems.orderId, orderIds)
            ))
            .limit(1);

        if (validItems.length === 0) {
            return res.status(403).json({ message: "You have not purchased this specific item." });
        }

        // --- SUBMIT REVIEW ---
        await db.insert(reviews).values({
            userId,
            productId,
            rating,
            comment,
            status: 'pending'
        });

        res.status(201).json({ message: "Review submitted! Ratings are live, comments await approval." });

    } catch (err) {
        console.error("Review error:", err);
        res.status(500).json({ message: "Server error submitting review" });
    }
});

// APPROVE REVIEW (Manager/Admin Only)
router.put('/:id/approve', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await db.update(reviews)
            .set({ status: 'approved' })
            .where(eq(reviews.id, id));

        res.json({ message: "Review approved successfully." });
    } catch (err) {
        console.error("Approval error:", err);
        res.status(500).json({ message: "Failed to approve review." });
    }
});

// REJECT/DELETE REVIEW (Manager/Admin Only)
// Needed for the "Reject" button
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await db.delete(reviews).where(eq(reviews.id, id));

        res.json({ message: "Review deleted successfully." });
    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).json({ message: "Failed to delete review." });
    }
});

module.exports = router;
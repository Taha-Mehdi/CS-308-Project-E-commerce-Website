// backend/src/routes/reviews.js
const express = require('express');
const router = express.Router();
const { db } = require('../db');
// Import your tables (Make sure 'reviews' is in your schema.js export!)
const { reviews, orders, orderItems } = require('../db/schema');
const { eq, and, desc, inArray } = require('drizzle-orm');
// FIX: Using the correct names from your auth.js file
const { authMiddleware, requireAdmin } = require('../middleware/auth');

// 1. GET REVIEWS (Public)
// Returns all ratings, but hides comment text if not approved
router.get('/product/:productId', async (req, res) => {
    try {
        const { productId } = req.params;

        // Fetch all reviews for this product
        const allReviews = await db
            .select()
            .from(reviews)
            .where(eq(reviews.productId, productId))
            .orderBy(desc(reviews.createdAt));

        // Process them for the frontend
        const cleanReviews = allReviews.map(r => ({
            id: r.id,
            userId: r.userId,
            rating: r.rating, // Rating is ALWAYS visible
            // Only show text if approved. If pending/rejected, send null.
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

// 2. POST REVIEW (Protected)
router.post('/', authMiddleware, async (req, res) => {
    const { productId, rating, comment } = req.body;
    const userId = req.user.id;

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    try {
        // --- DELIVERY CHECK (Fixed Version) ---

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

        // 2. Check if product is in those orders (USING db.select INSTEAD OF db.query)
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

// 3. APPROVE REVIEW (Manager/Admin Only)
// PUT /api/reviews/123/approve
router.put('/:id/approve', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Update the status to 'approved' so the comment becomes visible
        await db.update(reviews)
            .set({ status: 'approved' })
            .where(eq(reviews.id, id));

        res.json({ message: "Review approved successfully." });
    } catch (err) {
        console.error("Approval error:", err);
        res.status(500).json({ message: "Failed to approve review." });
    }
});

module.exports = router;
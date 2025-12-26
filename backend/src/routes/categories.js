const express = require("express");
const { z } = require("zod");
const { db } = require("../db");
const { categories } = require("../db/schema");
const { eq } = require("drizzle-orm");
const { authMiddleware, requireProductManagerOrAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /categories - List all categories
router.get("/", async (req, res) => {
    try {
        const all = await db.select().from(categories).orderBy(categories.id);
        res.json(all);
    } catch (err) {
        console.error("GET /categories error:", err);
        res.status(500).json({ message: "Failed to fetch categories" });
    }
});

// POST /categories - Add new category
router.post("/", authMiddleware, requireProductManagerOrAdmin, async (req, res) => {
    const schema = z.object({ name: z.string().min(1) });
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ message: "Name is required" });
    }

    try {
        const [created] = await db
            .insert(categories)
            .values({ name: parsed.data.name })
            .returning();
        res.status(201).json(created);
    } catch (err) {
        console.error("POST /categories error:", err);
        res.status(500).json({ message: "Failed to create category" });
    }
});

// DELETE /categories/:id - Remove category
router.delete("/:id", authMiddleware, requireProductManagerOrAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid ID" });

    try {
        // Note: This might fail if products are still linked to this category
        // You might want to handle that error specifically
        await db.delete(categories).where(eq(categories.id, id));
        res.json({ message: "Category deleted" });
    } catch (err) {
        console.error("DELETE /categories error:", err);
        res.status(500).json({ message: "Failed to delete category (it might be in use)" });
    }
});

module.exports = router;
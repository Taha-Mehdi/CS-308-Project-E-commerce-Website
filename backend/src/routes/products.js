const express = require("express");
const { z } = require("zod");
const { db } = require("../db");
const { products, wishlistItems, users } = require("../db/schema");
const { eq, or, ilike, asc, desc, inArray } = require("drizzle-orm");
const {
  authMiddleware,
  requireAdmin,
  requireSalesManagerOrAdmin,
} = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { sendDiscountEmail } = require("../utils/email");

const router = express.Router();

function parseIsActive(raw) {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const lower = raw.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
  }
  return undefined;
}

function parseCategoryId(raw) {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const num = Number(raw);
  if (Number.isNaN(num)) return undefined;
  return num;
}

const productBodySchema = z.object({
  name: z.string().min(1, "Product name is required"),

  model: z.string().min(1, "Model is required"),
  serialNumber: z.string().min(1, "Serial number is required"),
  description: z.string().min(1, "Description is required"),
  stock: z.number().int().nonnegative("Quantity in stock is required"),
  price: z.number().nonnegative("Price is required"),
  warrantyStatus: z.string().min(1, "Warranty status is required"),
  distributorInfo: z.string().min(1, "Distributor information is required"),

  isActive: z.boolean().optional().default(true),
  categoryId: z.number().int().optional().nullable(),
  cost: z.number().nonnegative("Cost must be >= 0").optional(),
});

const uploadDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

// GET /products (search + sort)
router.get("/", async (req, res) => {
  const { q, sortBy, sortOrder } = req.query;

  try {
    let query = db.select().from(products);

    if (q && q.trim() !== "") {
      const term = `%${q.trim()}%`;
      query = query.where(or(ilike(products.name, term), ilike(products.description, term)));
    }

    if (sortBy === "price") {
      query = query.orderBy(sortOrder === "desc" ? desc(products.price) : asc(products.price));
    } else {
      query = query.orderBy(asc(products.id));
    }

    const all = await query;
    return res.json(all);
  } catch (err) {
    console.error("GET /products error:", err);
    return res.status(500).json({ message: "Failed to fetch products" });
  }
});

// GET /products/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  try {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) return res.status(404).json({ message: "Product not found" });

    return res.json(product);
  } catch (err) {
    console.error("GET /products/:id error:", err);
    return res.status(500).json({ message: "Failed to fetch product" });
  }
});

// POST /products (admin)
router.post("/", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const parsed = productBodySchema.safeParse({
      name: req.body.name,
      model: req.body.model,
      serialNumber: req.body.serialNumber,
      description: req.body.description,

      stock: Number(req.body.stock),
      price: Number(req.body.price),
      warrantyStatus: req.body.warrantyStatus,
      distributorInfo: req.body.distributorInfo,

      isActive: parseIsActive(req.body.isActive),
      categoryId: parseCategoryId(req.body.categoryId),
      cost:
        req.body.cost !== undefined && req.body.cost !== null && req.body.cost !== ""
          ? Number(req.body.cost)
          : undefined,
    });

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid data",
        errors: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    const [created] = await db
      .insert(products)
      .values({
        name: data.name,
        model: data.model,
        serialNumber: data.serialNumber,
        description: data.description,

        stock: data.stock,
        price: data.price,
        warrantyStatus: data.warrantyStatus,
        distributorInfo: data.distributorInfo,

        isActive: data.isActive,
        categoryId: data.categoryId ?? null,
        cost: data.cost ?? null,

        originalPrice: null,
        discountRate: null,
      })
      .returning();

    return res.status(201).json(created);
  } catch (err) {
    console.error("POST /products error:", err);
    return res.status(500).json({ message: "Failed to create product" });
  }
});

// PUT /products/:id (admin)
router.put("/:id", authMiddleware, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  try {
    const parsed = productBodySchema.safeParse({
      name: req.body.name,
      model: req.body.model,
      serialNumber: req.body.serialNumber,
      description: req.body.description,

      stock: Number(req.body.stock),
      price: Number(req.body.price),
      warrantyStatus: req.body.warrantyStatus,
      distributorInfo: req.body.distributorInfo,

      isActive: parseIsActive(req.body.isActive),
      categoryId: parseCategoryId(req.body.categoryId),
      cost:
        req.body.cost !== undefined && req.body.cost !== null && req.body.cost !== ""
          ? Number(req.body.cost)
          : undefined,
    });

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid data",
        errors: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    const [updated] = await db
      .update(products)
      .set({
        name: data.name,
        model: data.model,
        serialNumber: data.serialNumber,
        description: data.description,

        stock: data.stock,
        price: data.price,
        warrantyStatus: data.warrantyStatus,
        distributorInfo: data.distributorInfo,

        isActive: data.isActive,
        categoryId: data.categoryId ?? null,
        cost: data.cost ?? null,
      })
      .where(eq(products.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("PUT /products/:id error:", err);
    return res.status(500).json({ message: "Failed to update product" });
  }
});

// ------------------ DISCOUNTS ------------------
// Frontend expects POST /products/discounts
// body: { productIds: number[], discountRate: number } (0..100)
// rate 0 clears discount and restores original
const discountSchema = z.object({
  productIds: z.array(z.coerce.number().int().positive()).min(1),
  discountRate: z.coerce.number().min(0).max(100),
});

async function handleDiscount(req, res) {
  try {
    const parsed = discountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
    }

    const { productIds, discountRate } = parsed.data;

    const updatedProducts = await db.transaction(async (tx) => {
      const rows = await tx.select().from(products).where(inArray(products.id, productIds));
      if (rows.length !== productIds.length) {
        throw new Error("One or more products not found");
      }

      const out = [];

      for (const p of rows) {
        const currentPrice = Number(p.price);
        const baseOriginal =
          p.originalPrice !== null && p.originalPrice !== undefined
            ? Number(p.originalPrice)
            : currentPrice;

        if (discountRate <= 0) {
          const restoredPrice =
            p.originalPrice !== null && p.originalPrice !== undefined
              ? Number(p.originalPrice)
              : currentPrice;

          const [upd] = await tx
            .update(products)
            .set({
              price: restoredPrice.toFixed(2),
              originalPrice: null,
              discountRate: null,
            })
            .where(eq(products.id, p.id))
            .returning();

          out.push(upd);
        } else {
          const newPrice = +(baseOriginal * (1 - discountRate / 100)).toFixed(2);

          const [upd] = await tx
            .update(products)
            .set({
              originalPrice: p.originalPrice ?? baseOriginal.toFixed(2),
              discountRate: discountRate.toFixed(2),
              price: newPrice.toFixed(2),
            })
            .where(eq(products.id, p.id))
            .returning();

          out.push(upd);
        }
      }

      return out;
    });

    // Notify wishlist users (only when applying a discount > 0)
    if (discountRate > 0) {
      try {
        const wishRows = await db
          .select()
          .from(wishlistItems)
          .where(inArray(wishlistItems.productId, productIds));

        if (wishRows.length > 0) {
          const byUser = new Map(); // userId -> Set(productId)
          for (const w of wishRows) {
            if (!byUser.has(w.userId)) byUser.set(w.userId, new Set());
            byUser.get(w.userId).add(w.productId);
          }

          const userIds = Array.from(byUser.keys());
          const userRows = await db.select().from(users).where(inArray(users.id, userIds));

          const productMap = new Map(updatedProducts.map((p) => [p.id, p]));

          for (const u of userRows) {
            const pids = Array.from(byUser.get(u.id) || []);
            const discounted = pids.map((pid) => productMap.get(pid)).filter(Boolean);

            if (discounted.length > 0) {
              await sendDiscountEmail(u.email, discounted, discountRate);
            }
          }
        }
      } catch (notifyErr) {
        console.error("Discount notify error (ignored):", notifyErr);
      }
    }

    return res.json({
      message: discountRate > 0 ? "Discount applied" : "Discount removed",
      discountRate,
      updatedProducts,
    });
  } catch (err) {
    console.error("Discount endpoint error:", err);
    const msg = err?.message || "Server error";
    if (msg === "One or more products not found") {
      return res.status(400).json({ message: msg });
    }
    return res.status(500).json({ message: "Server error" });
  }
}

// ✅ Correct endpoint expected by frontend
router.post("/discounts", authMiddleware, requireSalesManagerOrAdmin, handleDiscount);
// ✅ Keep old endpoint as alias (doesn’t hurt)
router.post("/discount", authMiddleware, requireSalesManagerOrAdmin, handleDiscount);

// DELETE /products/:id (admin)
router.delete("/:id", authMiddleware, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  try {
    const [deleted] = await db.delete(products).where(eq(products.id, id)).returning();
    if (!deleted) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({ message: "Product deleted" });
  } catch (err) {
    console.error("DELETE /products/:id error:", err);
    return res.status(500).json({ message: "Failed to delete product" });
  }
});

// POST /products/:id/image (admin)
router.post(
  "/:id/image",
  authMiddleware,
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    try {
      const [updated] = await db
        .update(products)
        .set({ imageUrl })
        .where(eq(products.id, productId))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Product not found" });
      }

      return res.json({
        message: "Image uploaded successfully",
        product: updated,
      });
    } catch (err) {
      console.error("Upload product image error:", err);
      return res.status(500).json({ message: "Failed to upload image" });
    }
  }
);

module.exports = router;

const express = require("express");
const { z } = require("zod");
const { db } = require("../db");
const { products } = require("../db/schema");
const { eq, or, ilike, asc, desc } = require("drizzle-orm");
const { authMiddleware, requireAdmin } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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

const productBodySchema = z.object({
  name: z.string().min(1, "Product name is required"),

  // Required fields.
  model: z.string().min(1, "Model is required"),
  serialNumber: z.string().min(1, "Serial number is required"),
  description: z.string().min(1, "Description is required"),
  stock: z.number().int().nonnegative("Quantity in stock is required"),
  price: z.number().nonnegative("Price is required"),
  warrantyStatus: z.string().min(1, "Warranty status is required"),
  distributorInfo: z.string().min(1, "Distributor information is required"),

  // Optional but supported:
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
  }
});

const upload = multer({ storage });


// GET /products
// Public – list products with optional search + sorting
// query params:
//   q: search term (matches name or description, case-insensitive)
//   sortBy: "price" | "popularity"
//   sortOrder: "asc" | "desc"  (default: asc for price, desc for popularity)

router.get("/", async (req, res) => {
  const { q, sortBy, sortOrder } = req.query;

  try {
    let query = db.select().from(products);

    // 🔍 search by name or description (case-insensitive)
    if (q && q.trim() !== "") {
      const term = `%${q.trim()}%`;
      query = query.where(
        or(
          ilike(products.name, term),
          ilike(products.description, term)
        )
      );
    }

    // ↕️ sorting
    if (sortBy === "price") {
      query = query.orderBy(
        sortOrder === "desc" ? desc(products.price) : asc(products.price)
      );
    } else if (sortBy === "popularity") {
      // assumes a "popularity" column exists on products
      query = query.orderBy(
        sortOrder === "asc"
          ? asc(products.popularity)
          : desc(products.popularity)
      );
    } else {
      // stable default
      query = query.orderBy(asc(products.id));
    }

    const all = await query;
    return res.json(all);
  } catch (err) {
    console.error("GET /products error:", err);
    return res.status(500).json({ message: "Failed to fetch products" });
  }
});


//GET /products/:id
//Public – get single product by id
 
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  try {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id));

    if (!product) return res.status(404).json({ message: "Product not found" });

    return res.json(product);
  } catch (err) {
    console.error("GET /products/:id error:", err);
    return res.status(500).json({ message: "Failed to fetch product" });
  }
});


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
      categoryId:
        req.body.categoryId !== undefined ? Number(req.body.categoryId) : undefined,
      cost: req.body.cost !== undefined ? Number(req.body.cost) : undefined,
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
      })
      .returning();

    return res.status(201).json(created);
  } catch (err) {
    console.error("POST /products error:", err);
    return res.status(500).json({ message: "Failed to create product" });
  }
});

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
      categoryId:
        req.body.categoryId !== undefined ? Number(req.body.categoryId) : undefined,
      cost: req.body.cost !== undefined ? Number(req.body.cost) : undefined,
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

router.delete("/:id", authMiddleware, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  try {
    const [deleted] = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({ message: "Product deleted" });
  } catch (err) {
    console.error("DELETE /products/:id error:", err);
    return res.status(500).json({ message: "Failed to delete product" });
  }
});

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

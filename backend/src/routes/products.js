const express = require("express");
const { z } = require("zod");
const { db } = require("../db");
const { products } = require("../db/schema");
const { eq } = require("drizzle-orm");
const { authMiddleware, requireAdmin } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();


 //Zod schema for product creation / update
 
const productBodySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.number().nonnegative("Price must be >= 0"),
  stock: z.number().int().nonnegative("Stock must be >= 0"),
  isActive: z.boolean().optional().default(true),
});

 //Multer config for image upload
const uploadDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({ storage });


//GET /products
//Public – list all products (you can choose to filter by isActive if you want)

router.get("/", async (req, res) => {
  try {
    const all = await db.select().from(products);
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
    return res.status(400).json({ message: "Invalid product id" });
  }

  try {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id));

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json(product);
  } catch (err) {
    console.error("GET /products/:id error:", err);
    return res
      .status(500)
      .json({ message: "Failed to fetch product" });
  }
});


//POST /products
//Admin only – create a new product

router.post("/", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const parsed = productBodySchema.safeParse({
      name: req.body.name,
      description: req.body.description,
      price: Number(req.body.price),
      stock: Number(req.body.stock),
      isActive:
        typeof req.body.isActive === "boolean"
          ? req.body.isActive
          : req.body.isActive === "true",
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
        description: data.description || null,
        price: data.price, // drizzle numeric will handle conversion
        stock: data.stock,
        isActive: data.isActive,
      })
      .returning();

    return res.status(201).json(created);
  } catch (err) {
    console.error("POST /products error:", err);
    return res.status(500).json({ message: "Failed to create product" });
  }
});

//PUT /products/:id
//Admin only – update existing product

router.put("/:id", authMiddleware, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: "Invalid product id" });
  }

  try {
    const parsed = productBodySchema.safeParse({
      name: req.body.name,
      description: req.body.description,
      price: Number(req.body.price),
      stock: Number(req.body.stock),
      isActive:
        typeof req.body.isActive === "boolean"
          ? req.body.isActive
          : req.body.isActive === "true",
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
        description: data.description || null,
        price: data.price,
        stock: data.stock,
        isActive: data.isActive,
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

//DELETE /products/:id
//Admin only – delete product

router.delete(
  "/:id",
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "Invalid product id" });
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
  }
);

//POST /products/:id/image
//Admin only – upload product image, set products.imageUrl
 
router.post(
  "/:id/image",
  authMiddleware,
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ message: "Image file is required" });
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
        message: "Image uploaded",
        product: updated,
      });
    } catch (err) {
      console.error("Upload product image error:", err);
      return res
        .status(500)
        .json({ message: "Failed to upload image" });
    }
  }
);

module.exports = router;
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const { pool } = require("./db");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const cartRoutes = require("./routes/cart");
const { router: invoiceRoutes } = require("./routes/invoice");
const reviewsRoutes = require("./routes/reviews");

const app = express();

const PORT = process.env.PORT || 4000;

// Serve uploaded product images
const uploadDir = path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(uploadDir));

// Rate limiter 
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
});

// Global middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(limiter);

// Health check routes
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is running" });
});

app.get("/db-health", async (req, res) => {
  try {
    const result = await pool.query("SELECT 1");
    res.json({
      status: "ok",
      db: true,
      raw: result.rows,
    });
  } catch (err) {
    console.error("DB health check failed:", err);
    res.status(500).json({
      status: "error",
      db: false,
      message: err.message,
    });
  }
});

// API routes
app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/cart", cartRoutes);
app.use("/invoice", invoiceRoutes);
app.use("/reviews", reviewsRoutes);

// Seed default roles on startup
async function ensureDefaultRoles() {
  const query = `
    INSERT INTO roles (name) VALUES
      ('admin'),
      ('customer'),
      ('support'),
      ('sales_manager'),
      ('product_manager')
    ON CONFLICT (name) DO NOTHING;
  `;

  try {
    await pool.query(query);
    console.log("Default roles ensured");
  } catch (err) {
    console.error("Failed to ensure default roles:", err);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  ensureDefaultRoles();
});

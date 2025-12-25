require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const { pool } = require("./db");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const cartRoutes = require("./routes/cart");

// ✅ FIX: invoiceRoutes must be a Router function
const invoiceRoutes = require("./routes/invoice");

const reviewsRoutes = require("./routes/reviews");
const wishlistRoutes = require("./routes/wishlist");
const analyticsRoutes = require("./routes/analytics");

const app = express();
const PORT = process.env.PORT || 4000;

app.set("trust proxy", 1);

// Serve uploaded product images
const uploadDir = path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(uploadDir));

// Global middlewares
app.use(helmet());

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

// Rate limiter only in production
if (process.env.NODE_ENV === "production") {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
  });

  app.use(
    [
      "/auth",
      "/products",
      "/orders",
      "/cart",
      "/invoice",
      "/reviews",
      "/wishlist",
      "/analytics",
    ],
    limiter
  );
}

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
app.use("/wishlist", wishlistRoutes);
app.use("/analytics", analyticsRoutes);

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

// Create HTTP server and attach Socket.io
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// In-memory support chat state
const activeChats = new Map();
const supportNamespace = io.of("/support");

supportNamespace.on("connection", (socket) => {
  const role = socket.handshake.query.role || "customer";
  const displayName = socket.handshake.query.name || "Guest";

  console.log(`[support] socket connected: ${socket.id} (role=${role})`);

  if (role === "admin") {
    socket.join("admins");
    socket.emit("active_chats", Array.from(activeChats.values()));
  } else {
    const chatId = socket.handshake.query.chatId || socket.id;

    socket.join(chatId);

    const chatInfo = {
      chatId,
      customerName: displayName,
      createdAt: new Date().toISOString(),
    };

    activeChats.set(chatId, chatInfo);

    socket.emit("chat_joined", chatInfo);
    supportNamespace
      .to("admins")
      .emit("active_chats", Array.from(activeChats.values()));
  }

  if (role === "admin") {
    socket.on("admin_join_chat", ({ chatId }) => {
      if (!chatId) return;
      socket.join(chatId);
      socket.emit("joined_chat", { chatId });
    });
  }

  socket.on("customer_message", ({ chatId, message }) => {
    if (!chatId || !message) return;
    supportNamespace.to(chatId).emit("message", {
      chatId,
      from: "customer",
      message,
      at: new Date().toISOString(),
    });
  });

  socket.on("admin_message", ({ chatId, message }) => {
    if (!chatId || !message) return;
    supportNamespace.to(chatId).emit("message", {
      chatId,
      from: "admin",
      message,
      at: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    console.log(`[support] socket disconnected: ${socket.id} (role=${role})`);
    if (role !== "admin") {
      const possibleChatId = socket.handshake.query.chatId || socket.id;
      if (activeChats.has(possibleChatId)) {
        activeChats.delete(possibleChatId);
        supportNamespace
          .to("admins")
          .emit("active_chats", Array.from(activeChats.values()));
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  ensureDefaultRoles();
});

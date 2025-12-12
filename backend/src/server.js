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
const { router: invoiceRoutes } = require("./routes/invoice");
const reviewsRoutes = require("./routes/reviews");

const app = express();
const PORT = process.env.PORT || 4000;

// If you ever run behind a proxy (Render/Heroku/Nginx), rate-limit needs this.
// Safe locally too.
app.set("trust proxy", 1);

// Serve uploaded product images
const uploadDir = path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(uploadDir));

// Global middlewares
app.use(helmet());

// CORS: keep it open if you want, but this version is safer for dev.
// If you use cookies, you must set credentials: true and specify origin explicitly.
app.use(
  cors({
    origin: true, // reflects request origin
    credentials: true,
  })
);

app.use(express.json());

// ✅ Rate limiter
// - In development: disabled (so React dev / HMR won’t trigger 429)
// - In production: enabled
if (process.env.NODE_ENV === "production") {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // adjust as needed
    standardHeaders: true, // adds RateLimit-* headers
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
    // Optional: ignore localhost/internal traffic if needed
    // skip: (req) => req.ip === "127.0.0.1" || req.ip === "::1",
  });

  // Apply only to API routes (not uploads/health) to reduce accidental blocks
  app.use(["/auth", "/products", "/orders", "/cart", "/invoice", "/reviews"], limiter);
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
    origin: "*", // ok for testing
    methods: ["GET", "POST"],
  },
});

// In-memory support chat state
const activeChats = new Map(); // chatId -> { chatId, customerName, createdAt }
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

    supportNamespace.to("admins").emit("active_chats", Array.from(activeChats.values()));
  }

  // Admin joins a chat room
  if (role === "admin") {
    socket.on("admin_join_chat", ({ chatId }) => {
      if (!chatId) return;
      console.log(`[support] admin ${socket.id} joined chat ${chatId}`);
      socket.join(chatId);
      socket.emit("joined_chat", { chatId });
    });
  }

  // Customer sends a message
  socket.on("customer_message", ({ chatId, message }) => {
    if (!chatId || !message) return;

    const payload = {
      chatId,
      from: "customer",
      message,
      at: new Date().toISOString(),
    };

    supportNamespace.to(chatId).emit("message", payload);
  });

  // Admin sends a message
  socket.on("admin_message", ({ chatId, message }) => {
    if (!chatId || !message) return;

    const payload = {
      chatId,
      from: "admin",
      message,
      at: new Date().toISOString(),
    };

    supportNamespace.to(chatId).emit("message", payload);
  });

  socket.on("disconnect", () => {
    console.log(`[support] socket disconnected: ${socket.id} (role=${role})`);

    if (role !== "admin") {
      const possibleChatId = socket.handshake.query.chatId || socket.id;

      if (activeChats.has(possibleChatId)) {
        activeChats.delete(possibleChatId);

        supportNamespace.to("admins").emit("active_chats", Array.from(activeChats.values()));
      }
    }
  });
});

// Start server with Socket.io attached
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  ensureDefaultRoles();
});

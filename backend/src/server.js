require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { ensureDefaultCategories } = require("./utils/ensureCategories");

const { pool } = require("./db");
const http = require("http");
const { Server } = require("socket.io");

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

// Create HTTP server and attach Socket.io
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",              // allow all origins for testing
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
    // Admin joins special room so we can broadcast updates to all admins
    socket.join("admins");

    // Send current active chats to this admin
    socket.emit(
      "active_chats",
      Array.from(activeChats.values())
    );
  } else {
    // Customer flow
    const chatId = socket.handshake.query.chatId || socket.id;

    socket.join(chatId);

    const chatInfo = {
      chatId,
      customerName: displayName,
      createdAt: new Date().toISOString(),
    };

    activeChats.set(chatId, chatInfo);

    // Tell this customer their chat info
    socket.emit("chat_joined", chatInfo);

    // Notify all admins that active chats changed
    supportNamespace.to("admins").emit(
      "active_chats",
      Array.from(activeChats.values())
    );
  }

    // ⭐ NEW: admin joins a chat room
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

    // 1) Send to everyone in that chat room (customer + joined admins)
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

    // If a customer disconnects, remove their chat and notify admins
    if (role !== "admin") {
      const possibleChatId =
        socket.handshake.query.chatId || socket.id;

      if (activeChats.has(possibleChatId)) {
        activeChats.delete(possibleChatId);

        supportNamespace.to("admins").emit(
          "active_chats",
          Array.from(activeChats.values())
        );
      }
    }
  });
});

// Start server with Socket.io attached
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  ensureDefaultRoles();
});


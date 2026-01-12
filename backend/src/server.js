require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const { db, pool } = require("./db");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const cartRoutes = require("./routes/cart");
const categoriesRouter = require("./routes/categories");
const invoiceRoutes = require("./routes/invoice");
const reviewsRoutes = require("./routes/reviews");
const wishlistRoutes = require("./routes/wishlist");
const analyticsRoutes = require("./routes/analytics");
const chatRoutes = require("./routes/chat");
const returnRoutes = require("./routes/returns");

const { conversations, messages, roles } = require("./db/schema");
const { eq, and, isNull } = require("drizzle-orm");

const app = express();
const PORT = process.env.PORT || 4000;

app.set("trust proxy", 1);

const uploadDir = path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(uploadDir));

app.use(helmet());
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use("/api/returns", returnRoutes);
app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/categories", categoriesRouter);
app.use("/orders", orderRoutes);
app.use("/cart", cartRoutes);
app.use("/invoice", invoiceRoutes);
app.use("/reviews", reviewsRoutes);
app.use("/wishlist", wishlistRoutes);
app.use("/chat", chatRoutes);
app.use("/analytics", analyticsRoutes);

app.get("/health", (_, res) => res.json({ status: "ok" }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.set("io", io);

function roomName(conversationId) {
  return `conversation:${conversationId}`;
}

function ensureString(v) {
  return typeof v === "string" ? v.trim() : "";
}

function parseSocketAuth(socket) {
  const auth = socket.handshake.auth || {};
  const token = ensureString(auth.token);
  const guestToken = ensureString(auth.guestToken) || null;

  let user = null;
  if (token) {
    try {
      user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      user = null;
    }
  }
  return { user, guestToken };
}

async function canAccessConversation(
  { user, guestToken },
  conv,
  { requireAssignedForSupportSend = true } = {}
) {
  if (!conv) return { ok: false, error: "Conversation not found" };

  if (user?.roleName === "support") {
    const isAssigned = conv.assignedAgentId && Number(conv.assignedAgentId) === Number(user.id);
    const isUnclaimedOpen = conv.status === "open" && !conv.assignedAgentId;

    if (!isAssigned && !isUnclaimedOpen) return { ok: false, error: "Access denied" };

    if (requireAssignedForSupportSend && !isAssigned) {
      return { ok: false, error: "Not assigned to this conversation" };
    }
    return { ok: true };
  }

  if (user?.id) {
    if (!conv.customerUserId || Number(conv.customerUserId) !== Number(user.id)) {
      return { ok: false, error: "Access denied" };
    }
    return { ok: true };
  }

  if (!guestToken || !conv.guestToken || guestToken !== conv.guestToken) {
    return { ok: false, error: "Access denied" };
  }
  return { ok: true };
}

io.on("connection", (socket) => {
  const { user, guestToken } = parseSocketAuth(socket);
  socket.user = user;
  socket.guestToken = guestToken;

  if (socket.user?.roleName === "support") {
    socket.join("support_agents");
  }

  socket.on("queue_request", async (_, ack) => {
    try {
      if (socket.user?.roleName !== "support") {
        return ack?.({ ok: false, error: "Access denied" });
      }

      const data = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.status, "open"), isNull(conversations.assignedAgentId)))
        .orderBy(conversations.createdAt);

      return ack?.({ ok: true, queue: data });
    } catch (err) {
      console.error("queue_request error:", err);
      return ack?.({ ok: false, error: "Failed to load queue" });
    }
  });

  socket.on("conversation_claim", async ({ conversationId }, ack) => {
    try {
      if (socket.user?.roleName !== "support") {
        return ack?.({ ok: false, error: "Access denied" });
      }

      const id = Number(conversationId);
      if (!Number.isInteger(id) || id <= 0) {
        return ack?.({ ok: false, error: "Invalid conversationId" });
      }

      const updatedRows = await db
        .update(conversations)
        .set({
          assignedAgentId: socket.user.id,
          status: "claimed",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(conversations.id, id),
            isNull(conversations.assignedAgentId),
            eq(conversations.status, "open")
          )
        )
        .returning();

      const updated = updatedRows?.[0] || null;
      if (!updated) return ack?.({ ok: false, error: "Conversation already claimed" });

      // Make sure claimer is in the room immediately (prevents “message not showing”)
      socket.join(roomName(id));

      io.to("support_agents").emit("queue_updated", { type: "claimed", conversation: updated });
      return ack?.({ ok: true, conversation: updated });
    } catch (err) {
      console.error("conversation_claim error:", err);
      return ack?.({ ok: false, error: "Claim failed" });
    }
  });

  socket.on("join_conversation", async ({ conversationId }, ack) => {
    try {
      const id = Number(conversationId);
      if (!Number.isInteger(id) || id <= 0) {
        return ack?.({ ok: false, error: "Invalid conversationId" });
      }

      const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
      const access = await canAccessConversation(
        { user: socket.user, guestToken: socket.guestToken },
        conv,
        { requireAssignedForSupportSend: false }
      );
      if (!access.ok) return ack?.({ ok: false, error: access.error });

      socket.join(roomName(id));
      return ack?.({ ok: true });
    } catch (err) {
      console.error("join_conversation error:", err);
      return ack?.({ ok: false, error: "Join failed" });
    }
  });

  socket.on("message_send", async ({ conversationId, text }, ack) => {
    try {
      const id = Number(conversationId);
      if (!Number.isInteger(id) || id <= 0) {
        return ack?.({ ok: false, error: "Invalid conversationId" });
      }

      const t = ensureString(text);
      if (!t) return ack?.({ ok: false, error: "Message text required" });

      const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
      if (!conv) return ack?.({ ok: false, error: "Conversation not found" });

      if (conv.status === "closed") return ack?.({ ok: false, error: "Conversation is closed" });

      const access = await canAccessConversation(
        { user: socket.user, guestToken: socket.guestToken },
        conv,
        { requireAssignedForSupportSend: true }
      );
      if (!access.ok) return ack?.({ ok: false, error: access.error });

      // ✅ CRITICAL: ensure sender is actually in the room before emit
      socket.join(roomName(id));

      const senderRole =
        socket.user?.roleName === "support" ? "support" : socket.user ? "customer" : "guest";

      const [msg] = await db
        .insert(messages)
        .values({
          conversationId: id,
          senderRole,
          senderUserId: socket.user?.id ?? null,
          text: t,
          createdAt: new Date(),
        })
        .returning();

      await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, id));

      io.to(roomName(id)).emit("message_new", msg);

      // ✅ return the message too (UI can append even if socket events lag)
      return ack?.({ ok: true, message: msg });
    } catch (err) {
      console.error("message_send error:", err);
      return ack?.({ ok: false, error: "Send failed" });
    }
  });

  socket.on("typing", async ({ conversationId, isTyping }, ack) => {
    try {
      const id = Number(conversationId);
      if (!Number.isInteger(id) || id <= 0) {
        return ack?.({ ok: false, error: "Invalid conversationId" });
      }

      const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
      const access = await canAccessConversation(
        { user: socket.user, guestToken: socket.guestToken },
        conv,
        { requireAssignedForSupportSend: false }
      );
      if (!access.ok) return ack?.({ ok: false, error: access.error });

      socket.to(roomName(id)).emit("typing", {
        conversationId: id,
        isTyping: Boolean(isTyping),
        role: socket.user?.roleName === "support" ? "support" : socket.user ? "customer" : "guest",
      });

      return ack?.({ ok: true });
    } catch (err) {
      console.error("typing error:", err);
      return ack?.({ ok: false, error: "Typing failed" });
    }
  });

  socket.on("message_read", async ({ conversationId, messageId }, ack) => {
    try {
      const cid = Number(conversationId);
      const mid = Number(messageId);
      if (!Number.isInteger(cid) || cid <= 0) return ack?.({ ok: false, error: "Invalid conversationId" });
      if (!Number.isInteger(mid) || mid <= 0) return ack?.({ ok: false, error: "Invalid messageId" });

      const [conv] = await db.select().from(conversations).where(eq(conversations.id, cid));
      const access = await canAccessConversation(
        { user: socket.user, guestToken: socket.guestToken },
        conv,
        { requireAssignedForSupportSend: false }
      );
      if (!access.ok) return ack?.({ ok: false, error: access.error });

      const [msg] = await db.select().from(messages).where(eq(messages.id, mid));
      if (!msg || Number(msg.conversationId) !== cid) return ack?.({ ok: false, error: "Message not found" });

      socket.to(roomName(cid)).emit("message_read", {
        conversationId: cid,
        messageId: mid,
        role: socket.user?.roleName === "support" ? "support" : socket.user ? "customer" : "guest",
      });

      return ack?.({ ok: true });
    } catch (err) {
      console.error("message_read error:", err);
      return ack?.({ ok: false, error: "Read receipt failed" });
    }
  });
});

async function ensureDefaultRoles() {
  const query = `
    INSERT INTO roles (name) VALUES
      ('customer'),
      ('support'),
      ('sales_manager'),
      ('product_manager')
    ON CONFLICT (name) DO NOTHING;
  `;

  try {
    await pool.query(query);
    console.log("Default roles ensured.");
  } catch (err) {
    console.error("Failed to ensure default roles:", err);
  }
}

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  ensureDefaultRoles();
});

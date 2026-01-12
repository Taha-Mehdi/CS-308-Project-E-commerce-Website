const express = require("express");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const router = express.Router();

const { db } = require("../db");
const {
  conversations,
  messages,
  users,
  products,
  wishlistItems,
  cartItems,
  orders,
  orderItems,
  returnRequests,
} = require("../db/schema");

const { eq, and, ne, desc, inArray, isNull } = require("drizzle-orm");

const {
  authMiddleware,
  optionalAuthMiddleware,
  requireSupport,
} = require("../middleware/auth");

/* =========================
   Helpers
========================= */

function getGuestToken(req) {
  const t = req.headers["x-guest-token"] || req.query.guestToken;
  if (!t) return null;
  if (typeof t !== "string") return null;
  const v = t.trim();
  return v.length ? v : null;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function requireConversationAccess(req, res, conversationId) {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId));

  if (!conv) {
    res.status(404).json({ message: "Conversation not found" });
    return null;
  }

  // Support passes here; assignment checks happen per-route when needed.
  if (req.user?.roleName === "support") return conv;

  // Logged-in customer must match
  if (
    req.user?.id &&
    conv.customerUserId &&
    Number(conv.customerUserId) === Number(req.user.id)
  ) {
    return conv;
  }

  // Guest must match guestToken
  const guestToken = getGuestToken(req);
  if (!req.user && guestToken && conv.guestToken && guestToken === conv.guestToken) {
    return conv;
  }

  res.status(403).json({ message: "Access denied" });
  return null;
}

/* =========================
   Attachments (PRIVATE storage)
   - Not served by express.static
========================= */

const CHAT_PRIVATE_DIR = path.join(__dirname, "..", "..", "private_uploads", "chat");
ensureDir(CHAT_PRIVATE_DIR);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, CHAT_PRIVATE_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 16);
      const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || "").toLowerCase();
    const ok =
      mime.startsWith("image/") ||
      mime.startsWith("video/") ||
      mime === "application/pdf";
    if (!ok) return cb(new Error("Unsupported file type"));
    return cb(null, true);
  },
});

/* =========================
   Support routes FIRST
========================= */

router.get("/queue", authMiddleware, requireSupport, async (req, res) => {
  try {
    const data = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.status, "open"), isNull(conversations.assignedAgentId)))
      .orderBy(conversations.createdAt);

    res.json(data);
  } catch (err) {
    console.error("Chat queue error:", err);
    res.status(500).json({ message: "Failed to load chat queue" });
  }
});

router.post("/:id/claim", authMiddleware, requireSupport, async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return res.status(400).json({ message: "Invalid ID" });
  }

  try {
    const updatedRows = await db
      .update(conversations)
      .set({
        assignedAgentId: req.user.id,
        status: "claimed",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          isNull(conversations.assignedAgentId),
          eq(conversations.status, "open")
        )
      )
      .returning();

    const updated = updatedRows?.[0] || null;
    if (!updated) return res.status(409).json({ message: "Conversation already claimed" });

    // Notify support dashboards
    const io = req.app.get("io");
    if (io) io.to("support_agents").emit("queue_updated", { type: "claimed", conversation: updated });

    res.json(updated);
  } catch (err) {
    console.error("Claim chat error:", err);
    res.status(500).json({ message: "Failed to claim chat" });
  }
});

router.post("/:id/close", authMiddleware, requireSupport, async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return res.status(400).json({ message: "Invalid ID" });
  }

  try {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
    if (!conv) return res.status(404).json({ message: "Conversation not found" });

    const isAssigned =
      conv.assignedAgentId && Number(conv.assignedAgentId) === Number(req.user.id);
    if (!isAssigned) return res.status(403).json({ message: "Not assigned to this conversation" });

    await db
      .update(conversations)
      .set({ status: "closed", updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    const io = req.app.get("io");
    if (io) io.to("support_agents").emit("queue_updated", { type: "closed", conversationId });

    res.json({ message: "Conversation closed" });
  } catch (err) {
    console.error("Close chat error:", err);
    res.status(500).json({ message: "Failed to close conversation" });
  }
});

router.post("/:id/reopen", authMiddleware, requireSupport, async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return res.status(400).json({ message: "Invalid ID" });
  }

  try {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
    if (!conv) return res.status(404).json({ message: "Conversation not found" });

    const isAssigned =
      conv.assignedAgentId && Number(conv.assignedAgentId) === Number(req.user.id);
    if (!isAssigned) return res.status(403).json({ message: "Not assigned to this conversation" });

    await db
      .update(conversations)
      .set({ status: "claimed", updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    res.json({ message: "Conversation reopened" });
  } catch (err) {
    console.error("Reopen chat error:", err);
    res.status(500).json({ message: "Failed to reopen conversation" });
  }
});

/* =========================
   Customer + guest routes
========================= */

router.post("/start", optionalAuthMiddleware, async (req, res) => {
  try {
    const forceNew =
      String(req.query.forceNew || "") === "1" || Boolean(req.body?.forceNew);

    const userId = req.user?.id ?? null;
    const incomingGuestToken = !userId ? getGuestToken(req) : null;
    const guestToken = userId ? null : (incomingGuestToken ?? crypto.randomUUID());

    if (!forceNew) {
      if (userId) {
        const existing = await db
          .select()
          .from(conversations)
          .where(and(eq(conversations.customerUserId, userId), ne(conversations.status, "closed")))
          .orderBy(desc(conversations.createdAt))
          .limit(1);

        if (existing?.[0]) return res.status(200).json(existing[0]);
      }

      if (!userId && guestToken) {
        const existing = await db
          .select()
          .from(conversations)
          .where(and(eq(conversations.guestToken, guestToken), ne(conversations.status, "closed")))
          .orderBy(desc(conversations.createdAt))
          .limit(1);

        if (existing?.[0]) return res.status(200).json(existing[0]);
      }
    } else {
      if (userId) {
        await db
          .update(conversations)
          .set({ status: "closed", updatedAt: new Date() })
          .where(
            and(
              eq(conversations.customerUserId, userId),
              eq(conversations.status, "open"),
              isNull(conversations.assignedAgentId)
            )
          );
      } else if (guestToken) {
        await db
          .update(conversations)
          .set({ status: "closed", updatedAt: new Date() })
          .where(
            and(
              eq(conversations.guestToken, guestToken),
              eq(conversations.status, "open"),
              isNull(conversations.assignedAgentId)
            )
          );
      }
    }

    const [conversation] = await db
      .insert(conversations)
      .values({
        customerUserId: userId,
        guestToken,
        status: "open",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // ✅ REAL-TIME: immediately notify all support agents a new chat is waiting
    const io = req.app.get("io");
    if (io) {
      io.to("support_agents").emit("queue_new", conversation);
      io.to("support_agents").emit("queue_updated", { type: "new", conversation });
    }

    res.status(201).json(conversation);
  } catch (err) {
    console.error("Chat start error:", err);
    res.status(500).json({ message: "Failed to start chat" });
  }
});

router.post("/link", authMiddleware, async (req, res) => {
  try {
    const guestToken = typeof req.body?.guestToken === "string" ? req.body.guestToken.trim() : "";
    if (!guestToken) return res.status(400).json({ message: "guestToken is required" });

    const userId = Number(req.user.id);

    const linkedRows = await db
      .update(conversations)
      .set({
        customerUserId: userId,
        guestToken: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.guestToken, guestToken),
          isNull(conversations.customerUserId),
          ne(conversations.status, "closed")
        )
      )
      .returning({ id: conversations.id });

    return res.json({ ok: true, linked: linkedRows?.length || 0 });
  } catch (err) {
    console.error("Chat link error:", err);
    return res.status(500).json({ message: "Failed to link guest chat" });
  }
});

router.get("/:id/messages", optionalAuthMiddleware, async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return res.status(400).json({ message: "Invalid ID" });
  }

  try {
    const conv = await requireConversationAccess(req, res, conversationId);
    if (!conv) return;

    if (req.user?.roleName === "support") {
      const isAssigned =
        conv.assignedAgentId && Number(conv.assignedAgentId) === Number(req.user.id);
      const isUnclaimedOpen = conv.status === "open" && !conv.assignedAgentId;
      if (!isAssigned && !isUnclaimedOpen) {
        return res.status(403).json({ message: "Not assigned to this conversation" });
      }
    }

    const data = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    res.json(data);
  } catch (err) {
    console.error("Fetch messages error:", err);
    res.status(500).json({ message: "Failed to load messages" });
  }
});

router.post("/:id/attachments", optionalAuthMiddleware, upload.single("file"), async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return res.status(400).json({ message: "Invalid ID" });
  }

  try {
    const conv = await requireConversationAccess(req, res, conversationId);
    if (!conv) return;

    if (conv.status === "closed") return res.status(409).json({ message: "Conversation is closed" });

    if (req.user?.roleName === "support") {
      const isAssigned =
        conv.assignedAgentId && Number(conv.assignedAgentId) === Number(req.user.id);
      if (!isAssigned) return res.status(403).json({ message: "Not assigned to this conversation" });
    }

    if (!req.file) return res.status(400).json({ message: "File is required" });

    const senderRole =
      req.user?.roleName === "support" ? "support" : req.user ? "customer" : "guest";

    const optionalText = typeof req.body?.text === "string" ? req.body.text.trim() : null;

    const [msg] = await db
      .insert(messages)
      .values({
        conversationId,
        senderRole,
        senderUserId: req.user?.id ?? null,
        text: optionalText && optionalText.length ? optionalText : null,
        attachmentUrl: req.file.filename,
        attachmentName: req.file.originalname,
        attachmentMime: req.file.mimetype,
        attachmentSize: req.file.size,
        createdAt: new Date(),
      })
      .returning();

    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));

    const io = req.app.get("io");
    if (io) io.to(`conversation:${conversationId}`).emit("message_new", msg);

    res.status(201).json(msg);
  } catch (err) {
    console.error("Upload attachment error:", err);
    res.status(500).json({ message: err?.message || "Upload failed" });
  }
});

router.get("/attachments/:messageId", optionalAuthMiddleware, async (req, res) => {
  const messageId = Number(req.params.messageId);
  if (!Number.isInteger(messageId) || messageId <= 0) {
    return res.status(400).json({ message: "Invalid messageId" });
  }

  try {
    const [msg] = await db.select().from(messages).where(eq(messages.id, messageId));
    if (!msg) return res.status(404).json({ message: "Attachment not found" });

    if (!msg.attachmentUrl) return res.status(404).json({ message: "No attachment for this message" });

    const conv = await requireConversationAccess(req, res, Number(msg.conversationId));
    if (!conv) return;

    if (req.user?.roleName === "support") {
      const isAssigned =
        conv.assignedAgentId && Number(conv.assignedAgentId) === Number(req.user.id);
      if (!isAssigned) return res.status(403).json({ message: "Not assigned to this conversation" });
    }

    const filename = path.basename(String(msg.attachmentUrl));
    const abs = path.join(CHAT_PRIVATE_DIR, filename);

    if (!fs.existsSync(abs)) return res.status(404).json({ message: "File missing on server" });

    res.setHeader("Content-Type", msg.attachmentMime || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${String(msg.attachmentName || "attachment").replaceAll('"', "")}"`
    );

    return res.sendFile(abs);
  } catch (err) {
    console.error("Download attachment error:", err);
    return res.status(500).json({ message: "Failed to download attachment" });
  }
});

router.get("/:id/context", authMiddleware, requireSupport, async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return res.status(400).json({ message: "Invalid ID" });
  }

  try {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
    if (!conv) return res.status(404).json({ message: "Conversation not found" });

    const isAssigned =
      conv.assignedAgentId && Number(conv.assignedAgentId) === Number(req.user.id);
    if (!isAssigned) return res.status(403).json({ message: "Not assigned to this conversation" });

    if (!conv.customerUserId) {
      return res.json({ user: null, wishlist: [], cart: [], orders: [], orderItems: [], returns: [] });
    }

    const userId = Number(conv.customerUserId);

    const [profile] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        address: users.address,
        accountBalance: users.accountBalance,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId));

    const wishlist = await db
      .select({
        id: products.id,
        name: products.name,
        price: products.price,
        imageUrl: products.imageUrl,
      })
      .from(wishlistItems)
      .innerJoin(products, eq(products.id, wishlistItems.productId))
      .where(eq(wishlistItems.userId, userId));

    const cart = await db
      .select({
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        name: products.name,
        price: products.price,
        imageUrl: products.imageUrl,
        stock: products.stock,
        isActive: products.isActive,
      })
      .from(cartItems)
      .innerJoin(products, eq(products.id, cartItems.productId))
      .where(eq(cartItems.userId, userId));

    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
      .limit(10);

    const orderIds = userOrders.map((o) => o.id);

    let items = [];
    if (orderIds.length) {
      items = await db
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          productId: orderItems.productId,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
        })
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds));
    }

    const returns = await db
      .select()
      .from(returnRequests)
      .where(eq(returnRequests.customerId, userId))
      .orderBy(desc(returnRequests.requestedAt))
      .limit(25);

    res.json({
      user: profile || null,
      wishlist,
      cart,
      orders: userOrders,
      orderItems: items,
      returns,
    });
  } catch (err) {
    console.error("Chat context error:", err);
    res.status(500).json({ message: "Failed to load chat context" });
  }
});

module.exports = router;

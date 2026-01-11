const express = require("express");
const router = express.Router();

const { db } = require("../db");
const { conversations, messages, wishlistItems, products } = require("../db/schema");
const { eq, and, isNull } = require("drizzle-orm");

const {
  authMiddleware,
  optionalAuthMiddleware,
  requireSupport,
} = require("../middleware/auth");



/* =========================
   CUSTOMER ROUTES
========================= */

// Start a new chat (guest or logged-in)
router.post("/start", optionalAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id ?? null;
    const guestToken = userId ? null : crypto.randomUUID();

    const [conversation] = await db
      .insert(conversations)
      .values({
        customerUserId: userId,
        guestToken,
        status: "open",
      })
      .returning();

    res.status(201).json(conversation);
  } catch (err) {
    console.error("Chat start error:", err);
    res.status(500).json({ message: "Failed to start chat" });
  }
});

// Get messages for a conversation
router.get("/:id/messages", optionalAuthMiddleware, async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!conversationId) return res.status(400).json({ message: "Invalid ID" });

  try {
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

// Send message (REST fallback, optional)
router.post("/:id/message", optionalAuthMiddleware, async (req, res) => {
  const conversationId = Number(req.params.id);
  const { text } = req.body;

  if (!text) return res.status(400).json({ message: "Message text required" });

  try {
    const [msg] = await db
      .insert(messages)
      .values({
        conversationId,
        senderRole: req.user ? "customer" : "guest",
        senderUserId: req.user?.id ?? null,
        text,
      })
      .returning();

    res.status(201).json(msg);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

/* =========================
   AGENT ROUTES
========================= */

// List open/unclaimed chats
router.get("/queue", authMiddleware, requireSupport, async (req, res) => {
  try {
    const data = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.status, "open"),
          isNull(conversations.assignedAgentId)
        )
      );

    res.json(data);
  } catch (err) {
    console.error("Chat queue error:", err);
    res.status(500).json({ message: "Failed to load chat queue" });
  }
});

// Claim a conversation
router.post("/:id/claim", authMiddleware, requireSupport, async (req, res) => {
  const conversationId = Number(req.params.id);

  try {
    const [updated] = await db
      .update(conversations)
      .set({
        assignedAgentId: req.user.id,
        status: "claimed",
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("Claim chat error:", err);
    res.status(500).json({ message: "Failed to claim chat" });
  }
});

// Close a conversation
router.post("/:id/close", authMiddleware, requireSupport, async (req, res) => {
  const conversationId = Number(req.params.id);

  try {
    await db
      .update(conversations)
      .set({ status: "closed" })
      .where(eq(conversations.id, conversationId));

    res.json({ message: "Conversation closed" });
  } catch (err) {
    console.error("Close chat error:", err);
    res.status(500).json({ message: "Failed to close chat" });
  }
});

/* =========================
   AGENT CONTEXT (REQ #13)
========================= */

router.get("/:id/context", authMiddleware, requireSupport, async (req, res) => {
  const conversationId = Number(req.params.id);

  try {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));

    if (!conv?.customerUserId) {
      return res.json({ user: null, wishlist: [] });
    }

    const wishlist = await db
      .select({
        id: products.id,
        name: products.name,
      })
      .from(wishlistItems)
      .innerJoin(products, eq(products.id, wishlistItems.productId))
      .where(eq(wishlistItems.userId, conv.customerUserId));

    res.json({
      userId: conv.customerUserId,
      wishlist,
    });
  } catch (err) {
    console.error("Chat context error:", err);
    res.status(500).json({ message: "Failed to load chat context" });
  }
});

module.exports = router;


"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { downloadChatAttachmentOpen } from "../lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
        {title}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function AttachmentChip({ label, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80 hover:bg-white/10 transition"
      title="Open attachment"
    >
      <span className="rounded-full bg-black/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
        File
      </span>
      <span className="truncate max-w-[260px]">{label || "Attachment"}</span>
    </button>
  );
}

export default function SupportChatPanel({
  socket,
  token,
  conversation,
  onBack,
  onCloseConversationUI,
}) {
  const conversationId = conversation?.id;

  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [context, setContext] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);

  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [typingState, setTypingState] = useState({ active: false, role: null });
  const [joined, setJoined] = useState(false);

  const [showContext, setShowContext] = useState(true);

  const fileRef = useRef(null);

  // scroll handling
  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  const headerAuth = useMemo(() => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  // reset when conversation changes
  useEffect(() => {
    setMessages([]);
    setText("");
    setError("");
    setTypingState({ active: false, role: null });
    setJoined(false);
    setStickToBottom(true);
  }, [conversationId]);

  // detect whether user is near bottom (prevents yanking scroll)
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const onScroll = () => {
      const threshold = 100;
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      setStickToBottom(dist < threshold);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => el.removeEventListener("scroll", onScroll);
  }, [conversationId, showContext]);

  const scrollToBottom = (behavior = "auto") => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ block: "end", behavior });
  };

  // scroll to bottom on new messages only if user is at bottom
  useEffect(() => {
    if (stickToBottom) {
      requestAnimationFrame(() => scrollToBottom("auto"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // ✅ Load message history (backend returns ARRAY)
  useEffect(() => {
    if (!conversationId) return;
    let alive = true;

    async function run() {
      setLoadingHistory(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/chat/${conversationId}/messages`, {
          headers: headerAuth,
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load messages");

        const body = await res.json();

        const arr = Array.isArray(body)
          ? body
          : Array.isArray(body?.messages)
          ? body.messages
          : [];

        if (!alive) return;
        setMessages(arr);

        requestAnimationFrame(() => scrollToBottom("auto"));
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load messages");
      } finally {
        if (alive) setLoadingHistory(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [conversationId, headerAuth]);

  // Context
  useEffect(() => {
    if (!conversationId) return;
    let alive = true;

    async function run() {
      setLoadingContext(true);
      try {
        const res = await fetch(`${API_BASE}/chat/${conversationId}/context`, {
          headers: headerAuth,
          cache: "no-store",
        });

        if (!res.ok) {
          if (!alive) return;
          setContext(null);
          return;
        }

        const body = await res.json().catch(() => ({}));
        if (!alive) return;
        setContext(body || null);
      } catch {
        if (!alive) return;
        setContext(null);
      } finally {
        if (alive) setLoadingContext(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [conversationId, headerAuth]);

  // ✅ Socket subscription (also fixes conversationId type mismatch)
  useEffect(() => {
    if (!socket || !conversationId) return;

    const cid = Number(conversationId);
    setJoined(false);

    socket.emit("join_conversation", { conversationId: cid });
    setJoined(true);

    const onNewMessage = (payload) => {
      if (!payload) return;
      const incomingCid = Number(payload.conversationId);
      if (incomingCid !== cid) return;

      setMessages((prev) => {
        if (payload.id && prev.some((x) => x.id === payload.id)) return prev;
        return [...prev, payload];
      });

      if (stickToBottom) {
        requestAnimationFrame(() => scrollToBottom("smooth"));
      }
    };

    const onTyping = ({ conversationId: incoming, active, role }) => {
      if (Number(incoming) !== cid) return;
      setTypingState({ active: !!active, role: role || null });
    };

    socket.on("message_new", onNewMessage);
    socket.on("typing", onTyping);

    return () => {
      socket.off("message_new", onNewMessage);
      socket.off("typing", onTyping);
    };
  }, [socket, conversationId, stickToBottom]);

  async function sendText() {
    if (!socket || !conversationId) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    setError("");
    setText("");

    const tmpId = `tmp-${Date.now()}`;
    const optimistic = {
      id: tmpId,
      conversationId: Number(conversationId),
      senderRole: "support",
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    requestAnimationFrame(() => scrollToBottom("smooth"));

    socket.emit(
      "message_send",
      { conversationId: Number(conversationId), text: trimmed },
      (res) => {
        if (!res?.ok) {
          setError(res?.error || "Failed to send message");
          setMessages((prev) => prev.filter((m) => m.id !== tmpId));
        }
      }
    );
  }

  // ✅ Upload using backend endpoint: POST /chat/:id/attachments
  async function sendAttachment(file) {
    if (!file || !conversationId) return;

    setUploading(true);
    setError("");

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API_BASE}/chat/${conversationId}/attachments`, {
        method: "POST",
        headers: headerAuth,
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Upload failed");
      }

      const msg = await res.json().catch(() => null);

      if (msg?.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }

      requestAnimationFrame(() => scrollToBottom("smooth"));
    } catch (e) {
      setError(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleCloseConversation() {
    if (!conversationId) return;
    setError("");
    try {
      const res = await fetch(`${API_BASE}/chat/${conversationId}/close`, {
        method: "POST",
        headers: headerAuth,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to close conversation");
      }
      onCloseConversationUI?.();
    } catch (e) {
      setError(e?.message || "Failed to close conversation");
    }
  }

  const customerLabel = conversation?.customerUserId
    ? `User #${conversation.customerUserId}`
    : "Guest";

  // ✅ IMPORTANT: h-full + min-h-0 so children can scroll
  const gridClass = showContext
    ? "h-full min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px]"
    : "h-full min-h-0 grid grid-cols-1";

  if (!conversationId) return null;

  return (
    // ✅ outer container must be flex/column + min-h-0 + overflow-hidden
    <div className="h-full w-full min-h-0 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col">
      <div className={gridClass}>
        {/* Chat */}
        {/* ✅ must be flex-col + min-h-0 + overflow-hidden */}
        <div className="h-full min-h-0 flex flex-col min-w-0 overflow-hidden">
          <header className="shrink-0 p-4 border-b border-white/10 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Conversation</div>
              <div className="text-[12px] text-white/60">
                Customer: <span className="text-white/80">{customerLabel}</span>
                {" · "}
                {uploading ? "Uploading…" : joined ? "Live" : "Joining…"}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
              <button
                type="button"
                onClick={onBack}
                className="shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 hover:bg-white/10 hover:text-white transition"
              >
                Back
              </button>

              <button
                type="button"
                onClick={() => setShowContext((v) => !v)}
                className="shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 hover:bg-white/10 hover:text-white transition"
              >
                {showContext ? "Hide context" : "Show context"}
              </button>

              <button
                type="button"
                onClick={handleCloseConversation}
                className="shrink-0 whitespace-nowrap rounded-full bg-white text-black px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] hover:bg-gray-100 transition"
              >
                Close
              </button>
            </div>
          </header>

          {/* ✅ THIS wrapper is what makes the list scroll without moving composer */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <div
              ref={listRef}
              className="h-full overflow-y-auto p-4 space-y-3"
            >
              {loadingHistory ? (
                <div className="text-sm text-white/60">Loading messages…</div>
              ) : null}

              {!loadingHistory && messages.length === 0 ? (
                <div className="text-sm text-white/60">
                  No messages yet. Say hello 👋
                </div>
              ) : null}

              {messages.map((m) => {
                const mine = m.senderRole === "support";
                const hasAttachment =
                  !!m.attachmentPath || !!m.attachmentName || !!m.attachmentMime;

                return (
                  <div
                    key={m.id}
                    className={mine ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={[
                        "max-w-[82%] rounded-2xl px-3 py-2 border border-white/10 shadow-sm",
                        mine ? "bg-white/20" : "bg-black/20",
                      ].join(" ")}
                    >
                      {m.text ? (
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {m.text}
                        </div>
                      ) : null}

                      {hasAttachment ? (
                        <AttachmentChip
                          label={m.attachmentName || "Attachment"}
                          onOpen={async () => {
                            try {
                              await downloadChatAttachmentOpen(
                                m.id,
                                m.attachmentName || "attachment"
                              );
                            } catch (e) {
                              setError(e?.message || "Failed to open attachment");
                            }
                          }}
                        />
                      ) : null}

                      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-white/45">
                        <span>{mine ? "Support" : "Customer"}</span>
                        <span>
                          {m.createdAt
                            ? new Date(m.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {typingState.active ? (
                <div className="text-[12px] text-white/50">
                  {typingState.role === "customer"
                    ? "Customer is typing…"
                    : "Typing…"}
                </div>
              ) : null}

              {/* bottom anchor */}
              <div ref={bottomRef} />
            </div>
          </div>

          {error ? (
            <div className="shrink-0 px-4 py-2">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            </div>
          ) : null}

          {/* ✅ composer is shrink-0 so it never gets pushed off */}
          <div className="shrink-0 p-4 pb-6 border-t border-white/10 bg-black/10">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                placeholder="Type a reply…"
                className="w-full min-w-0 resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 min-h-[44px] max-h-28"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendText();
                  }
                }}
              />

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="h-[44px] shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 hover:bg-white/10 hover:text-white transition disabled:opacity-50"
              >
                Attach
              </button>

              <button
                type="button"
                onClick={sendText}
                disabled={!text.trim() || uploading}
                className="h-[44px] shrink-0 whitespace-nowrap rounded-full bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-black hover:bg-gray-100 active:scale-[0.98] transition disabled:opacity-50"
              >
                Send
              </button>

              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,image/*,video/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) sendAttachment(f);
                }}
              />
            </div>
          </div>
        </div>

        {/* Context */}
        {showContext ? (
          <aside className="hidden lg:block h-full min-h-0 border-l border-white/10">
            <div className="h-full min-h-0 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Customer context</div>
                {loadingContext ? (
                  <span className="text-[12px] text-white/50">Loading…</span>
                ) : null}
              </div>

              {!context ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
                  No context available.
                </div>
              ) : (
                <div className="space-y-3">
                  <Section title="Profile">
                    <div className="space-y-1 text-sm text-white/80">
                      <div>
                        <span className="text-white/60">Type:</span>{" "}
                        {context.isGuest ? "Guest" : "Logged in"}
                      </div>
                      {!context.isGuest ? (
                        <>
                          <div>
                            <span className="text-white/60">User ID:</span>{" "}
                            {context.user?.id}
                          </div>
                          <div>
                            <span className="text-white/60">Email:</span>{" "}
                            {context.user?.email || "—"}
                          </div>
                          <div>
                            <span className="text-white/60">Name:</span>{" "}
                            {context.user?.fullName || "—"}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </Section>

                  <Section title="Cart">
                    {context.cart?.length ? (
                      <div className="space-y-2">
                        {context.cart.map((it) => (
                          <div
                            key={it.id}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                          >
                            <div className="text-sm text-white/85 font-medium">
                              {it.productName}
                            </div>
                            <div className="text-[12px] text-white/60">
                              Qty: {it.quantity}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-white/60">Empty</div>
                    )}
                  </Section>

                  <Section title="Wishlist">
                    {context.wishlist?.length ? (
                      <div className="space-y-2">
                        {context.wishlist.map((w) => (
                          <div
                            key={w.id}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                          >
                            <div className="text-sm text-white/85 font-medium">
                              {w.productName}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-white/60">Empty</div>
                    )}
                  </Section>

                  <Section title="Orders">
                    {context.orders?.length ? (
                      <div className="space-y-2">
                        {context.orders.map((o) => (
                          <div
                            key={o.id}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                          >
                            <div className="text-sm text-white/85 font-medium">
                              #{o.id} ·{" "}
                              <span className="text-white/60">{o.status}</span>
                            </div>
                            <div className="text-[12px] text-white/60">
                              {o.createdAt
                                ? new Date(o.createdAt).toLocaleString()
                                : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-white/60">None</div>
                    )}
                  </Section>

                  <Section title="Returns">
                    {context.returns?.length ? (
                      <div className="space-y-2">
                        {context.returns.map((r) => (
                          <div
                            key={r.id}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                          >
                            <div className="text-sm text-white/85 font-medium">
                              #{r.id} ·{" "}
                              <span className="text-white/60">{r.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-white/60">None</div>
                    )}
                  </Section>
                </div>
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

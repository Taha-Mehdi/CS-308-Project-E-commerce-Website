"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { downloadChatAttachmentOpen } from "../lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

function getOrCreateGuestToken() {
  if (typeof window === "undefined") return null;
  let t = localStorage.getItem("guestChatToken");
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem("guestChatToken", t);
  }
  return t;
}

function clearGuestToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("guestChatToken");
}

function buildHeaders({ token, guestToken }) {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(guestToken ? { "x-guest-token": guestToken } : {}),
  };
}

export default function ChatWidget() {
  const { token, user } = useAuth();

  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");

  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);

  const [typingState, setTypingState] = useState({ active: false, role: null });
  const [lastReadByOther, setLastReadByOther] = useState(null);

  const socketRef = useRef(null);
  const fileRef = useRef(null);
  const listRef = useRef(null);
  const typingTimerRef = useRef(null);
  const lastReadSentRef = useRef(null);

  // guest token only when not logged in
  const guestToken = user ? null : getOrCreateGuestToken();
  const myRole = user ? "customer" : "guest";
  const socketAuth = useMemo(() => ({ token, guestToken }), [token, guestToken]);

  // ✅ If user logs in after chatting as guest, link guest conversation(s) to the account
  useEffect(() => {
    if (!user || !token) return;
    if (typeof window === "undefined") return;

    const gt = localStorage.getItem("guestChatToken");
    if (!gt) return;

    (async () => {
      try {
        await fetch(`${API_BASE}/chat/link`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ guestToken: gt }),
        });
        clearGuestToken();
      } catch {
        // silent — not critical for chat to function
      }
    })();
  }, [user, token]);

  async function startConversation({ forceNew = false } = {}) {
    setError("");
    const res = await fetch(`${API_BASE}/chat/start${forceNew ? "?forceNew=1" : ""}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildHeaders({ token, guestToken }),
      },
    });

    if (!res.ok) throw new Error("Failed to start chat");
    const conv = await res.json();
    setConversationId(conv.id);
    return conv.id;
  }

  async function loadMessages(cid) {
    setLoadingHistory(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/chat/${cid}/messages`, {
        headers: buildHeaders({ token, guestToken }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Failed to load messages");
      setMessages([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  // socket lifecycle (connect only when panel is open)
  useEffect(() => {
    if (!open || !conversationId) return;

    const socket = io(API_BASE, {
      transports: ["websocket"],
      auth: socketAuth,
    });
    socketRef.current = socket;

    const onNew = (msg) => setMessages((p) => [...p, msg]);

    const onTyping = (e) => {
      if (e.role !== myRole) setTypingState({ active: e.isTyping, role: e.role });
    };

    const onRead = (e) => {
      // e: {conversationId, messageId, role}
      if (e?.role && e.role !== myRole) setLastReadByOther(e.messageId);
    };

    socket.on("message_new", onNew);
    socket.on("typing", onTyping);
    socket.on("message_read", onRead);

    socket.emit("join_conversation", { conversationId });

    return () => {
      socket.off("message_new", onNew);
      socket.off("typing", onTyping);
      socket.off("message_read", onRead);
      socket.disconnect();
    };
  }, [open, conversationId, socketAuth, myRole]);

  // auto scroll
  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [open, messages, loadingHistory]);

  // send read receipt when you see the latest message from the other side
  useEffect(() => {
    if (!open || !conversationId) return;
    if (!socketRef.current) return;
    if (!messages.length) return;

    const last = messages[messages.length - 1];
    if (!last?.id) return;

    const fromOther = last.senderRole !== myRole;
    if (!fromOther) return;

    if (lastReadSentRef.current === last.id) return;
    lastReadSentRef.current = last.id;

    socketRef.current.emit("message_read", { conversationId, messageId: last.id });
  }, [open, conversationId, messages, myRole]);

  async function handleOpen() {
    setOpen(true);

    const cid = await startConversation({ forceNew: false });
    await loadMessages(cid);
  }

  async function handleNewChat() {
    setMessages([]);
    setConversationId(null);
    setTypingState({ active: false, role: null });
    setLastReadByOther(null);
    lastReadSentRef.current = null;

    const cid = await startConversation({ forceNew: true });
    await loadMessages(cid);
  }

  function emitTyping(isTyping) {
    if (!socketRef.current || !conversationId) return;
    socketRef.current.emit("typing", { conversationId, isTyping });
  }

  function handleInputChange(v) {
    setText(v);
    emitTyping(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(false), 700);
  }

  function handleSend(e) {
    e.preventDefault();
    if (!text.trim() || !conversationId) return;
    socketRef.current?.emit("message_send", { conversationId, text: text.trim() });
    emitTyping(false);
    setText("");
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !conversationId) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API_BASE}/chat/${conversationId}/attachments`, {
        method: "POST",
        headers: buildHeaders({ token, guestToken }),
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Upload failed");
      }
    } catch (err) {
      setError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-xl hover:bg-white/15 transition"
        >
          Chat with support
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] h-[540px] rounded-3xl border border-white/15 bg-white/10 text-white shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col">
          <header className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight">Support</div>
              <div className="text-[12px] text-white/60">
                {user ? "Logged in" : "Guest"} · {uploading ? "Uploading…" : "Live"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleNewChat}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 hover:bg-white/15 hover:text-white transition"
              >
                New chat
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 hover:bg-white/15 hover:text-white transition"
              >
                Close
              </button>
            </div>
          </header>

          <div ref={listRef} className="flex-1 p-4 overflow-y-auto space-y-2">
            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {loadingHistory ? (
              <div className="text-sm text-white/60">Loading messages…</div>
            ) : null}

            {messages.map((m) => {
              const mine = m.senderRole === myRole;
              return (
                <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={[
                      "max-w-[80%] rounded-2xl px-3 py-2",
                      mine ? "bg-white/20 border border-white/10" : "bg-black/20 border border-white/10",
                    ].join(" ")}
                  >
                    {m.text ? <div className="text-sm whitespace-pre-wrap">{m.text}</div> : null}

                    {m.attachmentUrl ? (
                      <button
                        onClick={() =>
                          downloadChatAttachmentOpen(m.id, m.attachmentName, {
                            headers: guestToken ? { "x-guest-token": guestToken } : {},
                          })
                        }
                        className="mt-2 block text-left text-[12px] underline underline-offset-2 text-white/80 hover:text-white"
                      >
                        📎 {m.attachmentName}
                      </button>
                    ) : null}

                    {mine && lastReadByOther === m.id ? (
                      <div className="mt-1 text-[11px] text-white/60 text-right">Seen</div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {typingState.active ? (
              <div className="text-[12px] text-white/60">
                {typingState.role === "support" ? "Support is typing…" : "Typing…"}
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSend} className="p-3 border-t border-white/10 flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-10 w-10 rounded-2xl border border-white/15 bg-white/10 hover:bg-white/15 transition grid place-items-center"
              title="Attach file"
            >
              📎
            </button>

            <input
              value={text}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 h-10 rounded-2xl bg-black/20 border border-white/10 px-3 text-sm outline-none placeholder:text-white/40"
            />

            <input
              ref={fileRef}
              type="file"
              hidden
              accept="image/*,video/*,application/pdf"
              onChange={handleFileSelected}
            />

            <button
              type="submit"
              disabled={!text.trim() || uploading}
              className="h-10 rounded-2xl bg-white text-black px-4 text-[12px] font-semibold uppercase tracking-[0.14em] disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gray-100 transition"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}

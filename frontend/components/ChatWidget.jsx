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

export default function ChatWidget() {
  const { token, user } = useAuth();

  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [typingState, setTypingState] = useState({ active: false, role: null });
  const [lastRead, setLastRead] = useState(null);

  const socketRef = useRef(null);
  const fileRef = useRef(null);
  const typingTimerRef = useRef(null);

  const guestToken = user ? null : getOrCreateGuestToken();
  const myRole = user ? "customer" : "guest";
  const socketAuth = useMemo(() => ({ token, guestToken }), [token, guestToken]);

  async function startConversation() {
    const res = await fetch(`${API_BASE}/chat/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(guestToken ? { "x-guest-token": guestToken } : {}),
      },
    });

    if (!res.ok) throw new Error("Failed to start chat");
    const conv = await res.json();
    setConversationId(conv.id);
    return conv.id;
  }

  // socket lifecycle
  useEffect(() => {
    if (!open || !conversationId) return;

    const socket = io(API_BASE, {
      transports: ["websocket"],
      auth: socketAuth,
    });

    socketRef.current = socket;

    socket.on("message_new", (msg) => setMessages((p) => [...p, msg]));
    socket.on("typing", (e) => {
      if (e.role !== myRole) setTypingState({ active: e.isTyping, role: e.role });
    });
    socket.on("message_read", (e) => setLastRead(e.messageId));

    socket.emit("join_conversation", { conversationId });

    return () => socket.disconnect();
  }, [open, conversationId, socketAuth, myRole]);

  async function handleOpen() {
    setOpen(true);
    await startConversation();
  }

  function emitTyping(isTyping) {
    socketRef.current?.emit("typing", { conversationId, isTyping });
  }

  function handleInputChange(v) {
    setText(v);
    emitTyping(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(false), 700);
  }

  function handleSend(e) {
    e.preventDefault();
    if (!text.trim()) return;
    socketRef.current.emit("message_send", { conversationId, text });
    emitTyping(false);
    setText("");
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      await fetch(`${API_BASE}/chat/${conversationId}/attachments`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(guestToken ? { "x-guest-token": guestToken } : {}),
        },
        body: form,
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleStartNewChat() {
    if (user) return;
    clearGuestToken();
    setConversationId(null);
    setMessages([]);
    socketRef.current?.disconnect();
    await startConversation();
  }

  return (
    <>
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 rounded-full bg-black text-white px-5 py-3"
        >
          Chat with support
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-80 h-96 bg-black text-white rounded-xl flex flex-col">
          <header className="p-3 border-b border-white/10 flex justify-between">
            <span className="font-semibold">Support</span>
            {!user && (
              <button onClick={handleStartNewChat} className="text-xs bg-white/10 px-2 rounded">
                New
              </button>
            )}
          </header>

          <div className="flex-1 p-3 overflow-y-auto space-y-2">
            {messages.map((m, idx) => {
              const mine = m.senderRole === myRole;
              return (
                <div key={m.id} className={mine ? "text-right" : ""}>
                  <div className="inline-block bg-white/10 px-3 py-2 rounded">
                    {m.text}
                    {m.attachmentUrl && (
                      <button
                        onClick={() =>
                          downloadChatAttachmentOpen(m.id, m.attachmentName, {
                            headers: guestToken ? { "x-guest-token": guestToken } : {},
                          })
                        }
                        className="block underline mt-1"
                      >
                        📎 {m.attachmentName}
                      </button>
                    )}
                  </div>
                  {mine && lastRead === m.id && <div className="text-xs">Seen</div>}
                </div>
              );
            })}
            {typingState.active && <div className="text-xs opacity-60">Typing…</div>}
          </div>

          <form onSubmit={handleSend} className="p-3 border-t border-white/10 flex gap-2">
            <button type="button" onClick={() => fileRef.current.click()}>
              📎
            </button>
            <input
              value={text}
              onChange={(e) => handleInputChange(e.target.value)}
              className="flex-1 bg-white/10 rounded px-2"
            />
            <input
              ref={fileRef}
              type="file"
              hidden
              accept="image/*,video/*,application/pdf"
              onChange={handleFileSelected}
            />
          </form>
        </div>
      )}
    </>
  );
}

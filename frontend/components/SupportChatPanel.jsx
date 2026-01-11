"use client";

import { useEffect, useRef, useState } from "react";
import { downloadChatAttachmentOpen } from "../lib/api";

export default function SupportChatPanel({ socket, token, conversation, onCloseConversationUI }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingState, setTypingState] = useState({ active: false });
  const listRef = useRef(null);

  const conversationId = conversation?.id;

  useEffect(() => {
    if (!socket || !conversationId) return;

    socket.emit("join_conversation", { conversationId });

    socket.on("message_new", (m) => {
      if (m.conversationId === conversationId) setMessages((p) => [...p, m]);
    });

    socket.on("typing", (e) => {
      if (e.role !== "support") setTypingState({ active: e.isTyping });
    });

    return () => {
      socket.off("message_new");
      socket.off("typing");
    };
  }, [socket, conversationId]);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    if (!text.trim()) return;
    socket.emit("message_send", { conversationId, text });
    setText("");
  }

  return (
    <div className="h-full flex flex-col">
      <header className="p-3 border-b flex justify-between">
        <span>Conversation #{conversationId}</span>
        <button onClick={onCloseConversationUI}>Back</button>
      </header>

      <div ref={listRef} className="flex-1 p-3 overflow-y-auto space-y-2">
        {messages.map((m) => (
          <div key={m.id}>
            <div className="bg-white/10 p-2 rounded">
              {m.text}
              {m.attachmentUrl && (
                <button
                  onClick={() => downloadChatAttachmentOpen(m.id, m.attachmentName)}
                  className="block underline mt-1"
                >
                  📎 {m.attachmentName}
                </button>
              )}
            </div>
          </div>
        ))}
        {typingState.active && <div className="text-xs opacity-60">Customer typing…</div>}
      </div>

      <form onSubmit={handleSend} className="p-3 border-t flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 bg-white/10 rounded px-2"
        />
        <button>Send</button>
      </form>
    </div>
  );
}

import { io } from "socket.io-client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

let socket = null;
let lastAuthKey = null;

function makeAuthKey({ token, guestToken }) {
  // keep it stable and comparable
  const t = typeof token === "string" ? token.trim() : "";
  const g = typeof guestToken === "string" ? guestToken.trim() : "";
  return `${t ? "t:" + t : "t:"}|${g ? "g:" + g : "g:"}`;
}

export function getChatSocket({ token, guestToken } = {}) {
  const authKey = makeAuthKey({ token, guestToken });

  // ✅ If auth changed (login/logout/guest->user), force recreate socket
  if (socket && lastAuthKey !== authKey) {
    try {
      socket.disconnect();
    } catch {
      // ignore
    }
    socket = null;
    lastAuthKey = null;
  }

  if (socket) return socket;

  lastAuthKey = authKey;

  socket = io(API_BASE, {
    transports: ["websocket"],
    autoConnect: true,

    // ✅ better resilience
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 12000,

    auth: {
      token: token || undefined,
      guestToken: guestToken || undefined,
    },
  });

  socket.on("connect_error", (err) => {
    console.error("Chat socket connect error:", err?.message || err);
  });

  socket.on("disconnect", (reason) => {
    // useful debug signal while developing:
    // console.warn("Chat socket disconnected:", reason);
  });

  return socket;
}

export function disconnectChatSocket() {
  if (socket) {
    try {
      socket.disconnect();
    } finally {
      socket = null;
      lastAuthKey = null;
    }
  }
}

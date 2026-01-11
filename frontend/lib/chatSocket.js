import { io } from "socket.io-client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

let socket = null;

export function getChatSocket({ token, guestToken }) {
  if (socket) return socket;

  socket = io(API_BASE, {
    transports: ["websocket"],
    auth: {
      token: token || undefined,
      guestToken: guestToken || undefined,
    },
  });

  socket.on("connect_error", (err) => {
    console.error("Chat socket connect error:", err.message);
  });

  return socket;
}

export function disconnectChatSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

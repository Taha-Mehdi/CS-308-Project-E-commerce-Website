"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getChatSocket } from "../../lib/chatSocket";
import SupportChatPanel from "../../components/SupportChatPanel";

function Row({ children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      {children}
    </div>
  );
}

export default function SupportPage() {
  const { token, user, loadingUser } = useAuth();

  const [socket, setSocket] = useState(null);
  const [queue, setQueue] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | connecting | live | error
  const [error, setError] = useState("");

  const isSupport = user?.roleName === "support";

  const queueCount = useMemo(
    () => (Array.isArray(queue) ? queue.length : 0),
    [queue]
  );

  function requestQueue(s) {
    if (!s) return;

    s.emit("queue_request", {}, (res) => {
      if (!res?.ok) {
        setError(res?.error || "Failed to load queue");
        setQueue([]);
        return;
      }
      setError("");
      setQueue(Array.isArray(res.queue) ? res.queue : []);
    });
  }

  // Connect socket (support only)
  useEffect(() => {
    if (!token) return;
    if (!isSupport) return;

    setStatus("connecting");
    setError("");

    const s = getChatSocket({ token, guestToken: null });
    setSocket(s);

    const onConnected = () => {
      setStatus("live");
      setError("");
      requestQueue(s); // ✅ auto load queue on connect
    };

    const onDisconnected = (reason) => {
      setStatus("connecting");
      if (reason && typeof reason === "string") {
        // Don’t spam error on normal page unload
        if (reason !== "io client disconnect") {
          setError(`Disconnected: ${reason}`);
        }
      }
    };

    const onConnectError = (err) => {
      console.error("Support socket connect_error:", err?.message);
      setStatus("error");
      setError(err?.message || "Socket connection failed");
    };

    const onQueueUpdated = (payload) => {
      // payload: {type:'claimed', conversation: {...}}
      if (payload?.type === "claimed" && payload?.conversation?.id) {
        const claimedId = Number(payload.conversation.id);
        setQueue((prev) => prev.filter((c) => Number(c.id) !== claimedId));
      }
    };

    s.on("connect", onConnected);
    s.on("disconnect", onDisconnected);
    s.on("connect_error", onConnectError);
    s.on("queue_updated", onQueueUpdated);

    return () => {
      s.off("connect", onConnected);
      s.off("disconnect", onDisconnected);
      s.off("connect_error", onConnectError);
      s.off("queue_updated", onQueueUpdated);

      // If your getChatSocket() returns a singleton shared across pages,
      // you may NOT want to disconnect here.
      // If it returns a new socket instance, you SHOULD disconnect.
      // We’ll keep your original behavior (no disconnect) to avoid breaking shared use.
      // s.disconnect();
    };
  }, [token, isSupport]);

  function claimConversation(conversationId) {
    if (!socket) return;

    socket.emit("conversation_claim", { conversationId }, (res) => {
      if (!res?.ok) {
        setError(res?.error || "Claim failed");
        return;
      }
      setError("");
      setSelected(res.conversation);
      setQueue((prev) => prev.filter((c) => Number(c.id) !== Number(conversationId)));
    });
  }

  // Loading / Access Guards
  if (loadingUser) {
    return (
      <Row>
        <div className="text-sm text-gray-300/80">Loading…</div>
      </Row>
    );
  }

  if (!token) {
    return (
      <Row>
        <div className="text-sm text-gray-300/80">
          You must be logged in as a support agent to view this page.
        </div>
      </Row>
    );
  }

  if (!isSupport) {
    return (
      <Row>
        <div className="text-sm text-gray-300/80">
          Access denied. This page is for support agents only.
        </div>
      </Row>
    );
  }

  // Chat view
  if (selected) {
    return (
      <div className="h-[70vh]">
        <SupportChatPanel
          socket={socket}
          token={token}
          conversation={selected}
          onCloseConversationUI={() => setSelected(null)}
        />
      </div>
    );
  }

  // Queue view
  return (
    <div className="space-y-3">
      <Row>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Active customer chats</div>
            <div className="text-[12px] text-gray-300/70">
              Status:{" "}
              <span className="text-white/80">
                {status === "live"
                  ? "Connected"
                  : status === "connecting"
                  ? "Connecting…"
                  : status === "error"
                  ? "Error"
                  : "Idle"}
              </span>
              {" · "}
              Queue: <span className="text-white/80">{queueCount}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => requestQueue(socket)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 hover:bg-white/10 hover:text-white transition"
          >
            Refresh queue
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </Row>

      <div className="grid gap-3 md:grid-cols-2">
        {queueCount === 0 ? (
          <Row>
            <div className="text-sm text-gray-300/70">No open unclaimed chats right now.</div>
          </Row>
        ) : (
          queue.map((c) => (
            <Row key={c.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Conversation #{c.id}</div>
                  <div className="text-[12px] text-gray-300/70">
                    Status: <span className="text-white/80">{c.status}</span>
                  </div>
                  <div className="text-[12px] text-gray-300/70">
                    Customer:{" "}
                    <span className="text-white/80">
                      {c.customerUserId ? `User #${c.customerUserId}` : "Guest"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => claimConversation(c.id)}
                  className="rounded-full bg-white text-black px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] hover:bg-gray-100 transition"
                >
                  Claim
                </button>
              </div>
            </Row>
          ))
        )}
      </div>
    </div>
  );
}

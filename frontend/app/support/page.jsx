"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getChatSocket } from "../../lib/chatSocket";
import SupportChatPanel from "../../components/SupportChatPanel";
import SupportQueueCard from "../../components/SupportQueueCard";

const LS_ACTIVE = "support_active_chats_v1";
const LS_SELECTED = "support_selected_chat_v1";

function safeParseJson(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeConversation(c) {
  if (!c || typeof c !== "object") return null;
  const id = Number(c.id);
  if (!Number.isInteger(id) || id <= 0) return null;

  return {
    id,
    customerUserId: c.customerUserId ?? null,
    assignedAgentId: c.assignedAgentId ?? null,
    status: c.status ?? "claimed",
    createdAt: c.createdAt ?? null,
    updatedAt: c.updatedAt ?? null,
  };
}

function Spinner({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 animate-spin ${className}`}
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function SupportPage() {
  const { token, user, loadingUser } = useAuth();
  const isSupport = user?.roleName === "support";

  const [socket, setSocket] = useState(null);

  const [queue, setQueue] = useState([]);
  const [activeChats, setActiveChats] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [justArrivedIds, setJustArrivedIds] = useState(() => new Set());
  const arrivalTimersRef = useRef(new Map());

  function markJustArrived(id) {
    setJustArrivedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    const old = arrivalTimersRef.current.get(id);
    if (old) clearTimeout(old);

    const t = setTimeout(() => {
      setJustArrivedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      arrivalTimersRef.current.delete(id);
    }, 8000);

    arrivalTimersRef.current.set(id, t);
  }

  useEffect(() => {
    return () => {
      for (const t of arrivalTimersRef.current.values()) clearTimeout(t);
      arrivalTimersRef.current.clear();
    };
  }, []);

  function requestQueue(s) {
    if (!s) return;
    setRefreshing(true);
    s.emit("queue_request", {}, (res) => {
      setRefreshing(false);

      if (!res?.ok) {
        setError(res?.error || "Failed to load queue");
        setQueue([]);
        return;
      }
      setError("");
      setQueue(Array.isArray(res.queue) ? res.queue : []);
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loadingUser || !isSupport) return;

    const restoredActiveRaw = localStorage.getItem(LS_ACTIVE);
    const restoredSelectedRaw = localStorage.getItem(LS_SELECTED);

    const restoredActive = safeParseJson(restoredActiveRaw, []);
    const restoredSelected = safeParseJson(restoredSelectedRaw, null);

    const normalized = Array.isArray(restoredActive)
      ? restoredActive.map(normalizeConversation).filter(Boolean)
      : [];

    setActiveChats(normalized);

    const sel = Number(restoredSelected);
    if (
      Number.isInteger(sel) &&
      sel > 0 &&
      normalized.some((c) => c.id === sel)
    ) {
      setSelectedId(sel);
    } else {
      setSelectedId(null);
    }
  }, [loadingUser, isSupport]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isSupport) return;
    localStorage.setItem(LS_ACTIVE, JSON.stringify(activeChats));
  }, [activeChats, isSupport]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isSupport) return;
    if (selectedId) localStorage.setItem(LS_SELECTED, JSON.stringify(selectedId));
    else localStorage.removeItem(LS_SELECTED);
  }, [selectedId, isSupport]);

  useEffect(() => {
    if (!token || !isSupport) return;

    setStatus("connecting");
    const s = getChatSocket({ token });
    setSocket(s);

    const onConnect = () => {
      setStatus("live");
      requestQueue(s);

      activeChats.forEach((c) => {
        if (c?.id) s.emit("join_conversation", { conversationId: c.id });
      });
    };

    const onDisconnect = () => setStatus("connecting");
    const onConnectError = () => setStatus("error");

    const onQueueUpdated = ({ type, conversation, conversationId }) => {
      if (conversation?.id)
        setQueue((prev) => prev.filter((c) => c.id !== conversation.id));
      if (conversationId)
        setQueue((prev) => prev.filter((c) => c.id !== Number(conversationId)));

      const closedId = conversationId
        ? Number(conversationId)
        : conversation?.id
        ? Number(conversation.id)
        : null;

      if (type === "closed" && closedId) {
        setActiveChats((prev) => prev.filter((c) => c.id !== closedId));
        setSelectedId((prev) => (prev === closedId ? null : prev));
      }
    };

    const onQueueNew = (conversation) => {
      if (!conversation?.id) return;
      if (conversation.status !== "open" || conversation.assignedAgentId) return;

      setQueue((prev) => {
        if (prev.some((c) => c.id === conversation.id)) return prev;
        return [conversation, ...prev];
      });

      markJustArrived(conversation.id);
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onConnectError);
    s.on("queue_updated", onQueueUpdated);
    s.on("queue_new", onQueueNew);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onConnectError);
      s.off("queue_updated", onQueueUpdated);
      s.off("queue_new", onQueueNew);
    };
  }, [token, isSupport, activeChats]);

  function claimConversation(id) {
    if (!socket) return;

    socket.emit("conversation_claim", { conversationId: id }, (res) => {
      if (!res?.ok) {
        setError(res?.error || "Claim failed");
        return;
      }

      const conv = normalizeConversation(res.conversation);
      if (!conv) {
        setError("Claim returned invalid conversation");
        return;
      }

      setActiveChats((prev) => {
        if (prev.some((c) => c.id === conv.id)) return prev;
        return [...prev, conv];
      });

      setSelectedId(conv.id);
      setQueue((prev) => prev.filter((c) => c.id !== id));
      setError("");

      socket.emit("join_conversation", { conversationId: conv.id });
      setQueueDrawerOpen(false);
    });
  }

  const filteredQueue = useMemo(() => {
    return queue.filter((c) => {
      if (filter === "guest") return !c.customerUserId;
      if (filter === "user") return !!c.customerUserId;
      return true;
    });
  }, [queue, filter]);

  if (loadingUser || !user || !isSupport) return null;

  const selected = activeChats.find((c) => c.id === selectedId) || null;
  const inChatMode = Boolean(selected);

  /* CHAT MODE */
  if (inChatMode) {
    return (
      <div className="space-y-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-2xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold">Support Console</div>
                <span
                  className={[
                    "rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                    status === "live"
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                      : status === "connecting"
                      ? "border-yellow-400/25 bg-yellow-400/10 text-yellow-200"
                      : "border-red-500/25 bg-red-500/10 text-red-200",
                  ].join(" ")}
                >
                  {status}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setQueueDrawerOpen(false);
                }}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85 hover:bg-white/10 transition"
              >
                Back to dashboard
              </button>

              <button
                type="button"
                onClick={() => {
                  requestQueue(socket);
                  setQueueDrawerOpen(true);
                }}
                className="rounded-full bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-black hover:bg-gray-100 transition inline-flex items-center gap-2"
              >
                {refreshing ? <Spinner /> : null}
                Open queue
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {activeChats.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={[
                  "shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition",
                  selectedId === c.id
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                ].join(" ")}
              >
                #{c.id}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="h-[72vh]">
          <SupportChatPanel
            socket={socket}
            token={token}
            conversation={selected}
            onBack={() => setSelectedId(null)}
            onCloseConversationUI={() => {
              setActiveChats((prev) => prev.filter((c) => c.id !== selected.id));
              setSelectedId(null);
              setQueueDrawerOpen(false);
            }}
          />
        </div>

        {/* Queue drawer */}
        {queueDrawerOpen ? (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setQueueDrawerOpen(false)}
            />
            <div className="absolute right-4 top-4 bottom-4 w-[460px] max-w-[calc(100vw-2rem)] rounded-3xl border border-white/10 bg-black/60 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">Waiting queue</div>
                  <div className="text-[12px] text-white/60">
                    {filteredQueue.length} shown · total {queue.length}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => requestQueue(socket)}
                    disabled={refreshing}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85 hover:bg-white/10 transition disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    {refreshing ? <Spinner className="text-white/80" /> : null}
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueueDrawerOpen(false)}
                    className="rounded-full bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-black hover:bg-gray-100 transition"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="p-4 border-b border-white/10 flex flex-wrap gap-2">
                {["all", "guest", "user"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={[
                      "rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition",
                      filter === f
                        ? "bg-white text-black"
                        : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                    ].join(" ")}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filteredQueue.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                    No matching conversations.
                  </div>
                ) : (
                  filteredQueue.map((c) => (
                    <SupportQueueCard
                      key={c.id}
                      conversation={c}
                      onClaim={claimConversation}
                      justArrived={justArrivedIds.has(c.id)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  /* DASHBOARD MODE */
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-2xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">Support Dashboard</div>
              <span
                className={[
                  "rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                  status === "live"
                    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                    : status === "connecting"
                    ? "border-yellow-400/25 bg-yellow-400/10 text-yellow-200"
                    : "border-red-500/25 bg-red-500/10 text-red-200",
                ].join(" ")}
              >
                {status}
              </span>
            </div>

            <div className="mt-1 text-[12px] text-gray-300/70">
              Waiting: {queue.length} · Active: {activeChats.length}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => requestQueue(socket)}
              disabled={refreshing}
              className="rounded-full bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-black hover:bg-gray-100 transition disabled:opacity-60 inline-flex items-center gap-2"
            >
              {refreshing ? <Spinner /> : null}
              Refresh
            </button>

            {["all", "guest", "user"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={[
                  "rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition",
                  filter === f
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                ].join(" ")}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        {/* Waiting queue */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Waiting queue</div>
            <div className="text-[12px] text-white/60">
              {filteredQueue.length} shown
            </div>
          </div>

          {/* ✅ single column list (long cards) */}
          <div className="space-y-3">
            {filteredQueue.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                No matching conversations.
              </div>
            ) : (
              filteredQueue.map((c) => (
                <SupportQueueCard
                  key={c.id}
                  conversation={c}
                  onClaim={claimConversation}
                  justArrived={justArrivedIds.has(c.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Active chats */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Active chats</div>
            <div className="text-[12px] text-white/60">{activeChats.length}</div>
          </div>

          {activeChats.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
              Claim a conversation to start helping customers.
            </div>
          ) : (
            <div className="space-y-2">
              {activeChats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="w-full text-left rounded-2xl border border-white/10 bg-black/20 hover:bg-white/10 transition p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">
                      Conversation #{c.id}
                    </div>
                    <div className="text-[11px] text-white/60">
                      {c.customerUserId ? `User #${c.customerUserId}` : "Guest"}
                    </div>
                  </div>
                  <div className="mt-1 text-[12px] text-white/60">
                    Status: <span className="text-white/80">{c.status}</span>
                    <span className="ml-2 text-white/40">· Click to resume</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;

  if (m < 1) return `${s}s`;
  if (m < 60) return `${m}m ${String(s).padStart(2, "0")}s`;

  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${String(rm).padStart(2, "0")}m`;
}

function waitingTier(ms) {
  const mins = ms / 60000;
  if (mins < 1) return "fresh";
  if (mins < 5) return "warm";
  if (mins < 15) return "hot";
  return "urgent";
}

export default function SupportQueueCard({ conversation, onClaim, justArrived = false }) {
  const createdAtMs = useMemo(() => {
    const t = new Date(conversation?.createdAt || Date.now()).getTime();
    return Number.isFinite(t) ? t : Date.now();
  }, [conversation?.createdAt]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const waitingMs = now - createdAtMs;
  const tier = waitingTier(waitingMs);

  const isGuest = !conversation?.customerUserId;

  const tierStyles =
    tier === "fresh"
      ? "border-white/10 bg-white/5"
      : tier === "warm"
      ? "border-yellow-400/20 bg-yellow-400/10"
      : tier === "hot"
      ? "border-orange-400/20 bg-orange-400/10"
      : "border-red-500/25 bg-red-500/10";

  const badgeStyles =
    tier === "fresh"
      ? "bg-white/10 text-white/80 border-white/10"
      : tier === "warm"
      ? "bg-yellow-400/15 text-yellow-200 border-yellow-400/20"
      : tier === "hot"
      ? "bg-orange-400/15 text-orange-200 border-orange-400/20"
      : "bg-red-500/15 text-red-200 border-red-500/25";

  const arrivalGlow = justArrived
    ? "ring-2 ring-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_0_30px_rgba(255,255,255,0.10)] animate-pulse"
    : "";

  return (
    <div
      className={[
        "w-full rounded-2xl border p-4 backdrop-blur-xl transition",
        tierStyles,
        "hover:bg-white/10 hover:-translate-y-[1px] hover:shadow-2xl",
        "transform-gpu",
        arrivalGlow,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <div className="text-sm font-semibold truncate">
              Conversation #{conversation.id}
            </div>

            {justArrived ? (
              <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                Just arrived
              </span>
            ) : null}

            <span
              className={[
                "shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                badgeStyles,
              ].join(" ")}
              title="How long this customer has been waiting"
            >
              {tier === "fresh"
                ? "New"
                : tier === "warm"
                ? "Waiting"
                : tier === "hot"
                ? "Priority"
                : "Urgent"}
            </span>

            <span
              className="shrink-0 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70"
              title={isGuest ? "Guest customer" : "Logged-in customer"}
            >
              {isGuest ? "Guest" : `User #${conversation.customerUserId}`}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-white/70">
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/50">
                Status
              </div>
              <div className="mt-0.5 text-white/85 font-medium">
                {conversation.status || "open"}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/50">
                Waiting
              </div>
              <div className="mt-0.5 text-white/85 font-medium">
                {formatDuration(waitingMs)}
              </div>
            </div>
          </div>

          <div className="mt-2 text-[12px] text-white/50">
            Started:{" "}
            <span className="text-white/70">
              {new Date(createdAtMs).toLocaleString()}
            </span>
          </div>
        </div>

        <button
          onClick={() => onClaim(conversation.id)}
          className="shrink-0 rounded-full bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-black hover:bg-gray-100 active:scale-[0.98] transition"
        >
          Claim
        </button>
      </div>
    </div>
  );
}

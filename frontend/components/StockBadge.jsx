"use client";

export default function StockBadge({ stock, className = "", tone = "default" }) {
  const n = Number(stock);
  const qty = Number.isFinite(n) ? n : 0;

  const label = `Stock · ${Math.max(0, qty)}`;

  // Ultra-minimal glass chip
  const base =
    "inline-flex items-center gap-1.5 rounded-full " +
    "px-2.5 py-1 " +
    "text-[11px] font-medium leading-none tracking-tight " +
    "border backdrop-blur-md " +
    "select-none pointer-events-none";

  const dotBase = "inline-block size-1.5 rounded-full";

  let wrap = "";
  let dot = "";
  let sheen = "";

  if (qty <= 0) {
    // Neutral / unavailable
    wrap =
      "bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] " +
      "border-white/10 text-white/45";
    dot = "bg-white/35";
    sheen = "before:bg-white/0";
  } else if (qty <= 5) {
    // Low stock (warm glass)
    wrap =
      "bg-[linear-gradient(135deg,color-mix(in_oklab,var(--drip-accent-2)_14%,transparent),rgba(255,255,255,0.02))] " +
      "border-[color-mix(in_oklab,var(--drip-accent-2)_22%,rgba(255,255,255,0.10))] " +
      "text-white/80";
    dot =
      "bg-[var(--drip-accent-2)] shadow-[0_0_8px_rgba(251,113,133,0.45)]";
    sheen = "before:bg-white/6";
  } else {
    // Healthy stock (cool glass)
    wrap =
      tone === "muted"
        ? "bg-[linear-gradient(135deg,color-mix(in_oklab,var(--drip-accent)_10%,transparent),rgba(255,255,255,0.02))] " +
          "border-white/10 text-white/65"
        : "bg-[linear-gradient(135deg,color-mix(in_oklab,var(--drip-accent)_16%,transparent),rgba(255,255,255,0.02))] " +
          "border-[color-mix(in_oklab,var(--drip-accent)_18%,rgba(255,255,255,0.12))] " +
          "text-white/85";
    dot =
      "bg-[var(--drip-accent)] shadow-[0_0_8px_rgba(168,85,247,0.5)]";
    sheen = "before:bg-white/6";
  }

  return (
    <span className={`relative inline-flex ${className}`}>
      <span
        className={`
          relative ${base} ${wrap}
          shadow-[0_6px_18px_rgba(0,0,0,0.16)]
          before:content-[''] before:absolute before:inset-[1px] before:rounded-full
          before:pointer-events-none before:opacity-60 ${sheen}
        `}
      >
        <span className={`${dotBase} ${dot}`} aria-hidden="true" />
        <span className="relative">Stock · {Math.max(0, qty)}</span>
      </span>
    </span>
  );
}

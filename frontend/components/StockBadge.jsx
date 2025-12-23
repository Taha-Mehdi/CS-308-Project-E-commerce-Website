"use client";

export function formatStockLabel(stock) {
  const n = Number(stock);
  const numeric = Number.isFinite(n) ? n : 0;

  if (numeric <= 0) return "Out of stock";
  if (numeric <= 5) return `Low stock • ${numeric}`;
  return `In stock • ${numeric}`;
}

export default function StockBadge({ stock, className = "", tone = "default" }) {
  const n = Number(stock);
  const numeric = Number.isFinite(n) ? n : 0;
  const label = formatStockLabel(numeric);

  const base =
    "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-medium leading-none border " +
    "transition-none pointer-events-none"; // 👈 IMPORTANT

  const dotBase = "inline-block size-1.5 rounded-full";

  let wrap = "";
  let dot = "";

  if (numeric <= 0) {
    wrap = "bg-black/30 text-gray-400 border-border";
    dot = "bg-gray-500/70";
  } else if (numeric <= 5) {
    wrap =
      "bg-[color-mix(in_oklab,var(--drip-accent-2)_12%,transparent)] " +
      "text-[var(--drip-accent-2)] " +
      "border-[color-mix(in_oklab,var(--drip-accent-2)_45%,transparent)]";
    dot = "bg-[var(--drip-accent-2)]";
  } else {
    wrap =
      tone === "muted"
        ? "bg-[color-mix(in_oklab,var(--drip-accent)_12%,transparent)] " +
          "text-[var(--drip-accent)] " +
          "border-[color-mix(in_oklab,var(--drip-accent)_45%,transparent)]"
        : "bg-primary text-black border-primary";
    dot = tone === "muted" ? "bg-[var(--drip-accent)]" : "bg-black/70";
  }

  return (
    <span
      className={`
        relative inline-block
        ${className}
      `}
    >
      <span
        className={`
          ${base}
          ${wrap}
          hover:bg-inherit hover:text-inherit hover:border-inherit
          active:bg-inherit active:text-inherit
        `}
      >
        <span className={`${dotBase} ${dot}`} aria-hidden="true" />
        <span>{label}</span>
      </span>
    </span>
  );
}

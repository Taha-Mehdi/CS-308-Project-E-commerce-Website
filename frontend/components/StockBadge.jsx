"use client";

export function formatStockLabel(stock) {
  const numeric = Number.isFinite(stock) ? Number(stock) : 0;
  if (numeric <= 0) return "Out of stock";
  return `In stock: ${numeric}`;
}

export default function StockBadge({ stock, className = "", tone = "default" }) {
  const label = formatStockLabel(stock);
  const base =
    "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.14em]";

  const toneClasses =
    tone === "muted"
      ? "bg-gray-100 text-gray-700 border border-gray-200"
      : "bg-black text-white";

  return (
    <span className={`${base} ${toneClasses} ${className}`.trim()}>
      {label}
    </span>
  );
}

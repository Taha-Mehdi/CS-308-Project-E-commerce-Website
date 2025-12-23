"use client";

import Link from "next/link";
import StockBadge from "./StockBadge";

export default function ProductCard({ product }) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const imageUrl = product?.imageUrl ? `${apiBase}${product.imageUrl}` : null;

  const price = Number(product?.price || 0).toFixed(2);

  return (
    <Link
      href={`/products/${product.id}`}
      className="
        group relative block overflow-hidden rounded-[28px]
        border border-border
        bg-[color-mix(in_oklab,var(--background)_78%,black_22%)]
        shadow-[0_18px_55px_rgba(0,0,0,0.45)]
        transition-transform duration-200
        hover:-translate-y-1.5
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--drip-accent)]
      "
    >
      {/* Soft gradient glow */}
      <div
        className="
          pointer-events-none absolute inset-0 opacity-0
          group-hover:opacity-100 transition-opacity
          bg-[radial-gradient(900px_circle_at_20%_10%,rgba(168,85,247,0.28),transparent_42%),radial-gradient(900px_circle_at_80%_30%,rgba(251,113,133,0.22),transparent_48%)]
        "
      />

      {/* IMAGE */}
      <div className="relative aspect-[3/4] overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name || "Sneaks-up drop"}
            className="
              h-full w-full object-cover
              transition-transform duration-500
              group-hover:scale-[1.08]
            "
          />
        ) : (
          <div className="h-full w-full grid place-items-center bg-black/25">
            <span className="text-[11px] uppercase tracking-[0.28em] text-gray-300/70">
              SNEAKS-UP
            </span>
          </div>
        )}

        {/* Image fade */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Price chip */}
        <div className="absolute left-4 top-4">
          <div
            className="
              inline-flex items-center gap-2 rounded-full px-3 py-1.5
              border border-[color-mix(in_oklab,var(--drip-accent)_45%,transparent)]
              bg-black/55 backdrop-blur
              shadow-[0_10px_30px_rgba(0,0,0,0.35)]
            "
          >
            <span className="inline-block size-1.5 rounded-full bg-[var(--drip-accent-2)]" />
            <span className="text-[12px] font-semibold text-white">
              ${price}
            </span>
          </div>
        </div>

        {/* Stock */}
        <div className="absolute left-4 bottom-4">
          <StockBadge stock={product.stock} tone="muted" />
        </div>
      </div>

      {/* TEXT */}
      <div className="px-5 pt-4 pb-5">
        <h3 className="text-[15px] sm:text-[16px] font-semibold text-foreground line-clamp-1">
          {product.name}
        </h3>

        {product.description && (
          <p className="mt-2 text-[12px] leading-relaxed text-gray-300/80 line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Minimal affordance line */}
        <div className="mt-3 h-[2px] w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="
              h-full w-[28%]
              bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
              opacity-70 transition-all duration-500
              group-hover:w-[48%] group-hover:opacity-100
            "
          />
        </div>
      </div>
    </Link>
  );
}

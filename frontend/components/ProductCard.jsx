"use client";

import Link from "next/link";
import StockBadge from "./StockBadge";

function round2(n) {
  return Math.round(n * 100) / 100;
}

export default function ProductCard({
  product,
  wishlistIds,
  onWishlistToggle,
  wishToggling,
}) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const imageUrl = product?.imageUrl ? `${apiBase}${product.imageUrl}` : null;

  const priceNum = Number(product?.price || 0);
  const originalNum =
    product?.originalPrice !== null && product?.originalPrice !== undefined
      ? Number(product.originalPrice)
      : null;

  const rateNum =
    product?.discountRate !== null && product?.discountRate !== undefined
      ? Number(product.discountRate)
      : null;

  const hasDiscount =
    Number.isFinite(rateNum) &&
    rateNum > 0 &&
    Number.isFinite(originalNum) &&
    originalNum > priceNum;

  const price = round2(priceNum).toFixed(2);
  const original = hasDiscount ? round2(originalNum).toFixed(2) : null;

  const isWishlisted = wishlistIds ? wishlistIds.has(Number(product?.id)) : false;

  const handleWishlistClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onWishlistToggle?.(product.id);
  };

  return (
    <div className="group min-w-0">
      <Link
        href={`/products/${product.id}`}
        className="
          relative block min-w-0 overflow-hidden
          rounded-[26px]
          border border-border
          bg-surface
          shadow-[0_18px_55px_rgba(0,0,0,0.35)]
          transition-transform duration-300
          hover:-translate-y-1
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--drip-accent)]
        "
      >
        {/* Hover glow */}
        <div
          className="
            pointer-events-none absolute inset-0 opacity-0
            group-hover:opacity-100 transition-opacity duration-300
            bg-[radial-gradient(900px_circle_at_20%_10%,rgba(168,85,247,0.18),transparent_45%),radial-gradient(900px_circle_at_85%_30%,rgba(251,113,133,0.14),transparent_50%)]
          "
          aria-hidden="true"
        />

        {/* IMAGE (shorter) */}
        <div className="relative aspect-[4/5] overflow-hidden bg-black/10">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product?.name || "Product"}
              loading="lazy"
              decoding="async"
              className="
                absolute inset-0 h-full w-full
                object-cover object-center
                transition-transform duration-700 ease-out
                group-hover:scale-[1.05]
              "
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-black/20">
              <span className="text-[11px] uppercase tracking-[0.28em] text-gray-300/70">
                SNEAKS-UP
              </span>
            </div>
          )}

          {/* lighter fade */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

          {/* Price + wishlist (✅ same height) */}
          <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
            {/* ✅ Price pill is h-9 to match wishlist */}
            <div
              className="
                min-w-0 inline-flex h-9 items-center gap-2
                rounded-full px-3
                border border-white/12
                bg-black/45 backdrop-blur
                shadow-[0_10px_30px_rgba(0,0,0,0.30)]
              "
            >
              <span className="inline-block size-1.5 rounded-full bg-[var(--drip-accent-2)]" />
              <span className="min-w-0 truncate text-[11px] font-semibold text-white">
                ${price}
                {hasDiscount && (
                  <span className="ml-2 text-[10px] text-gray-200/70 line-through">
                    ${original}
                  </span>
                )}
              </span>
            </div>

            {onWishlistToggle && (
              <button
                type="button"
                onClick={handleWishlistClick}
                disabled={wishToggling}
                className={[
                  "shrink-0 grid place-items-center rounded-full",
                  "h-9 w-9",
                  "border border-white/12 bg-black/45 backdrop-blur",
                  "shadow-[0_10px_30px_rgba(0,0,0,0.30)]",
                  "transition active:scale-95",
                  isWishlisted
                    ? "text-white bg-rose-500/85 hover:bg-rose-600/85 border-rose-400/30"
                    : "text-white/80 hover:text-white hover:bg-black/60",
                  wishToggling && "opacity-50 cursor-not-allowed",
                ].join(" ")}
                aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              >
                <svg
                  className="h-4 w-4"
                  fill={isWishlisted ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Stock */}
          <div className="absolute left-3 bottom-3">
            <StockBadge stock={product?.stock} tone="muted" />
          </div>
        </div>

        {/* TEXT */}
        <div className="min-w-0 px-4 sm:px-5 pt-4 pb-5">
          <h3 className="min-w-0 truncate text-[15px] sm:text-[16px] lg:text-[17px] font-semibold text-foreground">
            {product?.name || "Untitled"}
          </h3>

          {product?.description ? (
            <p className="mt-2 min-w-0 line-clamp-2 text-[12px] leading-relaxed text-gray-300/80">
              {product.description}
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-gray-300/50">No description.</p>
          )}

          <div className="mt-3 h-[2px] w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="
                h-full w-[34%]
                bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                opacity-70 transition-all duration-500
                group-hover:w-[58%] group-hover:opacity-100
              "
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-gray-300/60">
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--drip-accent)] opacity-60" />
              See more
            </span>
            <span className="opacity-70 group-hover:opacity-100 transition-opacity">
              View →
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

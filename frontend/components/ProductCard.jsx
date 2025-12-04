"use client";

import Link from "next/link";
import StockBadge from "./StockBadge";

export default function ProductCard({ product }) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const imageUrl = product?.imageUrl ? `${apiBase}${product.imageUrl}` : null;

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col rounded-3xl border border-gray-200 bg-white shadow-sm 
                 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden"
    >
      {/* IMAGE */}
      <div className="w-full aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name || "Sneaks-up drop"}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="text-[10px] uppercase tracking-[0.28em] text-gray-400">
            Sneaks-up
          </span>
        )}
      </div>

      {/* TEXT CONTENT */}
      <div className="px-4 pt-4 pb-5 space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm sm:text-base font-semibold text-gray-900 line-clamp-1">
            {product.name}
          </p>
          <p className="text-xs sm:text-sm font-semibold text-gray-900">
            ${Number(product.price).toFixed(2)}
          </p>
        </div>

        {product.description && (
          <p className="text-[11px] text-gray-500 line-clamp-2 leading-snug">
            {product.description}
          </p>
        )}

        <div className="mt-1">
          <StockBadge stock={product.stock} tone="muted" />
        </div>
      </div>
    </Link>
  );
}

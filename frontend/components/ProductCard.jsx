"use client";

import Link from "next/link";

export default function ProductCard({ product }) {
  const price =
    typeof product.price === "string"
      ? product.price
      : product.price?.toString() ?? "0.00";

  const hasImage = product.imageUrl;
  const imageSrc = hasImage
    ? `${process.env.NEXT_PUBLIC_API_BASE_URL}${product.imageUrl}`
    : null;

  const inStock = (product.stock || 0) > 0;

  return (
    <Link
      href={`/products/${product.id}`}
      className="group block bg-white rounded-3xl border border-gray-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden"
    >
      {/* Image */}
      <div className="relative">
        <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center overflow-hidden">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-200"
            />
          ) : (
            <span className="text-[11px] tracking-[0.2em] text-gray-500 uppercase">
              Sneaks-Up
            </span>
          )}
        </div>

        {/* Gradient overlay bottom */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Price pill */}
        <div className="absolute bottom-3 left-3">
          <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-gray-900">
            ${price}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-1.5">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">
          {product.name}
        </h3>

        {product.description && (
          <p className="text-xs text-gray-500 line-clamp-2">
            {product.description}
          </p>
        )}

        <div className="pt-1">
          <span
            className={`text-[11px] font-medium ${
              inStock ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {inStock ? `${product.stock} in stock` : "Sold out"}
          </span>
        </div>
      </div>
    </Link>
  );
}

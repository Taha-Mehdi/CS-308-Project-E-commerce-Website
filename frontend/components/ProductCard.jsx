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

  return (
    <div className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Image */}
      <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center overflow-hidden">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[11px] tracking-wide text-gray-500 uppercase">
            Product Image
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
            {product.name}
          </h3>
          <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
            ${price}
          </span>
        </div>

        {product.description && (
          <p className="text-xs text-gray-500 line-clamp-2">
            {product.description}
          </p>
        )}

        <div className="mt-auto pt-2">
          <Link
            href={`/products/${product.id}`}
            className="inline-flex items-center text-[11px] font-medium text-gray-900 group-hover:underline underline-offset-4"
          >
            View details
            <span className="ml-1 text-gray-400 group-hover:text-gray-600">
              →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

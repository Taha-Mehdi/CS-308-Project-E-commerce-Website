"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SiteLayout from "../../../components/SiteLayout";

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    async function loadProduct() {
      if (!id) return;
      setLoadingProduct(true);
      setMessage("");

      try {
        const res = await fetch(`${apiBase}/products/${id}`);
        const data = await res.json();

        if (!res.ok) {
          setProduct(null);
          setMessage(data.message || "Failed to load product.");
        } else {
          setProduct(data);
        }
      } catch (err) {
        console.error("Product load error:", err);
        setProduct(null);
        setMessage("Failed to load product.");
      } finally {
        setLoadingProduct(false);
      }
    }

    loadProduct();
  }, [apiBase, id]);

  function handleQuantityChange(delta) {
    setQuantity((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      return next;
    });
  }

  async function handleAddToCart() {
    setMessage("");

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token")
        : null;

    if (!token) {
      // redirect to login with next=product page
      router.push(`/login?next=${encodeURIComponent(`/products/${id}`)}`);
      return;
    }

    if (!product) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/cart/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: product.id,
          quantity,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Failed to add to bag.");
      } else {
        setMessage("Added to your bag.");
        // Notify navbar/cart count
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("cart-updated"));
        }
      }
    } catch (err) {
      console.error("Add to cart error:", err);
      setMessage("Failed to add to bag.");
    } finally {
      setSubmitting(false);
    }
  }

  const hasImage = product?.imageUrl;
  const imageSrc =
    hasImage && product
      ? `${process.env.NEXT_PUBLIC_API_BASE_URL}${product.imageUrl}`
      : null;

  return (
    <SiteLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[11px] text-gray-500 uppercase tracking-[0.18em]">
          <button
            type="button"
            onClick={() => router.push("/products")}
            className="hover:text-black"
          >
            Drops
          </button>
          <span>/</span>
          <span className="text-gray-800">
            {product?.name ? product.name : "Loading"}
          </span>
        </div>

        {/* Main content */}
        {loadingProduct ? (
          <p className="text-sm text-gray-500">Loading product…</p>
        ) : !product ? (
          <p className="text-sm text-gray-500">
            Product not found or unavailable.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 items-start">
            {/* Left: hero image */}
            <div className="rounded-3xl bg-white border border-gray-200/70 shadow-sm overflow-hidden">
              <div className="relative">
                <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center overflow-hidden">
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] tracking-[0.2em] text-gray-500 uppercase">
                      Sneaks-Up
                    </span>
                  )}
                </div>
                {/* Simple overlay label */}
                <div className="absolute bottom-3 left-3 rounded-full bg-black/80 px-3 py-1">
                  <span className="text-[11px] font-semibold text-white uppercase tracking-[0.16em]">
                    Sneaks-Up Drop
                  </span>
                </div>
              </div>
            </div>

            {/* Right: product info */}
            <div className="space-y-5">
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
                  {product.name}
                </h1>

                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-gray-900">
                    ${product.price}
                  </span>
                  <span
                    className={`text-[11px] font-medium uppercase tracking-[0.18em] px-3 py-1 rounded-full ${
                      (product.stock || 0) > 0
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {(product.stock || 0) > 0
                      ? `${product.stock} in stock`
                      : "Sold out"}
                  </span>
                </div>
              </div>

              {product.description && (
                <p className="text-sm text-gray-600 leading-relaxed">
                  {product.description}
                </p>
              )}

              {/* Quantity + actions */}
              {(product.stock || 0) > 0 && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-[11px] text-gray-600 uppercase tracking-[0.18em]">
                      Quantity
                    </p>
                    <div className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(-1)}
                        className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-sm text-gray-800 hover:bg-gray-100"
                      >
                        –
                      </button>
                      <span className="w-8 text-center text-sm font-medium text-gray-900">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(1)}
                        className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-sm text-gray-800 hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={submitting}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-black text-white text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? "Adding…" : "Add to bag"}
                  </button>
                </div>
              )}

              {/* System message */}
              {message && (
                <p className="text-xs text-gray-700 pt-1">{message}</p>
              )}

              {/* Meta info */}
              <div className="pt-2 border-t border-gray-200 mt-4 space-y-1.5">
                <p className="text-[11px] text-gray-500 uppercase tracking-[0.18em]">
                  Details
                </p>
                <p className="text-xs text-gray-500">
                  All data for this product is served from the Node / Express
                  backend using Neon + Drizzle. Images are stored via the admin
                  upload endpoint.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

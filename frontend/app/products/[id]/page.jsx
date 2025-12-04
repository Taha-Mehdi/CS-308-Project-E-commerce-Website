"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import SiteLayout from "../../../components/SiteLayout";
import StockBadge from "../../../components/StockBadge";
import { useAuth } from "../../../context/AuthContext";

export default function ProductDetailPage() {
  const { user } = useAuth(); // only need user; token comes from localStorage
  const params = useParams();
  const router = useRouter();
  const productId = params?.id;

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [product, setProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  // Load single product
  useEffect(() => {
    if (!productId) return;

    async function loadProduct() {
      setLoadingProduct(true);
      setMessage("");

      try {
        const res = await fetch(`${apiBase}/products/${productId}`);

        if (!res.ok) {
          setProduct(null);
          setMessage("Failed to load product.");
          setMessageType("error");
          setLoadingProduct(false);
          return;
        }

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          setProduct(null);
          setMessage("Unexpected response from server.");
          setMessageType("error");
          setLoadingProduct(false);
          return;
        }

        let data;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!data || !data.id) {
          setProduct(null);
          setMessage("Product not found.");
          setMessageType("error");
        } else {
          setProduct(data);
          setMessage("");
        }
      } catch (err) {
        console.error("Product detail load error:", err);
        setProduct(null);
        setMessage("Failed to load product.");
        setMessageType("error");
      } finally {
        setLoadingProduct(false);
      }
    }

    loadProduct();
  }, [apiBase, productId]);

  function handleQuantityChange(e) {
    const value = Number(e.target.value);
    if (Number.isNaN(value)) return;
    if (value < 1) setQuantity(1);
    else if (value > 99) setQuantity(99);
    else setQuantity(value);
  }

  async function handleAddToCart() {
    setMessage("");
    setMessageType("info");

    // get token exactly like other pages
    let authToken = null;
    if (typeof window !== "undefined") {
      authToken = localStorage.getItem("token") || null;
    }

    if (!user || !authToken) {
      setMessage("Please log in to add items to your bag.");
      setMessageType("error");
      return;
    }

    if (!product) return;

    setSubmitting(true);
    try {
      const body = {
        productId: Number(product.id),
        quantity: Number(quantity),
      };

      // IMPORTANT: backend is POST /cart/add
      const res = await fetch(`${apiBase}/cart/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(body),
      });

      const contentType = res.headers.get("content-type") || "";
      let data = null;
      let rawText = "";

      if (contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      } else {
        try {
          rawText = await res.text();
        } catch {
          rawText = "";
        }
      }

      if (!res.ok) {
        console.error("Add to cart failed:", {
          status: res.status,
          data,
          rawText,
        });

        const backendMessage =
          (data && data.message) || (rawText ? rawText : null);

        setMessage(
          backendMessage ||
            `Could not add this pair to your bag (status ${res.status}).`
        );
        setMessageType("error");
        return;
      }

      // update navbar cart badge
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cart-updated"));
      }

      setMessage("Added to your bag.");
      setMessageType("success");
    } catch (err) {
      console.error("Add to cart error:", err);
      setMessage("Something went wrong. Please try again.");
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  }

  const price = product ? Number(product.price || 0) : 0;
  const imageUrl =
    product && product.imageUrl ? `${apiBase}${product.imageUrl}` : null;

  return (
    <SiteLayout>
      <div className="space-y-6">
        {/* Breadcrumb + back link */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Link
              href="/"
              className="hover:text-gray-800 hover:underline underline-offset-4"
            >
              Home
            </Link>
            <span>/</span>
            <Link
              href="/products"
              className="hover:text-gray-800 hover:underline underline-offset-4"
            >
              Drops
            </Link>
            <span>/</span>
            <span className="text-gray-800">
              {product ? product.name : "Pair"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-[11px] text-gray-700 underline underline-offset-4 hover:text-black"
          >
            Back
          </button>
        </div>

        {loadingProduct ? (
          <p className="text-sm text-gray-500">Loading pair…</p>
        ) : !product ? (
          <p className="text-sm text-gray-500">
            We couldn&apos;t find this pair. It might have been removed.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
            {/* Left: image */}
            <div className="rounded-3xl bg-white border border-gray-200 overflow-hidden">
              <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[11px] uppercase tracking-[0.24em] text-gray-400">
                    Sneaks-up
                  </span>
                )}
              </div>
            </div>

            {/* Right: details */}
            <div className="space-y-5">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-500">
                  Drop
                </p>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
                  {product.name}
                </h1>
              </div>

              <div className="space-y-2">
                <p className="text-lg sm:text-xl font-semibold text-gray-900">
                  ${price.toFixed(2)}
                </p>
                <StockBadge stock={product.stock} tone="muted" />
              </div>

              {product.description && (
                <p className="text-sm text-gray-700 leading-relaxed">
                  {product.description}
                </p>
              )}

              {/* Add to bag controls */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-[11px] text-gray-500 uppercase tracking-[0.2em]">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={quantity}
                    onChange={handleQuantityChange}
                    className="w-20 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/30"
                  />
                </div>

                <button
                  type="button"
                  disabled={submitting || product.stock === 0}
                  onClick={handleAddToCart}
                  className="w-full rounded-full bg-black text-white text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] py-3 hover:bg-gray-900 active:bg-black disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {product.stock === 0
                    ? "Sold out"
                    : submitting
                    ? "Adding…"
                    : "Add to bag"}
                </button>

                {message && (
                  <p
                    className={`text-xs ${
                      messageType === "error"
                        ? "text-red-600"
                        : messageType === "success"
                        ? "text-green-600"
                        : "text-gray-600"
                    }`}
                  >
                    {message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

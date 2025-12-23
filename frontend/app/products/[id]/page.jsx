"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SiteLayout from "../../../components/SiteLayout";
import DripLink from "../../../components/DripLink";
import StockBadge from "../../../components/StockBadge";
import { useAuth } from "../../../context/AuthContext";
import { addToCartApi } from "../../../lib/api";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function ProductDetailPage() {
  const { user, logout } = useAuth();
  const params = useParams();
  const router = useRouter();
  const productId = params?.id;

  const [product, setProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [confirmDelivery, setConfirmDelivery] = useState(false);

  /* Load product */
  useEffect(() => {
    if (!productId) return;

    async function loadProduct() {
      setLoadingProduct(true);
      try {
        const res = await fetch(`${apiBase}/products/${productId}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setProduct(data);
      } catch {
        setProduct(null);
        setMessage("Product not found.");
        setMessageType("error");
      } finally {
        setLoadingProduct(false);
      }
    }

    loadProduct();
  }, [productId]);

  /* Load reviews */
  useEffect(() => {
    if (!productId) return;

    fetch(`${apiBase}/reviews/product/${productId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setReviews(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [productId]);

  function handleQuantityChange(e) {
    const v = Number(e.target.value);
    if (!Number.isNaN(v)) setQuantity(Math.max(1, Math.min(99, v)));
  }

  async function handleAddToCart() {
    if (!product) return;

    const maxStock = Number(product.stock || 0);
    if (maxStock > 0 && quantity > maxStock) {
      setMessage(`Only ${maxStock} in stock.`);
      setMessageType("error");
      return;
    }

    if (!user) {
      const raw = localStorage.getItem("guestCart") || "[]";
      const cart = JSON.parse(raw);
      const existing = cart.find((i) => i.productId === product.id);
      if (existing) existing.quantity += quantity;
      else cart.push({ productId: product.id, quantity });
      localStorage.setItem("guestCart", JSON.stringify(cart));
      window.dispatchEvent(new Event("cart-updated"));
      setMessage("Added to bag (guest).");
      setMessageType("success");
      return;
    }

    setSubmitting(true);
    try {
      await addToCartApi({ productId: product.id, quantity });
      window.dispatchEvent(new Event("cart-updated"));
      setMessage("Added to your bag.");
      setMessageType("success");
    } catch (err) {
      if (err.status === 401) logout();
      setMessage("Could not add to bag.");
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitReview(e) {
    e.preventDefault();

    if (!user) {
      setMessage("Log in to review.");
      setMessageType("error");
      return;
    }
    if (!confirmDelivery || !reviewText.trim()) {
      setMessage("Please complete all fields.");
      setMessageType("error");
      return;
    }

    setSubmitting(true);
    try {
      await fetch(`${apiBase}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          productId,
          rating,
          comment: reviewText,
        }),
      });

      setReviews((r) => [
        {
          id: Date.now(),
          userName: user.fullName || "You",
          rating,
          comment: reviewText,
          status: "pending",
          createdAt: new Date().toISOString(),
        },
        ...r,
      ]);

      setReviewText("");
      setConfirmDelivery(false);
      setRating(5);
      setMessage("Review submitted (pending approval).");
      setMessageType("success");
    } catch {
      setMessage("Failed to submit review.");
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  }

  const imageUrl =
    product?.imageUrl && !product.imageUrl.startsWith("http")
      ? `${apiBase}${product.imageUrl}`
      : product?.imageUrl;

  return (
    <SiteLayout>
      <div className="space-y-12 pb-24">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-gray-300/70">
          <div className="flex gap-2">
            <DripLink href="/">Home</DripLink>
            <span>/</span>
            <DripLink href="/products">Drops</DripLink>
            <span>/</span>
            <span className="text-white">{product?.name || "Pair"}</span>
          </div>
          <button
            onClick={() => router.back()}
            className="rounded-full border border-white/10 px-4 py-2 hover:bg-white/10 transition"
          >
            Back
          </button>
        </div>

        {loadingProduct ? (
          <div className="aspect-square rounded-[28px] bg-white/5 animate-pulse" />
        ) : !product ? (
          <p className="text-gray-400">Product not found.</p>
        ) : (
          <div className="grid gap-12 lg:grid-cols-2">
            {/* IMAGE */}
            <div className="rounded-[32px] overflow-hidden border border-border bg-black/20 backdrop-blur shadow-[0_16px_60px_rgba(0,0,0,0.45)]">
              <div className="aspect-square overflow-hidden">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    No image
                  </div>
                )}
              </div>
            </div>

            {/* DETAILS */}
            <div className="space-y-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-gray-300/60">
                  Sneaks-Up Drop
                </p>
                <h1 className="text-3xl sm:text-4xl font-semibold text-white">
                  {product.name}
                </h1>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-2xl font-semibold text-white">
                  ${Number(product.price).toFixed(2)}
                </span>
                <StockBadge stock={product.stock} tone="muted" />
              </div>

              {product.description && (
                <p className="text-sm text-gray-300/80 leading-relaxed">
                  {product.description}
                </p>
              )}

              {/* Add to bag */}
              <div className="pt-4 border-t border-white/10 space-y-4">
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={quantity}
                    onChange={handleQuantityChange}
                    className="w-20 h-11 rounded-full border border-border bg-white/5 text-center text-white"
                  />
                  <button
                    onClick={handleAddToCart}
                    disabled={submitting || product.stock <= 0}
                    className="
                      flex-1 h-11 rounded-full
                      bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                      text-black uppercase tracking-[0.18em] text-[11px] font-semibold
                      hover:opacity-95 transition active:scale-[0.98]
                      disabled:opacity-50
                    "
                  >
                    {product.stock <= 0
                      ? "Sold out"
                      : submitting
                      ? "Adding…"
                      : "Add to bag"}
                  </button>
                </div>

                {message && (
                  <div className="text-[11px] text-center text-gray-300/80">
                    {message}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* REVIEWS */}
        {product && (
          <div className="pt-12 space-y-8 border-t border-white/10">
            <h3 className="text-xl font-semibold text-white">
              Reviews & Ratings
            </h3>

            {reviews.length === 0 ? (
              <p className="text-gray-400">No reviews yet.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-[24px] border border-border bg-black/20 backdrop-blur p-5"
                  >
                    <p className="font-semibold text-white">
                      {r.userName || "User"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                    <p className="mt-2 text-sm text-gray-300">
                      {r.comment || "Pending approval"}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Review form */}
            <form
              onSubmit={handleSubmitReview}
              className="rounded-[28px] border border-border bg-black/25 backdrop-blur p-6 space-y-4"
            >
              <h4 className="text-white font-semibold">Leave a review</h4>

              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                disabled={!user}
                className="h-11 rounded-full border border-border bg-white/5 px-4 text-white"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} Stars
                  </option>
                ))}
              </select>

              <textarea
                rows={4}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                disabled={!user}
                placeholder="How do they fit?"
                className="w-full rounded-2xl border border-border bg-white/5 px-4 py-3 text-white"
              />

              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={confirmDelivery}
                  onChange={(e) => setConfirmDelivery(e.target.checked)}
                  disabled={!user}
                />
                I confirm I received this product
              </label>

              <button
                disabled={!user}
                className="
                  h-11 rounded-full bg-white text-black
                  uppercase tracking-[0.18em] text-[11px] font-semibold
                  hover:bg-gray-100 transition
                  disabled:opacity-50
                "
              >
                {user ? "Submit review" : "Log in to review"}
              </button>
            </form>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import SiteLayout from "../../../components/SiteLayout";
import StockBadge from "../../../components/StockBadge";
import { useAuth } from "../../../context/AuthContext";
import { addToCartApi } from "../../../lib/api";

export default function ProductDetailPage() {
  const { user, logout } = useAuth();
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

  // REVIEWS STATE
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [confirmDelivery, setConfirmDelivery] = useState(false);

  // 1. LOAD PRODUCT
  useEffect(() => {
    if (!productId) return;

    async function loadProduct() {
      setLoadingProduct(true);
      setMessage("");

      try {
        const res = await fetch(`${apiBase}/products/${productId}`);
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setProduct(data);
      } catch (err) {
        setProduct(null);
        setMessage("Product not found.");
        setMessageType("error");
      } finally {
        setLoadingProduct(false);
      }
    }

    loadProduct();
  }, [apiBase, productId]);

  // 2. LOAD REVIEWS (FROM REAL API NOW!)
  useEffect(() => {
    if (!productId) return;

    async function loadReviews() {
      try {
        const res = await fetch(`${apiBase}/reviews/product/${productId}`);
        if (res.ok) {
          const data = await res.json();
          // Backend returns the list, we just save it
          setReviews(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to load reviews", err);
      }
    }

    loadReviews();
  }, [apiBase, productId]);

  function handleQuantityChange(e) {
    const value = Number(e.target.value);
    if (!Number.isNaN(value) && value >= 1 && value <= 99) {
      setQuantity(value);
    }
  }

  // 3. ADD TO CART (With Guest Logic)
  async function handleAddToCart() {
    setMessage("");
    setMessageType("info");

    if (!product) return;

    // --- GUEST LOGIC ---
    if (!user) {
      try {
        const guestCart = JSON.parse(localStorage.getItem("guestCart") || "[]");
        const existingItem = guestCart.find(
            (item) => item.productId === Number(product.id)
        );

        if (existingItem) {
          existingItem.quantity += Number(quantity);
        } else {
          guestCart.push({
            productId: Number(product.id),
            quantity: Number(quantity),
            name: product.name,
            price: Number(product.price),
            imageUrl: product.imageUrl,
          });
        }
        localStorage.setItem("guestCart", JSON.stringify(guestCart));
        if (typeof window !== "undefined") window.dispatchEvent(new Event("cart-updated"));

        setMessage("Added to your bag (Guest).");
        setMessageType("success");
      } catch (err) {
        setMessage("Could not add to guest cart.");
        setMessageType("error");
      }
      return;
    }

    // --- LOGGED IN LOGIC ---
    setSubmitting(true);
    try {
      await addToCartApi({
        productId: Number(product.id),
        quantity: Number(quantity),
      });
      if (typeof window !== "undefined") window.dispatchEvent(new Event("cart-updated"));
      setMessage("Added to your bag.");
      setMessageType("success");
    } catch (err) {
      if (err.status === 401) {
        setMessage("Session expired. Please log in.");
        setMessageType("error");
        logout();
      } else {
        setMessage("Could not add to bag.");
        setMessageType("error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // 4. SUBMIT REVIEW (To Real API)
    async function handleSubmitReview(e) {
    e.preventDefault();
    if (!user) return setMessage("Please log in.");
    if (!confirmDelivery) return setMessage("Please confirm delivery.");
    if (!reviewText.trim()) return setMessage("Please add a comment.");

    const token = localStorage.getItem("token");
    setSubmitting(true);

    try {
      const res = await fetch(`${apiBase}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: Number(productId),
          rating: Number(rating),
          comment: reviewText.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Failed to submit review.");
        setMessageType("error");
      } else {
        // Success! Add to list locally so we see it immediately
        const newReview = {
          id: Date.now(),
          userName: user.fullName || user.email || "Me",
          rating: Number(rating),
          comment: null,
          status: "pending",
          createdAt: new Date().toISOString()
        };
        setReviews(prev => [newReview, ...prev]);
        setReviewText("");
        setConfirmDelivery(false);
        setMessage("Review submitted! Comment pending approval.");
        setMessageType("success");
      }
    } catch (err) {
      setMessage("Server error.");
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  }

  const price = product ? Number(product.price || 0) : 0;
  const imageUrl = product && product.imageUrl ? (product.imageUrl.startsWith("http") ? product.imageUrl : `${apiBase}${product.imageUrl}`) : null;

  return (
      <SiteLayout>
        <div className="space-y-6">
          {/* Breadcrumb + back link */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <Link href="/" className="hover:text-gray-800 hover:underline underline-offset-4">Home</Link>
              <span>/</span>
              <Link href="/products" className="hover:text-gray-800 hover:underline underline-offset-4">Drops</Link>
              <span>/</span>
              <span className="text-gray-800">{product ? product.name : "Pair"}</span>
            </div>
            <button onClick={() => router.back()} className="text-[11px] text-gray-700 underline underline-offset-4 hover:text-black">Back</button>
          </div>

          {loadingProduct ? (
              <p className="text-sm text-gray-500">Loading pair…</p>
          ) : !product ? (
              <p className="text-sm text-gray-500">Product not found.</p>
          ) : (
              <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
                {/* Left: image */}
                <div className="rounded-3xl bg-white border border-gray-200 overflow-hidden">
                  <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                    {imageUrl ? (
                        <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-[11px] uppercase tracking-[0.24em] text-gray-400">Sneaks-up</span>
                    )}
                  </div>
                </div>

                {/* Right: details */}
                <div className="space-y-5">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-500">Drop</p>
                    <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">{product.name}</h1>
                  </div>

                  <div className="space-y-2">
                    <p className="text-lg sm:text-xl font-semibold text-gray-900">${price.toFixed(2)}</p>
                    <StockBadge stock={product.stock} tone="muted" />
                  </div>

                  {product.description && (
                      <p className="text-sm text-gray-700 leading-relaxed">{product.description}</p>
                  )}

                  {/* Add to bag controls */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-[11px] text-gray-500 uppercase tracking-[0.2em]">Quantity</label>
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
                      {product.stock === 0 ? "Sold out" : submitting ? "Adding…" : "Add to bag"}
                    </button>

                    {message && (
                        <p className={`text-xs ${messageType === "error" ? "text-red-600" : "text-green-600"}`}>
                          {message}
                        </p>
                    )}
                  </div>
                </div>
              </div>
          )}

          {/* Reviews Section */}
          {product && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Reviews</p>
                    <p className="text-sm text-gray-600">Recent feedback on this drop.</p>
                  </div>
                </div>

                {reviews.length === 0 ? (
                    <p className="text-sm text-gray-500">No reviews yet.</p>
                ) : (
                    <div className="space-y-2">
                      {reviews.map((rev) => (
                          <div key={rev.id} className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-gray-900">{rev.userName || "User"}</p>
                              <span className="text-[11px] text-amber-600 font-semibold">
                        {"★".repeat(Math.max(1, Math.min(5, rev.rating || 1))).padEnd(5, "☆")}
                      </span>
                            </div>

                            {/* --- THE FIX: SHOW COMMENT IF APPROVED --- */}
                            {rev.status === 'approved' || rev.comment ? (
                                <p className="text-xs text-gray-700 mt-1">
                                  {/* If comment is null (from backend pending), show placeholder. If text exists, show it. */}
                                  {rev.comment || <span className="text-gray-400 italic">(Comment awaiting approval...)</span>}
                                </p>
                            ) : (
                                <p className="text-[10px] text-gray-400 italic mt-1">
                                  (Comment awaiting approval...)
                                </p>
                            )}

                            <p className="text-[10px] text-gray-400 mt-1">
                              {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : ""}
                            </p>
                          </div>
                      ))}
                    </div>
                )}

                <form onSubmit={handleSubmitReview} className="rounded-3xl border border-gray-200 bg-white/80 p-4 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Leave a review</p>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-700 font-medium">Rating</label>
                    <select
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                        className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900"
                        disabled={!user}
                    >
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} Stars</option>)}
                    </select>
                  </div>
                  <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      rows={3}
                      placeholder="Share your experience…"
                      className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                      disabled={!user}
                  />
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input type="checkbox" checked={confirmDelivery} onChange={(e) => setConfirmDelivery(e.target.checked)} disabled={!user} />
                    I confirm I received this product
                  </label>
                  <button
                      type="submit"
                      disabled={!user}
                      className="w-full rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.16em] py-2.5 disabled:opacity-50"
                  >
                    Submit review
                  </button>
                </form>
              </div>
          )}
        </div>
      </SiteLayout>
  );
}
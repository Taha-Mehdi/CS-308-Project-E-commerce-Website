"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import SiteLayout from "../../../components/SiteLayout";
import StockBadge from "../../../components/StockBadge";
import { useAuth } from "../../../context/AuthContext";
import { addToCartApi } from "../../../lib/api";

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

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

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [confirmDelivery, setConfirmDelivery] = useState(false);

  // 1. Load product
  useEffect(() => {
    if (!productId) return;

    async function loadProduct() {
      setLoadingProduct(true);
      setMessage("");

      try {
        const res = await fetch(`${apiBase}/products/${productId}`);
        if (!res.ok) throw new Error("Failed to load product");
        const data = await res.json();
        setProduct(data);
      } catch (err) {
        console.error("Load product error:", err);
        setProduct(null);
        setMessage("Product not found.");
        setMessageType("error");
      } finally {
        setLoadingProduct(false);
      }
    }

    loadProduct();
  }, [productId]);

  // 2. Load reviews
  useEffect(() => {
    if (!productId) return;

    async function loadReviews() {
      try {
        const res = await fetch(`${apiBase}/reviews/product/${productId}`);
        if (res.ok) {
          const data = await res.json();
          setReviews(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to load reviews:", err);
      }
    }

    loadReviews();
  }, [productId]);

  function handleQuantityChange(e) {
    const value = Number(e.target.value);
    if (Number.isNaN(value)) return;

    const safeValue = Math.max(1, Math.min(99, value));
    setQuantity(safeValue);
  }

  // 3. Add to cart
  async function handleAddToCart() {
    setMessage("");
    setMessageType("info");

    if (!product) return;

    const maxStock =
      typeof product.stock === "number" ? product.stock : Number(product.stock || 0);

    if (maxStock > 0 && quantity > maxStock) {
      setMessage(`Only ${maxStock} in stock for this drop.`);
      setMessageType("error");
      return;
    }

    // Guest cart
    if (!user) {
      try {
        const raw = localStorage.getItem("guestCart") || "[]";
        let guestCart = [];

        try {
          const parsed = JSON.parse(raw);
          guestCart = Array.isArray(parsed) ? parsed : [];
        } catch {
          guestCart = [];
        }

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
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("cart-updated"));
        }

        setMessage("Drop added to your bag (guest).");
        setMessageType("success");
      } catch (err) {
        console.error("Guest cart error:", err);
        setMessage("Could not add to guest bag.");
        setMessageType("error");
      }
      return;
    }

    // Logged-in cart
    setSubmitting(true);
    try {
      await addToCartApi({
        productId: Number(product.id),
        quantity: Number(quantity),
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cart-updated"));
      }

      setMessage("Drop added to your bag.");
      setMessageType("success");
    } catch (err) {
      console.error("Add to cart error:", err);
      if (err.status === 401) {
        setMessage("Session expired. Please log in again.");
        setMessageType("error");
        logout();
      } else {
        const apiMsg = err?.data?.message || err?.message;
        setMessage(apiMsg || "Could not add to bag.");
        setMessageType("error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // 4. Submit review
  async function handleSubmitReview(e) {
    e.preventDefault();
    setMessage("");
    setMessageType("info");

    if (!user) {
      setMessage("Please log in to leave a review.");
      setMessageType("error");
      return;
    }

    if (!confirmDelivery) {
      setMessage("Please confirm you received this product.");
      setMessageType("error");
      return;
    }

    if (!reviewText.trim()) {
      setMessage("Please add a comment to your review.");
      setMessageType("error");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("Session expired. Please log in again.");
      setMessageType("error");
      return;
    }

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
        const newReview = {
          id: Date.now(),
          userName: user.fullName || user.email || "Me",
          rating: Number(rating),
          comment: null,
          status: "pending",
          createdAt: new Date().toISOString(),
        };

        setReviews((prev) => [newReview, ...prev]);
        setReviewText("");
        setConfirmDelivery(false);
        setRating(5);
        setMessage("Review submitted! Comment is pending approval.");
        setMessageType("success");
      }
    } catch (err) {
      console.error("Submit review error:", err);
      setMessage("Server error while submitting review.");
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  }

  const price = product ? Number(product.price || 0) : 0;
  const imageUrl =
    product && product.imageUrl
      ? product.imageUrl.startsWith("http")
        ? product.imageUrl
        : `${apiBase}${product.imageUrl}`
      : null;

  return (
    <SiteLayout>
      <div className="space-y-10 pb-20">
        {/* Header: breadcrumb + back */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <Link
              href="/"
              className="hover:text-black hover:underline underline-offset-4"
            >
              Home
            </Link>
            <span>/</span>
            <Link
              href="/products"
              className="hover:text-black hover:underline underline-offset-4"
            >
              Drops
            </Link>
            <span>/</span>
            <span className="text-black font-bold">
              {product ? product.name : "Pair"}
            </span>
          </div>

          <button
            onClick={() => router.back()}
            className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-all active:scale-[0.97]"
          >
            Go Back
          </button>
        </div>

        {loadingProduct ? (
          <div className="flex justify-center py-20">
            <p className="text-lg text-gray-500 font-medium animate-pulse">
              Loading pair...
            </p>
          </div>
        ) : !product ? (
          <p className="text-lg text-gray-500">Product not found.</p>
        ) : (
          <div className="grid gap-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
            {/* Left: image */}
            <div className="rounded-[2rem] bg-white border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-500">
              <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                  />
                ) : (
                  <span className="text-xs uppercase tracking-[0.3em] text-gray-300 font-bold">
                    No Image
                  </span>
                )}
              </div>
            </div>

            {/* Right: details */}
            <div className="space-y-8">
              <div className="space-y-2">
                <p className="text-xs font-bold tracking-[0.25em] uppercase text-gray-400">
                  Sneaks-Up Drop
                </p>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-black leading-tight">
                  {product.name}
                </h1>
              </div>

              <div className="space-y-3">
                <p className="text-2xl sm:text-3xl font-bold text-black">
                  ${price.toFixed(2)}
                </p>
                <StockBadge stock={product.stock} />
              </div>

              {/* Specifications */}
              <div className="grid grid-cols-2 gap-4 rounded-2xl bg-gray-50 p-5 border border-gray-100">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    Model
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {product.model || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    Serial
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {product.serialNumber || product.serial || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    Warranty status
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {product.warrantyStatus || "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    Distributor
                  </p>
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {product.distributorInfo || "Official store"}
                  </p>
                </div>
              </div>

              {product.description && (
                <div className="prose prose-sm text-gray-600 leading-relaxed">
                  <p>{product.description}</p>
                </div>
              )}

              {/* Add to bag */}
              <div className="pt-4 space-y-4 border-t border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-gray-300 rounded-full px-4 py-3 bg-white">
                    <span className="text-xs font-bold mr-3 text-gray-500 uppercase tracking-wider">
                      Qty
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={quantity}
                      onChange={handleQuantityChange}
                      className="w-12 text-center text-lg font-bold text-black outline-none bg-transparent"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={
                      submitting ||
                      (typeof product.stock === "number" &&
                        product.stock <= 0)
                    }
                    onClick={handleAddToCart}
                    className="flex-1 rounded-full bg-black text-white text-sm font-bold uppercase tracking-[0.2em] py-4 hover:bg-gray-800 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-gray-200"
                  >
                    {typeof product.stock === "number" && product.stock <= 0
                      ? "Sold out"
                      : submitting
                      ? "Adding..."
                      : "Add to bag"}
                  </button>
                </div>

                {message && (
                  <div
                    className={`p-3 rounded-xl text-center text-sm font-bold ${
                      messageType === "error"
                        ? "bg-red-50 text-red-600"
                        : "bg-green-50 text-green-700"
                    }`}
                  >
                    {message}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reviews */}
        {product && (
          <div className="border-t border-gray-200 pt-12 space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-black">
                  Reviews & Ratings
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  See what others are saying about this drop.
                </p>
              </div>
            </div>

            {reviews.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-3xl border border-gray-100">
                <p className="text-gray-500 italic">
                  No reviews yet. Be the first to rate this pair!
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-gray-900">
                          {rev.userName || "Verified user"}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">
                          {rev.createdAt
                            ? new Date(rev.createdAt).toLocaleDateString()
                            : "Just now"}
                        </p>
                      </div>
                      <div className="text-yellow-400 text-lg tracking-widest">
                        {"★"
                          .repeat(Math.max(1, Math.min(5, rev.rating || 1)))
                          .padEnd(5, "☆")}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {rev.status === "approved" || rev.comment ? (
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {rev.comment || (
                            <span className="text-gray-400 italic font-medium">
                              No written comment.
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs font-bold text-amber-600 bg-amber-50 inline-block px-2 py-1 rounded-lg">
                          ⚠ Comment pending approval
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-gray-50 p-8 rounded-[2rem] border border-gray-200">
              <h4 className="font-bold text-lg mb-6 text-gray-900">
                Leave a Review
              </h4>
              <form onSubmit={handleSubmitReview} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Rating
                  </label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="block w-full md:w-48 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-black outline-none"
                    disabled={!user}
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} Stars {n === 5 && "(Best)"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Comment
                  </label>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    rows={4}
                    placeholder="How do they fit? How's the quality?"
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:ring-2 focus:ring-black outline-none"
                    disabled={!user}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="confirmDelivery"
                    checked={confirmDelivery}
                    onChange={(e) => setConfirmDelivery(e.target.checked)}
                    disabled={!user}
                    className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black"
                  />
                  <label
                    htmlFor="confirmDelivery"
                    className="text-sm font-medium text-gray-700 select-none cursor-pointer"
                  >
                    I confirm I received this product (required)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!user}
                  className="bg-black text-white px-10 py-4 rounded-full font-bold uppercase tracking-[0.2em] text-xs hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                >
                  {user ? "Submit Review" : "Log in to review"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
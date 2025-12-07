"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import SiteLayout from "../../../components/SiteLayout";
import StockBadge from "../../../components/StockBadge";
import { addReview, getReviewsByProduct } from "../../../lib/reviews";
import { useAuth } from "../../../context/AuthContext";
import { addToCartApi } from "../../../lib/api";

export default function ProductDetailPage() {
  const { user, logout } = useAuth(); // now also using logout
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
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [confirmDelivery, setConfirmDelivery] = useState(false);

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

  // Load local reviews for this product
  useEffect(() => {
    if (!productId) return;
    const next = getReviewsByProduct(productId);
    setReviews(next);
  }, [productId]);

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

    if (!product) return;

    // --- SCENARIO 1: GUEST USER (Local Storage) ---
    if (!user) {
      try {
        // 1. Get existing cart
        const guestCart = JSON.parse(localStorage.getItem("guestCart") || "[]");

        // 2. Check if product is already in cart
        const existingItem = guestCart.find(
            (item) => item.productId === Number(product.id)
        );

        if (existingItem) {
          // Update quantity
          existingItem.quantity += Number(quantity);
        } else {
          // Add new item
          // Note: We store name/price/image here so the Cart page can display it
          // without needing to fetch the product again from the server.
          guestCart.push({
            productId: Number(product.id),
            quantity: Number(quantity),
            name: product.name,
            price: Number(product.price),
            imageUrl: product.imageUrl,
          });
        }

        // 3. Save back to Local Storage
        localStorage.setItem("guestCart", JSON.stringify(guestCart));

        // 4. Notify the Navbar to update the badge
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("cart-updated"));
        }

        setMessage("Added to your bag.");
        setMessageType("success");
      } catch (err) {
        console.error("Guest cart error:", err);
        setMessage("Could not add to guest cart.");
        setMessageType("error");
      }
      return; // <--- STOP HERE (Do not run the API code below)
    }

    // --- SCENARIO 2: LOGGED IN USER (Database) ---
    setSubmitting(true);
    try {
      await addToCartApi({
        productId: Number(product.id),
        quantity: Number(quantity),
      });

      // update navbar cart badge
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cart-updated"));
      }

      setMessage("Added to your bag.");
      setMessageType("success");
    } catch (err) {
      console.error("Add to cart error:", err);

      if (err.status === 401) {
        setMessage("Your session has expired. Please log in again.");
        setMessageType("error");
        logout();
        router.push("/login");
      } else {
        setMessage(
            err.message ||
            "Could not add this pair to your bag. Please try again."
        );
        setMessageType("error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitReview(e) {
    e.preventDefault();

    // 1. Basic Checks
    if (!user) {
      setMessage("Please log in to leave a review.");
      setMessageType("error");
      return;
    }
    if (!confirmDelivery) {
      setMessage("Please confirm you received the product before reviewing.");
      setMessageType("error");
      return;
    }
    if (!rating || !reviewText.trim()) {
      setMessage("Please add a rating and a comment.");
      setMessageType("error");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("Session invalid. Please login again.");
      setMessageType("error");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      // 2. SEND TO BACKEND
      const res = await fetch(`${apiBase}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // Needed for the "Did I buy this?" check
        },
        body: JSON.stringify({
          productId: Number(productId),
          rating: Number(rating),
          comment: reviewText.trim(),
        }),
      });

      const data = await res.json();

      // 3. HANDLE ERRORS (e.g., Not Delivered)
      if (!res.ok) {
        setMessageType("error");
        setMessage(data.message || "Failed to submit review.");
        setSubmitting(false);
        return;
      }

      // 4. SUCCESS: Update UI immediately
      // We manually add the new review to the list so the user sees it right away
      const newReview = {
        id: Date.now(), // Temporary ID until page refresh
        userId: user.id,
        userEmail: user.email,
        rating: Number(rating),
        comment: reviewText.trim(), // We show it locally so the user knows it worked
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      setReviews((prev) => [newReview, ...prev]);
      setReviewText("");
      setConfirmDelivery(false);
      setMessage("Review submitted! Ratings are live, comment is pending approval.");
      setMessageType("success");

    } catch (err) {
      console.error("Review submit error:", err);
      setMessage("Server error. Please try again later.");
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

                  {/* Product metadata (mock/display only) */}
                  <div className="grid sm:grid-cols-2 gap-3 text-xs text-gray-600">
                    <div className="rounded-2xl border border-gray-200 bg-white/60 px-3 py-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                        Model / Serial
                      </p>
                      <p className="font-semibold text-gray-900">
                        {product.model || "Not set"} ·{" "}
                        {product.serialNumber || "N/A"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white/60 px-3 py-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                        Warranty / Distributor
                      </p>
                      <p className="font-semibold text-gray-900">
                        {product.warrantyStatus || "Standard warranty"} ·{" "}
                        {product.distributor || "Unknown distributor"}
                      </p>
                    </div>
                  </div>

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

          {/* Reviews */}
          {product && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                      Reviews & Ratings
                    </p>
                    <p className="text-sm text-gray-600">
                      Approved reviews are shown below. New reviews need manager
                      approval.
                    </p>
                  </div>
                  <span className="text-[11px] text-gray-500">
                {
                  reviews.filter((r) => r.status === "approved").length
                }{" "}
                    approved ·{" "}
                    {
                      reviews.filter((r) => r.status === "pending").length
                    }{" "}
                    pending
              </span>
                </div>

                {reviews.filter((r) => r.status === "approved").length === 0 ? (
                    <p className="text-sm text-gray-500">No reviews yet.</p>
                ) : (
                    <div className="space-y-2">
                      {reviews
                          .filter((r) => r.status === "approved")
                          .sort(
                              (a, b) =>
                                  new Date(b.createdAt) - new Date(a.createdAt)
                          )
                          .map((rev) => (
                              <div
                                  key={rev.id}
                                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5"
                              >
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-semibold text-gray-900">
                                    {rev.userEmail || "Customer"}
                                  </p>
                                  <span className="text-[11px] text-amber-600 font-semibold">
                          {"★"
                              .repeat(
                                  Math.max(1, Math.min(5, rev.rating || 1))
                              )
                              .padEnd(5, "☆")}
                        </span>
                                </div>
                                <p className="text-xs text-gray-700 mt-1">
                                  {rev.comment}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-1">
                                  {rev.createdAt
                                      ? new Date(
                                          rev.createdAt
                                      ).toLocaleString()
                                      : ""}
                                </p>
                              </div>
                          ))}
                    </div>
                )}

                <form
                    onSubmit={handleSubmitReview}
                    className="rounded-3xl border border-gray-200 bg-white/80 p-4 space-y-3"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Leave a review
                  </p>
                  {!user && (
                      <p className="text-sm text-red-600">
                        Please log in before rating this product.
                      </p>
                  )}
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-700 font-medium">
                      Rating
                    </label>
                    <select
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                        className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-black/20"
                        disabled={!user}
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} star{n === 1 ? "" : "s"}
                          </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      rows={3}
                      placeholder="Share your experience…"
                      className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/15"
                      disabled={!user}
                  />
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                        type="checkbox"
                        checked={confirmDelivery}
                        onChange={(e) =>
                            setConfirmDelivery(e.target.checked)
                        }
                        disabled={!user}
                    />
                    I confirm I received this product (required to review)
                  </label>
                  <button
                      type="submit"
                      disabled={!user}
                      className="w-full rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.16em] py-2.5 hover:bg-gray-900 disabled:opacity-50"
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
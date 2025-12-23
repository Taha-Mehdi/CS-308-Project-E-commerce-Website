"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SiteLayout from "../../../components/SiteLayout";
import DripLink from "../../../components/DripLink";
import { useAuth } from "../../../context/AuthContext";
import { addToCartApi } from "../../../lib/api";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ---------- helpers ---------- */
function getCategoryLabel(categoryId) {
  const n = Number(categoryId);
  if (!n) return "Uncategorized";
  if (n === 1) return "Low Top";
  if (n === 2) return "Mid Top";
  if (n === 3) return "High Top";
  return `Category #${n}`;
}

function formatStableDate(isoString) {
  if (!isoString || typeof isoString !== "string") return "";
  return isoString.slice(0, 10);
}

function resolveField(product, keys = []) {
  if (!product) return "—";

  for (const k of keys) {
    const v = product?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }

  const nests = ["specs", "details", "meta", "extra", "attributes", "info"];
  for (const nest of nests) {
    const obj = product?.[nest];
    if (!obj || typeof obj !== "object") continue;
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    }
  }

  return "—";
}

/* ---------- UI ---------- */
function Stars({ value = 0 }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <div className="flex items-center gap-1" aria-label={`Rating ${v} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < v ? "text-white text-sm" : "text-white/25 text-sm"}>
          ★
        </span>
      ))}
    </div>
  );
}

/** Premium glass pill + subtle hover sweep */
function GlassPill({ children }) {
  return (
    <span
      className="
        group relative inline-flex h-10 min-w-[140px] items-center justify-center
        rounded-full px-5
        text-[12px] font-medium tracking-[0.16em] uppercase
        text-white/90
        border border-white/12
        bg-white/[0.06] backdrop-blur-md
        shadow-[0_14px_55px_rgba(0,0,0,0.30)]
        overflow-hidden
      "
    >
      {/* base sheen */}
      <span
        aria-hidden="true"
        className="
          pointer-events-none absolute inset-0 rounded-full
          bg-[radial-gradient(140px_circle_at_25%_25%,rgba(255,255,255,0.22),transparent_62%),linear-gradient(to_right,rgba(255,255,255,0.10),transparent,rgba(255,255,255,0.06))]
          opacity-70
        "
      />
      {/* theme tint */}
      <span
        aria-hidden="true"
        className="
          pointer-events-none absolute inset-0 rounded-full
          bg-[linear-gradient(90deg,color-mix(in_oklab,var(--drip-accent)_28%,transparent),transparent,color-mix(in_oklab,var(--drip-accent-2)_24%,transparent))]
          opacity-60
        "
      />
      {/* subtle sweep (no glow spam) */}
      <span
        aria-hidden="true"
        className="
          pointer-events-none absolute -inset-y-10 -left-[60%] w-[45%]
          rotate-[18deg]
          bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.18),transparent)]
          opacity-0
          transition-all duration-[900ms] ease-out
          group-hover:opacity-100 group-hover:left-[120%]
        "
      />
      <span className="relative">{children}</span>
    </span>
  );
}

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

  useEffect(() => {
    if (!productId) return;

    async function loadProduct() {
      setLoadingProduct(true);
      setMessage("");
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

  useEffect(() => {
    if (!productId) return;
    fetch(`${apiBase}/reviews/product/${productId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setReviews(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [productId]);

  const imageUrl =
    product?.imageUrl && !String(product.imageUrl).startsWith("http")
      ? `${apiBase}${product.imageUrl}`
      : product?.imageUrl;

  const stock = Number(product?.stock || 0);
  const price = Number(product?.price || 0);
  const soldOut = stock <= 0;

  const model = useMemo(
    () => resolveField(product, ["model", "modelName", "modelNumber", "model_no"]),
    [product]
  );
  const serialNumber = useMemo(
    () =>
      resolveField(product, [
        "serialNumber",
        "serial",
        "serial_no",
        "serialNo",
        "modelSerial",
        "modelSerialNumber",
      ]),
    [product]
  );
  const warranty = useMemo(
    () =>
      resolveField(product, [
        "warranty_status",
        "warrantyStatus",
        "warranty",
        "warrantyInfo",
        "warrantyPeriod",
      ]),
    [product]
  );
  const distributor = useMemo(
    () =>
      resolveField(product, [
        "distributor_info",
        "distributorInfo",
        "distributor",
        "distributorName",
        "supplier",
        "vendor",
      ]),
    [product]
  );

  const avgRating = useMemo(() => {
    if (!reviews?.length) return 0;
    const nums = reviews.map((r) => Number(r?.rating || 0)).filter((n) => n > 0);
    if (!nums.length) return 0;
    const sum = nums.reduce((a, b) => a + b, 0);
    return Math.round((sum / nums.length) * 10) / 10;
  }, [reviews]);

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
      let cart = [];
      try {
        cart = JSON.parse(raw);
        if (!Array.isArray(cart)) cart = [];
      } catch {
        cart = [];
      }

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
      if (err?.status === 401) logout();
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
        body: JSON.stringify({ productId, rating, comment: reviewText }),
      });

      setReviews((r) => [
        {
          id: `local-${Date.now()}`,
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

  const messageStyle =
    messageType === "success"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
      : messageType === "error"
      ? "border-rose-400/20 bg-rose-500/10 text-rose-100"
      : "border-white/10 bg-white/5 text-gray-200/80";

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
            className="h-10 rounded-full border border-white/10 bg-white/5 px-4 hover:bg-white/10 transition"
          >
            Back
          </button>
        </div>

        {loadingProduct ? (
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-[32px] bg-white/5 animate-pulse h-[660px]" />
            <div className="rounded-[32px] bg-white/5 animate-pulse h-[660px]" />
          </div>
        ) : !product ? (
          <p className="text-gray-400">Product not found.</p>
        ) : (
          <section className="relative rounded-[44px] border border-white/10 bg-white/[0.03] backdrop-blur p-5 sm:p-7 shadow-[0_18px_70px_rgba(0,0,0,0.38)] overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_circle_at_16%_14%,rgba(168,85,247,0.20),transparent_58%),radial-gradient(1100px_circle_at_86%_52%,rgba(251,113,133,0.14),transparent_62%)]" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/18" />

            <div className="relative grid gap-10 lg:grid-cols-2 items-stretch">
              {/* LEFT: image only */}
              <div className="space-y-5">
                <div className="rounded-[34px] overflow-hidden border border-white/10 bg-white/[0.02] backdrop-blur shadow-[0_16px_60px_rgba(0,0,0,0.38)]">
                  <div className="aspect-[6/7] sm:aspect-[4/5] overflow-hidden">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={product.name}
                        className="w-full h-full object-contain"
                        style={{ background: "transparent" }}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-400">
                        No image
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT: title + pills + description + specs + CTA */}
              <div className="h-full flex flex-col">
                <div className="space-y-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-gray-300/60">
                      Sneaks-Up Drop
                    </p>
                    <h1 className="text-3xl sm:text-4xl font-semibold text-white">
                      {product.name}
                    </h1>

                    <div className="mt-3 flex items-center gap-3">
                      <Stars value={avgRating} />
                      <span className="text-[12px] text-gray-300/70">
                        {avgRating ? `${avgRating} / 5` : "No ratings yet"}
                      </span>
                      <span className="text-[12px] text-gray-300/50">
                        • {reviews.length} reviews
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <GlassPill>${price.toFixed(2)}</GlassPill>
                    <GlassPill>Stock · {Math.max(0, stock)}</GlassPill>
                    <GlassPill>{getCategoryLabel(product.categoryId)}</GlassPill>
                  </div>

                  {/* ✅ description moved to the right */}
                  {product.description && (
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur p-5 shadow-[0_14px_55px_rgba(0,0,0,0.28)]">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-gray-300/60">
                        About this pair
                      </p>
                      <p className="mt-2 text-sm text-gray-200/85 leading-relaxed">
                        {product.description}
                      </p>
                    </div>
                  )}

                  <div className="rounded-[30px] border border-white/10 bg-white/[0.04] backdrop-blur p-5 shadow-[0_16px_60px_rgba(0,0,0,0.32)]">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">
                          Model
                        </p>
                        <p className="mt-1 text-sm text-white">{model}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">
                          Serial Number
                        </p>
                        <p className="mt-1 text-sm text-white">{serialNumber}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">
                          Warranty
                        </p>
                        <p className="mt-1 text-sm text-white">{warranty}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">
                          Distributor
                        </p>
                        <p className="mt-1 text-sm text-white">{distributor}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <div className="rounded-[30px] border border-white/10 bg-white/[0.04] backdrop-blur p-5 shadow-[0_16px_60px_rgba(0,0,0,0.32)] space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-gray-300/70">
                        Quantity
                      </p>

                      <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] backdrop-blur p-1 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          className="h-9 w-9 rounded-full border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 transition active:scale-[0.98] grid place-items-center"
                          aria-label="Decrease quantity"
                        >
                          <span className="text-lg leading-none">−</span>
                        </button>

                        <div className="w-14 h-9 grid place-items-center">
                          <span className="text-sm font-semibold text-white">{quantity}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                          className="h-9 w-9 rounded-full border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 transition active:scale-[0.98] grid place-items-center"
                          aria-label="Increase quantity"
                        >
                          <span className="text-lg leading-none">+</span>
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleAddToCart}
                      disabled={submitting || soldOut}
                      className="w-full h-11 rounded-full bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] text-black uppercase tracking-[0.18em] text-[11px] font-semibold hover:opacity-95 transition active:scale-[0.98] disabled:opacity-50"
                    >
                      {soldOut ? "Sold out" : submitting ? "Adding…" : "Add to bag"}
                    </button>

                    {message && (
                      <div className={`rounded-2xl border px-4 py-3 text-[12px] ${messageStyle}`}>
                        {message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {product && (
          <section className="pt-12 space-y-8 border-t border-white/10">
            <h3 className="text-xl font-semibold text-white">Reviews & Ratings</h3>

            {reviews.length === 0 ? (
              <p className="text-gray-400">No reviews yet.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur p-5 shadow-[0_16px_60px_rgba(0,0,0,0.33)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{r.userName || "User"}</p>
                        <p className="text-xs text-gray-400">{formatStableDate(r.createdAt)}</p>
                      </div>
                      <Stars value={Number(r.rating || 0)} />
                    </div>

                    <p className="mt-2 text-sm text-gray-300">{r.comment || "Pending approval"}</p>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={handleSubmitReview}
              className="rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur p-6 space-y-4 shadow-[0_18px_70px_rgba(0,0,0,0.35)]"
            >
              <h4 className="text-white font-semibold">Leave a review</h4>

              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                disabled={!user}
                className="h-11 rounded-full border border-white/10 bg-white/[0.06] px-4 text-white"
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
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white placeholder:text-gray-300/45"
              />

              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={confirmDelivery}
                  onChange={(e) => setConfirmDelivery(e.target.checked)}
                  disabled={!user}
                  className="accent-white"
                />
                I confirm I received this product
              </label>

              <button
                disabled={!user}
                className="h-11 w-full rounded-full bg-white text-black uppercase tracking-[0.18em] text-[11px] font-semibold hover:bg-gray-100 transition disabled:opacity-50"
              >
                {user ? "Submit review" : "Log in to review"}
              </button>
            </form>
          </section>
        )}
      </div>
    </SiteLayout>
  );
}

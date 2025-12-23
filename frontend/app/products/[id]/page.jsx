"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/* ---------- UI bits ---------- */
function Stars({ value = 0, size = "text-sm" }) {
  const v = clamp(Number(value) || 0, 0, 5);
  const full = Math.floor(v);
  return (
    <div className="flex items-center gap-1" aria-label={`Rating ${v} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={[i < full ? "text-white" : "text-white/20", size, "leading-none"].join(" ")}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function Pill({ children, className = "" }) {
  return (
    <span
      className={[
        "inline-flex items-center justify-center",
        "rounded-full px-4 py-2",
        "border border-white/10 bg-black/45 backdrop-blur",
        "text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85",
        "shadow-[0_14px_55px_rgba(0,0,0,0.25)]",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-10 px-5 rounded-full border text-[11px] font-semibold uppercase tracking-[0.18em] transition",
        active
          ? "border-white/20 bg-white/10 text-white shadow-[0_18px_60px_rgba(0,0,0,0.30)]"
          : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function GlassCard({ children, className = "" }) {
  return (
    <div
      className={[
        "rounded-[30px] border border-white/10 bg-white/[0.04] backdrop-blur",
        "shadow-[0_18px_70px_rgba(0,0,0,0.35)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
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

  const [activeTab, setActiveTab] = useState("story"); // story | specs | reviews
  const topRef = useRef(null);

  const scrollToTabs = useCallback(() => {
    if (!topRef.current) return;
    topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Load product
  useEffect(() => {
    if (!productId) return;

    const controller = new AbortController();
    const signal = controller.signal;

    async function loadProduct() {
      setLoadingProduct(true);
      setMessage("");

      try {
        const res = await fetch(`${apiBase}/products/${productId}`, { signal, cache: "no-store" });
        if (!res.ok) throw new Error("not found");
        const data = await res.json();
        if (!signal.aborted) setProduct(data);
      } catch {
        if (!signal.aborted) {
          setProduct(null);
          setMessage("Product not found.");
          setMessageType("error");
        }
      } finally {
        if (!signal.aborted) setLoadingProduct(false);
      }
    }

    loadProduct();
    return () => controller.abort();
  }, [productId]);

  // Load reviews
  useEffect(() => {
    if (!productId) return;

    const controller = new AbortController();
    const signal = controller.signal;

    fetch(`${apiBase}/reviews/product/${productId}`, { signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (signal.aborted) return;
        setReviews(Array.isArray(d) ? d : []);
      })
      .catch(() => {});

    return () => controller.abort();
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

  const ratingCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      const v = clamp(Number(r?.rating || 0), 1, 5);
      if (v >= 1 && v <= 5) counts[v] += 1;
    }
    return counts;
  }, [reviews]);

  const messageStyle =
    messageType === "success"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
      : messageType === "error"
      ? "border-rose-400/20 bg-rose-500/10 text-rose-100"
      : "border-white/10 bg-white/5 text-gray-200/80";

  async function handleAddToCart() {
    if (!product) return;

    const maxStock = Number(product.stock || 0);
    if (maxStock > 0 && quantity > maxStock) {
      setMessage(`Only ${maxStock} in stock.`);
      setMessageType("error");
      return;
    }

    // Guest cart
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
      setActiveTab("reviews");
      scrollToTabs();
    } catch {
      setMessage("Failed to submit review.");
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SiteLayout>
      <div className="space-y-10 pb-24">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] uppercase tracking-[0.2em] text-gray-300/70">
          <div className="flex flex-wrap items-center gap-2">
            <DripLink href="/">Home</DripLink>
            <span>/</span>
            <DripLink href="/products">Drops</DripLink>
            <span>/</span>
            <span className="text-white">{product?.name || "Pair"}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="h-10 rounded-full border border-white/10 bg-white/5 px-4 hover:bg-white/10 transition"
            >
              Back
            </button>
            <DripLink
              href="/products"
              className="h-10 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 hover:bg-white/10 transition"
            >
              All drops
            </DripLink>
          </div>
        </div>

        {loadingProduct ? (
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-[34px] bg-white/5 animate-pulse h-[640px]" />
            <div className="rounded-[34px] bg-white/5 animate-pulse h-[640px]" />
          </div>
        ) : !product ? (
          <GlassCard className="p-10 text-center">
            <p className="text-gray-200/80">Product not found.</p>
            <DripLink
              href="/products"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-white text-black px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] hover:bg-gray-100 transition"
            >
              Back to drops
            </DripLink>
          </GlassCard>
        ) : (
          <>
            {/* HERO */}
            <section className="relative overflow-hidden rounded-[44px] border border-white/10 bg-white/[0.03] backdrop-blur p-4 sm:p-6 shadow-[0_18px_70px_rgba(0,0,0,0.38)]">
              {/* background aura */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_circle_at_16%_14%,rgba(168,85,247,0.22),transparent_58%),radial-gradient(1100px_circle_at_86%_52%,rgba(251,113,133,0.14),transparent_62%),radial-gradient(900px_circle_at_55%_70%,rgba(255,255,255,0.05),transparent_60%)]" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/18" />

              <div className="relative grid gap-6 lg:grid-cols-[1.25fr_0.75fr] items-start">
                {/* MEDIA */}
                <div className="space-y-4">
                  <div className="rounded-[34px] overflow-hidden border border-white/10 bg-black/15 shadow-[0_18px_70px_rgba(0,0,0,0.42)]">
                    <div className="relative h-[420px] sm:h-[540px] lg:h-[640px]">
                      {/* ✅ Category shown on image */}
                      <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                        <Pill>{getCategoryLabel(product.categoryId)}</Pill>
                      </div>

                      {/* corner label */}
                      <div className="absolute right-4 top-4 z-10">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 backdrop-blur">
                          <span className="inline-block size-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,1)]" />
                          <span className="text-[10px] uppercase tracking-[0.28em] text-white/80">
                            verified drop
                          </span>
                        </div>
                      </div>

                      {/* ✅ Image fills the card (no whitespace) */}
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product.name}
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="eager"
                          decoding="async"
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-gray-400">
                          No image
                        </div>
                      )}

                      {/* subtle bottom gradient for depth */}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                      {/* bottom name / tiny accent rail */}
                      <div className="absolute left-5 right-5 bottom-5">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-gray-200/70">
                          detected
                        </p>
                        <p className="mt-1 text-lg sm:text-xl font-semibold text-white line-clamp-1">
                          {product.name}
                        </p>
                        <div className="mt-3 h-[2px] w-full rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full w-[72%] bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] opacity-95" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: BUY + DETAILS (moved here) */}
                <div className="lg:sticky lg:top-5 space-y-4">
                  {/* BUY PANEL */}
                  <GlassCard className="p-5 sm:p-6">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-gray-300/60">
                      Sneaks-Up
                    </p>

                    <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white leading-tight">
                      {product.name}
                    </h1>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Stars value={avgRating} />
                      <span className="text-[12px] text-gray-300/70">
                        {avgRating ? `${avgRating} / 5` : "No ratings yet"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("reviews");
                          scrollToTabs();
                        }}
                        className="text-[12px] text-gray-200/70 hover:text-white transition"
                      >
                        ({reviews.length} reviews)
                      </button>
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-gray-300/60">
                          Price
                        </p>
                        <p className="mt-1 text-3xl font-semibold text-white">
                          ${price.toFixed(2)}
                        </p>
                      </div>

                      <div className="rounded-full px-4 py-2 border border-white/10 bg-black/25 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                        {soldOut ? "sold out" : `${Math.max(0, stock)} in stock`}
                      </div>
                    </div>

                    <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* Quantity + Add */}
                    <div className="mt-5 space-y-4">
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
                        className="
                          w-full h-11 rounded-full
                          bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                          text-black uppercase tracking-[0.18em] text-[11px] font-semibold
                          hover:opacity-95 transition active:scale-[0.98]
                          disabled:opacity-50 disabled:cursor-not-allowed
                          shadow-[0_18px_70px_rgba(0,0,0,0.35)]
                        "
                      >
                        {soldOut ? "Sold out" : submitting ? "Adding…" : "Add to bag"}
                      </button>

                      {!user && !soldOut && (
                        <p className="text-[11px] text-gray-300/60">
                          Guest mode: saved to bag until you log in.
                        </p>
                      )}

                      {message && (
                        <div className={`rounded-2xl border px-4 py-3 text-[12px] ${messageStyle}`}>
                          {message}
                        </div>
                      )}
                    </div>
                  </GlassCard>

                  {/* ✅ Model / Warranty / Distributor moved to the right */}
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <GlassCard className="p-4">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">
                        Model
                      </p>
                      <p className="mt-1 text-sm text-white line-clamp-1">{model}</p>
                      <p className="mt-2 text-[11px] text-gray-300/55 line-clamp-1">
                        Serial: {serialNumber}
                      </p>
                    </GlassCard>

                    <GlassCard className="p-4">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">
                        Warranty
                      </p>
                      <p className="mt-1 text-sm text-white line-clamp-2">{warranty}</p>
                    </GlassCard>

                    <GlassCard className="p-4">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">
                        Distributor
                      </p>
                      <p className="mt-1 text-sm text-white line-clamp-2">{distributor}</p>
                    </GlassCard>
                  </div>
                </div>
              </div>
            </section>

            {/* TABS */}
            <div ref={topRef} className="pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <TabButton active={activeTab === "story"} onClick={() => setActiveTab("story")}>
                  Story
                </TabButton>
                <TabButton active={activeTab === "specs"} onClick={() => setActiveTab("specs")}>
                  Specs
                </TabButton>
                <TabButton active={activeTab === "reviews"} onClick={() => setActiveTab("reviews")}>
                  Reviews
                </TabButton>
              </div>
            </div>

            {/* TAB PANELS */}
            {activeTab === "story" && (
              <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
                <GlassCard className="p-6">
                  <p className="text-[10px] uppercase tracking-[0.26em] text-gray-300/60">
                    About this pair
                  </p>
                  <p className="mt-3 text-sm text-gray-200/85 leading-relaxed">
                    {product.description || "No description yet — but the silhouette speaks for itself."}
                  </p>

                  <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">
                        Serial
                      </p>
                      <p className="mt-1 text-sm text-white">{serialNumber}</p>
                    </div>
                    <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">
                        Category
                      </p>
                      <p className="mt-1 text-sm text-white">{getCategoryLabel(product.categoryId)}</p>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="p-6">
                  <p className="text-[10px] uppercase tracking-[0.26em] text-gray-300/60">
                    Fit & feel
                  </p>
                  <div className="mt-4 space-y-3 text-[12px] text-gray-200/80">
                    <div className="flex items-center justify-between gap-3">
                      <span>Comfort</span>
                      <span className="text-white/80">High</span>
                    </div>
                    <div className="h-[2px] w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full w-[78%] bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] opacity-95" />
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                      <span>Style score</span>
                      <span className="text-white/80">Elite</span>
                    </div>
                    <div className="h-[2px] w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full w-[88%] bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] opacity-95" />
                    </div>

                    <div className="pt-3 text-[11px] text-gray-300/65">
                      (These are UI vibes — you can connect real sizing/fit data anytime.)
                    </div>
                  </div>
                </GlassCard>
              </section>
            )}

            {activeTab === "specs" && (
              <section className="grid gap-5 lg:grid-cols-2">
                <GlassCard className="p-6">
                  <p className="text-[10px] uppercase tracking-[0.26em] text-gray-300/60">
                    Identity
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
                </GlassCard>

                <GlassCard className="p-6">
                  <p className="text-[10px] uppercase tracking-[0.26em] text-gray-300/60">
                    Purchase notes
                  </p>

                  <div className="mt-4 space-y-3 text-[12px] text-gray-200/80">
                    <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">
                        Stock policy
                      </p>
                      <p className="mt-1">
                        Bag locks the intent — checkout confirms the inventory.
                      </p>
                    </div>

                    <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">
                        Reviews
                      </p>
                      <p className="mt-1">Reviews may be pending approval after submission.</p>
                    </div>
                  </div>
                </GlassCard>
              </section>
            )}

            {activeTab === "reviews" && (
              <section className="space-y-6">
                {/* Summary */}
                <GlassCard className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.26em] text-gray-300/60">
                        Ratings
                      </p>
                      <div className="mt-2 flex items-end gap-3">
                        <p className="text-4xl font-semibold text-white">
                          {avgRating ? avgRating : "—"}
                        </p>
                        <div className="pb-1">
                          <Stars value={avgRating} size="text-base" />
                          <p className="mt-1 text-[12px] text-gray-300/70">
                            {reviews.length} review{reviews.length === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* bars */}
                    <div className="min-w-[260px] flex-1 max-w-[520px] space-y-2">
                      {[5, 4, 3, 2, 1].map((n) => {
                        const total = Math.max(1, reviews.length);
                        const pct = Math.round((ratingCounts[n] / total) * 100);
                        return (
                          <div key={n} className="flex items-center gap-3">
                            <span className="w-10 text-[12px] text-gray-300/70">{n}★</span>
                            <div className="h-2 flex-1 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] opacity-95"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-10 text-right text-[12px] text-gray-300/70">
                              {pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </GlassCard>

                {/* Review list */}
                {reviews.length === 0 ? (
                  <GlassCard className="p-10 text-center">
                    <p className="text-gray-200/80">No reviews yet.</p>
                    <p className="mt-2 text-[12px] text-gray-300/70">
                      Be the first to review this drop.
                    </p>
                  </GlassCard>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {reviews.map((r) => (
                      <GlassCard key={r.id} className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate">
                              {r.userName || "User"}
                            </p>
                            <p className="text-xs text-gray-400">
                              {formatStableDate(r.createdAt)}
                            </p>
                          </div>
                          <Stars value={Number(r.rating || 0)} />
                        </div>

                        <p className="mt-3 text-sm text-gray-300">
                          {r.comment || "Pending approval"}
                        </p>

                        {String(r.status || "").toLowerCase() === "pending" && (
                          <div className="mt-3 inline-flex items-center rounded-full px-3 py-1 border border-white/10 bg-black/20 text-[10px] uppercase tracking-[0.22em] text-white/65">
                            pending
                          </div>
                        )}
                      </GlassCard>
                    ))}
                  </div>
                )}

                {/* Review form */}
                <form
                  onSubmit={handleSubmitReview}
                  className="rounded-[30px] border border-white/10 bg-white/[0.04] backdrop-blur p-6 space-y-4 shadow-[0_18px_70px_rgba(0,0,0,0.35)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="text-white font-semibold">Leave a review</h4>
                    {!user && <span className="text-[11px] text-gray-300/60">Log in to submit</span>}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
                    <select
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                      disabled={!user}
                      className="h-11 rounded-full border border-white/10 bg-white/[0.06] px-4 text-white focus:outline-none"
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} Stars
                        </option>
                      ))}
                    </select>

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
                  </div>

                  <textarea
                    rows={4}
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    disabled={!user}
                    placeholder="How do they fit? Comfort? Materials?"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white placeholder:text-gray-300/45 focus:outline-none"
                  />

                  <button
                    disabled={!user}
                    className="h-11 w-full rounded-full bg-white text-black uppercase tracking-[0.18em] text-[11px] font-semibold hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {user ? "Submit review" : "Log in to review"}
                  </button>
                </form>
              </section>
            )}
          </>
        )}
      </div>
    </SiteLayout>
  );
}

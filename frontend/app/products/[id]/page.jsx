"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import SiteLayout from "../../../components/SiteLayout";
import DripLink from "../../../components/DripLink";
import { useAuth } from "../../../context/AuthContext";
import {
  addToCartApi,
  addToWishlistApi,
  removeFromWishlistApi,
  getWishlistApi,
} from "../../../lib/api";

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

function getDiscountInfo(product, basePrice) {
  const p = Number(basePrice || 0);

  const pctRaw =
      product?.discountPercent ??
      product?.discount_percentage ??
      product?.discountPercentage ??
      product?.discount_pct ??
      product?.discountRate;

  const saleRaw =
      product?.discountedPrice ??
      product?.discount_price ??
      product?.discountPrice ??
      product?.salePrice ??
      product?.sale_price ??
      product?.finalPrice ??
      product?.final_price;

  let pct = Number(pctRaw);
  if (!Number.isFinite(pct)) pct = null;

  let sale = Number(saleRaw);
  if (!Number.isFinite(sale)) sale = null;

  if (pct !== null && pct > 0 && p > 0) {
    const computed = p * (1 - pct / 100);
    if (Number.isFinite(computed) && computed > 0) sale = computed;
  }

  if (sale !== null && (pct === null || pct <= 0) && p > 0 && sale < p) {
    pct = Math.round(((p - sale) / p) * 100);
  }

  const hasDiscount = sale !== null && p > 0 && sale < p && (pct ?? 0) > 0;
  const savings = hasDiscount ? Math.max(0, p - sale) : 0;

  return {
    hasDiscount,
    original: p,
    discounted: hasDiscount ? sale : null,
    percentOff: hasDiscount ? pct : null,
    savings,
  };
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

function StatLine({ label, value }) {
  return (
      <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">{label}</p>
        <p className="mt-1 text-sm text-white">{value}</p>
      </div>
  );
}

function ReviewCard({ r }) {
  const pending = String(r?.status || "").toLowerCase() === "pending";
  const name = r?.userName || "User";
  const date = formatStableDate(r?.createdAt);
  const rating = Number(r?.rating || 0);
  const comment = r?.comment;

  const showCommentSection = comment || pending;

  return (
      <GlassCard className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="size-10 rounded-full border border-white/10 bg-white/5 grid place-items-center text-white/80 text-sm">
              {String(name || "U").trim().slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">{name}</p>
              <p className="text-xs text-gray-400">{date}</p>
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-end gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <Stars value={rating} />
              <span className="text-[11px] text-white/80 font-semibold">{rating}/5</span>
            </div>
            {pending && (
                <span className="inline-flex items-center rounded-full px-3 py-1 border border-amber-500/20 bg-amber-500/10 text-[10px] uppercase tracking-[0.22em] text-amber-200/80">
              Pending
            </span>
            )}
          </div>
        </div>

        {showCommentSection && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-[13px] leading-relaxed text-gray-200/85">
                {comment || (
                    <span className="text-amber-200/70 italic">Pending review...</span>
                )}
              </p>
            </div>
        )}
      </GlassCard>
  );
}

function GlassSelect({ value, onChange, options, widthClass = "w-[220px]" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selected = useMemo(
      () => options.find((o) => o.value === value) || options[0],
      [options, value]
  );

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
      <div ref={rootRef} className={`relative ${widthClass} z-[60]`}>
        <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={[
              "h-11 w-full rounded-full border border-white/10",
              "bg-white/[0.06] backdrop-blur-md px-4 pr-10 text-left",
              "text-[12px] text-gray-100 shadow-[0_10px_34px_rgba(0,0,0,0.22)]",
              "focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_35%,transparent)]",
            ].join(" ")}
        >
          <span className="block truncate">{selected?.label}</span>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/70 text-xs">
          ▾
        </span>
        </button>

        {open && (
            <div className="absolute z-[90] mt-2 w-full rounded-2xl overflow-hidden border border-white/10 bg-black/85 text-white shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur">
              <div className="p-1">
                {options.map((opt) => {
                  const active = opt.value === value;
                  return (
                      <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            onChange(opt.value);
                            setOpen(false);
                          }}
                          className={[
                            "w-full text-left px-3 py-2 rounded-xl text-[12px] font-medium transition",
                            active ? "bg-white text-black" : "hover:bg-white/10 text-white/85",
                          ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate">{opt.label}</span>
                          {active && (
                              <span className="text-[10px] uppercase tracking-[0.18em] opacity-70">
                        selected
                      </span>
                          )}
                        </div>
                      </button>
                  );
                })}
              </div>
            </div>
        )}
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

  const [activeTab, setActiveTab] = useState("story");
  const topRef = useRef(null);

  const [wishlistIds, setWishlistIds] = useState(() => new Set());
  const [wishToggling, setWishToggling] = useState(false);

  const scrollToTabs = useCallback(() => {
    if (!topRef.current) return;
    topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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

  useEffect(() => {
    let alive = true;

    async function loadWishlist() {
      if (!user) {
        if (alive) setWishlistIds(new Set());
        return;
      }
      try {
        const data = await getWishlistApi();
        const ids = new Set(
            Array.isArray(data)
                ? data
                    .map((x) => (typeof x === "number" ? x : Number(x?.productId)))
                    .filter((n) => Number.isInteger(n) && n > 0)
                : []
        );
        if (alive) setWishlistIds(ids);
      } catch {
        if (alive) setWishlistIds(new Set());
      }
    }

    loadWishlist();
    return () => {
      alive = false;
    };
  }, [user]);

  const imageUrl =
      product?.imageUrl && !String(product.imageUrl).startsWith("http")
          ? `${apiBase}${product.imageUrl}`
          : product?.imageUrl;

  const stock = Number(product?.stock || 0);
  const price = Number(product?.price || 0);
  const soldOut = stock <= 0;

  const discountInfo = useMemo(() => getDiscountInfo(product, price), [product, price]);

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

  async function toggleWishlist() {
    if (!product?.id) return;

    if (!user) {
      setMessage("Please log in to use wishlist.");
      setMessageType("error");
      return;
    }

    const productIdNum = Number(product.id);
    const currentlyWished = wishlistIds.has(productIdNum);

    setWishToggling(true);

    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (currentlyWished) next.delete(productIdNum);
      else next.add(productIdNum);
      return next;
    });

    try {
      if (currentlyWished) await removeFromWishlistApi(productIdNum);
      else await addToWishlistApi(productIdNum);
      setMessage(currentlyWished ? "Removed from wishlist." : "Added to wishlist.");
      setMessageType("success");
    } catch {
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (currentlyWished) next.add(productIdNum);
        else next.delete(productIdNum);
        return next;
      });
      setMessage("Wishlist action failed.");
      setMessageType("error");
    } finally {
      setWishToggling(false);
    }
  }

  async function handleSubmitReview(e) {
    e.preventDefault();

    if (!user) {
      setMessage("Log in to review.");
      setMessageType("error");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const res = await fetch(`${apiBase}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          productId,
          rating,
          comment: reviewText.trim() || null
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Failed to submit review.");
        setMessageType("error");
        return;
      }

      // ✅ FIX: Use status from backend logic
      const newStatus = data.status || (reviewText.trim() ? "pending" : "approved");

      setReviews((r) => [
        {
          id: `local-${Date.now()}`,
          userName: user.fullName || "You",
          rating,
          comment: reviewText.trim() || null,
          status: newStatus,
          createdAt: new Date().toISOString(),
        },
        ...r,
      ]);

      setReviewText("");
      setRating(5);
      setMessage(newStatus === "approved" ? "Rating submitted!" : "Review submitted (pending approval).");
      setMessageType("success");
      setActiveTab("reviews");
      scrollToTabs();
    } catch (err) {
      setMessage("Network error. Please try again.");
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  }

  const ratingOptions = useMemo(
      () => [5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} Stars` })),
      []
  );

  return (
      <SiteLayout>
        <div className="space-y-10 pb-24">
          {/* Top nav */}
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
                  className="h-10 rounded-full border border-white/10 bg-white/5 px-4 hover:bg-white/10 transition text-[11px] font-semibold uppercase tracking-[0.18em]"
              >
                BACK
              </button>
              <DripLink
                  href="/products"
                  className="h-10 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 hover:bg-white/10 transition text-[11px] font-semibold uppercase tracking-[0.18em]"
              >
                ALL DROPS
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
              </GlassCard>
          ) : (
              <>
                {/* HERO */}
                <section className="relative overflow-hidden rounded-[44px] border border-white/10 bg-white/[0.03] backdrop-blur p-4 sm:p-6 shadow-[0_18px_70px_rgba(0,0,0,0.38)]">
                  {/* ... same hero styles ... */}
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_circle_at_16%_14%,rgba(168,85,247,0.22),transparent_58%),radial-gradient(1100px_circle_at_86%_52%,rgba(251,113,133,0.14),transparent_62%),radial-gradient(900px_circle_at_55%_70%,rgba(255,255,255,0.05),transparent_60%)]" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/18" />

                  <div className="relative grid gap-6 lg:grid-cols-[1.25fr_0.75fr] items-stretch">
                    {/* LEFT: image */}
                    <div className="h-full">
                      <div className="rounded-[34px] overflow-hidden border border-white/10 bg-black/15 shadow-[0_18px_70px_rgba(0,0,0,0.42)] h-full">
                        <div className="relative h-[420px] sm:h-[540px] lg:h-[640px]">
                          <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                            <Pill>{getCategoryLabel(product.categoryId)}</Pill>
                            {discountInfo.hasDiscount && (
                                <Pill className="bg-white/5">
                                  {discountInfo.percentOff}% OFF • SAVE ${discountInfo.savings.toFixed(2)}
                                </Pill>
                            )}
                          </div>

                          <div className="absolute right-4 top-4 z-10">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 backdrop-blur">
                              <span className="inline-block size-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,1)]" />
                              <span className="text-[10px] uppercase tracking-[0.28em] text-white/80">
                            verified drop
                          </span>
                            </div>
                          </div>

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

                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

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

                    {/* RIGHT: details card */}
                    <div className="h-full">
                      <GlassCard className="p-5 sm:p-6 h-full">
                        <div className="h-full flex flex-col">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.28em] text-gray-300/60">
                              Sneaks-Up
                            </p>
                            <h1 className="mt-2 text-xl sm:text-2xl font-semibold text-white leading-tight">
                              {product.name}
                            </h1>
                          </div>

                          {/* Rating + stock */}
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                              <Stars value={avgRating} />
                              <span className="text-[11px] text-white/80 font-semibold">
                            {avgRating ? `${avgRating}/5` : "—"}
                          </span>
                              <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab("reviews");
                                    scrollToTabs();
                                  }}
                                  className="text-[11px] text-gray-200/70 hover:text-white transition"
                              >
                                ({reviews.length})
                              </button>
                            </div>

                            <div className="rounded-full px-4 py-2 border border-white/10 bg-black/25 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                              {soldOut ? "SOLD OUT" : `${Math.max(0, stock)} IN STOCK`}
                            </div>
                          </div>

                          {/* Price block */}
                          <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-[0.22em] text-gray-300/60">
                                  Price
                                </p>

                                {!discountInfo.hasDiscount ? (
                                    <p className="mt-1 text-3xl font-semibold text-white">
                                      ${price.toFixed(2)}
                                    </p>
                                ) : (
                                    <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
                                <span className="text-[13px] text-gray-300/60 line-through decoration-white/35">
                                  ${discountInfo.original.toFixed(2)}
                                </span>
                                      <span className="text-3xl font-semibold text-white">
                                  ${Number(discountInfo.discounted).toFixed(2)}
                                </span>
                                    </div>
                                )}
                              </div>

                              {discountInfo.hasDiscount ? (
                                  <div className="shrink-0 text-right">
                              <span className="inline-flex items-center rounded-full px-3 py-1 border border-white/10 bg-black/35 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">
                                {discountInfo.percentOff}% OFF
                              </span>
                                    <p className="mt-2 text-[12px] text-gray-200/75">
                                      Save{" "}
                                      <span className="text-white font-semibold">
                                  ${discountInfo.savings.toFixed(2)}
                                </span>
                                    </p>
                                  </div>
                              ) : (
                                  <div className="shrink-0 text-right">
                              <span className="inline-flex items-center rounded-full px-3 py-1 border border-white/10 bg-white/5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                                STANDARD
                              </span>
                                  </div>
                              )}
                            </div>
                          </div>

                          {/* Wishlist */}
                          <button
                              type="button"
                              onClick={toggleWishlist}
                              disabled={wishToggling}
                              className={[
                                "mt-4 h-11 w-full rounded-full border border-white/10 bg-white/[0.06] backdrop-blur",
                                "text-[11px] font-semibold uppercase tracking-[0.18em] transition",
                                "hover:bg-white/[0.10] active:scale-[0.98]",
                                "disabled:opacity-60 disabled:cursor-not-allowed",
                              ].join(" ")}
                          >
                            {wishlistIds.has(Number(product.id)) ? "♥ WISHLISTED" : "♡ ADD TO WISHLIST"}
                          </button>

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
                                className={[
                                  "block w-full h-11 rounded-full",
                                  "bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]",
                                  "text-black uppercase tracking-[0.18em] text-[11px] font-semibold",
                                  "hover:opacity-95 transition active:scale-[0.98]",
                                  "disabled:opacity-50 disabled:cursor-not-allowed",
                                  "shadow-[0_18px_70px_rgba(0,0,0,0.35)]",
                                ].join(" ")}
                            >
                              {soldOut ? "SOLD OUT" : submitting ? "ADDING…" : "ADD TO BAG"}
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

                          <div className="mt-auto" />
                        </div>
                      </GlassCard>
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

                {/* Story */}
                {activeTab === "story" && (
                    <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
                      <GlassCard className="p-6">
                        <p className="text-[10px] uppercase tracking-[0.26em] text-gray-300/60">
                          About this pair
                        </p>
                        <p className="mt-4 text-base sm:text-lg text-gray-100/90 leading-relaxed font-medium">
                          {product.description ||
                              "No description yet — but the silhouette speaks for itself."}
                        </p>
                        <div className="mt-7 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        <div className="mt-6 flex flex-wrap items-center gap-2">
                          <Pill className="bg-white/5">Category: {getCategoryLabel(product.categoryId)}</Pill>
                          {soldOut ? <Pill className="bg-white/5">Sold out</Pill> : <Pill className="bg-white/5">{Math.max(0, stock)} in stock</Pill>}
                          {discountInfo.hasDiscount && (
                              <Pill className="bg-white/5">
                                {discountInfo.percentOff}% off • save ${discountInfo.savings.toFixed(2)}
                              </Pill>
                          )}
                        </div>
                      </GlassCard>

                      <GlassCard className="p-6">
                        <p className="text-[10px] uppercase tracking-[0.26em] text-gray-300/60">
                          Drop details
                        </p>
                        <div className="mt-5 grid gap-3">
                          <StatLine label="Model" value={model} />
                          <StatLine label="Serial" value={serialNumber} />
                          <StatLine label="Warranty" value={warranty} />
                          <StatLine label="Distributor" value={distributor} />
                        </div>
                      </GlassCard>
                    </section>
                )}

                {/* Specs */}
                {activeTab === "specs" && (
                    <section className="grid gap-5 lg:grid-cols-2">
                      <GlassCard className="p-6">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-[10px] uppercase tracking-[0.26em] text-gray-300/60">Specs</p>
                          <span className="text-[10px] uppercase tracking-[0.22em] text-gray-300/60">
                      {getCategoryLabel(product.categoryId)}
                    </span>
                        </div>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <StatLine label="Category" value={getCategoryLabel(product.categoryId)} />
                          <StatLine label="Stock" value={soldOut ? "Sold out" : `${Math.max(0, stock)} available`} />
                          <StatLine label="Model" value={model} />
                          <StatLine label="Serial Number" value={serialNumber} />
                          <StatLine label="Warranty" value={warranty} />
                          <StatLine label="Distributor" value={distributor} />
                        </div>
                      </GlassCard>

                      <GlassCard className="p-6">
                        <p className="text-[10px] uppercase tracking-[0.26em] text-gray-300/60">Pricing</p>
                        <div className="mt-5 rounded-[22px] border border-white/10 bg-black/15 p-5">
                          {!discountInfo.hasDiscount ? (
                              <div className="flex items-end justify-between gap-3">
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">
                                    Current price
                                  </p>
                                  <p className="mt-1 text-3xl font-semibold text-white">
                                    ${price.toFixed(2)}
                                  </p>
                                </div>
                                <span className="text-[11px] text-gray-300/60">No discount</span>
                              </div>
                          ) : (
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-end justify-between gap-3">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">
                                      Discounted
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
                              <span className="text-[13px] text-gray-300/60 line-through decoration-white/35">
                                ${discountInfo.original.toFixed(2)}
                              </span>
                                      <span className="text-3xl font-semibold text-white">
                                ${Number(discountInfo.discounted).toFixed(2)}
                              </span>
                                    </div>
                                  </div>

                                  <div className="text-right">
                            <span className="inline-flex items-center rounded-full px-3 py-1 border border-white/10 bg-black/35 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">
                              {discountInfo.percentOff}% OFF
                            </span>
                                    <p className="mt-2 text-[12px] text-gray-200/75">
                                      You save{" "}
                                      <span className="text-white font-semibold">
                                ${discountInfo.savings.toFixed(2)}
                              </span>
                                    </p>
                                  </div>
                                </div>

                                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                  <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">
                                    Deal status
                                  </p>
                                  <p className="mt-1 text-sm text-white">
                                    Active discount applied to this drop.
                                  </p>
                                </div>
                              </div>
                          )}
                        </div>
                      </GlassCard>
                    </section>
                )}

                {/* Reviews */}
                {activeTab === "reviews" && (
                    <section className="space-y-6">
                      <GlassCard className="p-6">
                        <div className="flex flex-wrap items-start justify-between gap-6">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.26em] text-gray-300/60">
                              Ratings
                            </p>

                            <div className="mt-3 inline-flex items-center gap-3 rounded-[22px] border border-white/10 bg-black/15 px-4 py-3">
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

                      {reviews.length === 0 ? (
                          <GlassCard className="p-10 text-center">
                            <p className="text-gray-200/80 text-lg font-semibold">No reviews yet</p>
                            <p className="mt-2 text-[12px] text-gray-300/70">
                              Be the first to review this drop.
                            </p>
                          </GlassCard>
                      ) : (
                          <div className="grid gap-4 md:grid-cols-2">
                            {reviews.map((r) => (
                                <ReviewCard key={r.id} r={r} />
                            ))}
                          </div>
                      )}

                      <form
                          onSubmit={handleSubmitReview}
                          className="rounded-[30px] border border-white/10 bg-white/[0.04] backdrop-blur p-6 shadow-[0_18px_70px_rgba(0,0,0,0.35)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.26em] text-gray-300/60">
                              Leave a review
                            </p>
                            <p className="mt-1 text-sm text-gray-200/80">
                              Share comfort, materials, and overall feel.
                            </p>
                          </div>
                          {!user && <span className="text-[11px] text-gray-300/60">Log in to submit</span>}
                        </div>

                        <div className="mt-5 grid gap-3 lg:grid-cols-[260px_1fr] items-start">
                          <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-[0.22em] text-gray-300/60">
                              Rating
                            </p>
                            <GlassSelect
                                value={rating}
                                onChange={(v) => setRating(Number(v))}
                                options={ratingOptions}
                                widthClass="w-full"
                            />
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2">
                              <Stars value={rating} />
                              <span className="text-[11px] text-gray-200/75">
                          {rating}/5 selected
                        </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {/* ✅ REMOVED: Delivery confirmation checkbox */}
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-gray-300/60">
                            Your review <span className="opacity-50 lowercase tracking-normal">(optional)</span>
                          </p>
                          <textarea
                              rows={4}
                              value={reviewText}
                              onChange={(e) => setReviewText(e.target.value)}
                              disabled={!user}
                              placeholder="Fit, comfort, materials — tell us what you noticed."
                              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-gray-300/45 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_35%,transparent)]"
                          />
                        </div>

                        <div className="mt-4">
                          <button
                              disabled={!user}
                              className="h-11 w-full rounded-full bg-white text-black uppercase tracking-[0.18em] text-[11px] font-semibold hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {user ? "SUBMIT REVIEW" : "LOG IN TO REVIEW"}
                          </button>
                        </div>
                      </form>
                    </section>
                )}
              </>
          )}
        </div>
      </SiteLayout>
  );
}
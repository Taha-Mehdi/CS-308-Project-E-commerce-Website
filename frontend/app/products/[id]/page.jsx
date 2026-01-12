"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function GlassCard({ children, className = "" }) {
  return (
      <div
          className={[
            "rounded-[34px] border border-white/10 bg-white/[0.04] backdrop-blur",
            "shadow-[0_18px_70px_rgba(0,0,0,0.35)]",
            className,
          ].join(" ")}
      >
        {children}
      </div>
  );
}

function SectionTitle({ kicker, title, desc, right }) {
  return (
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          {kicker ? (
              <p className="text-[10px] uppercase tracking-[0.30em] text-gray-300/60">{kicker}</p>
          ) : null}
          <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">{title}</h2>
          {desc ? <p className="text-[12px] sm:text-sm text-gray-200/70 max-w-2xl">{desc}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
  );
}

function Banner({ type = "info", children, onClose }) {
  const styles =
      type === "success"
          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
          : type === "error"
              ? "border-rose-400/20 bg-rose-500/10 text-rose-100"
              : "border-white/10 bg-white/5 text-gray-200/80";

  return (
      <div className={`relative rounded-2xl border px-4 py-3 text-[12px] ${styles}`}>
        <div className="pr-10">{children}</div>
        {onClose ? (
            <button
                type="button"
                onClick={onClose}
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 hover:text-white hover:bg-white/[0.08] transition"
                aria-label="Dismiss"
            >
              ✕
            </button>
        ) : null}
      </div>
  );
}

function SpecGrid({ items }) {
  return (
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((it) => (
            <div key={it.label} className="rounded-[22px] border border-white/10 bg-black/15 p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">{it.label}</p>
              <p className="mt-1 text-sm text-white">{it.value}</p>
            </div>
        ))}
      </div>
  );
}

function ReviewCard({ r }) {
  const pending = String(r?.status || "").toLowerCase() === "pending";
  const name = r?.userName || "User";
  const date = formatStableDate(r?.createdAt);
  const rating = Number(r?.rating || 0);
  const comment = r?.comment;

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

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-[13px] leading-relaxed text-gray-200/85">{comment}</p>
        </div>
      </GlassCard>
  );
}

function GlassSelect({ value, onChange, options, widthClass = "w-full" }) {
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
              "transition hover:bg-white/[0.10]",
            ].join(" ")}
            aria-haspopup="listbox"
            aria-expanded={open}
        >
          <span className="block truncate">{selected?.label}</span>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/70 text-xs">
          ▾
        </span>
        </button>

        {open && (
            <div className="absolute z-[90] mt-2 w-full rounded-2xl overflow-hidden border border-white/10 bg-black/85 text-white shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur">
              <div className="p-1" role="listbox">
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
                          role="option"
                          aria-selected={active}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate">{opt.label}</span>
                          {active ? (
                              <span className="text-[10px] uppercase tracking-[0.18em] opacity-70">selected</span>
                          ) : null}
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

  const storyRef = useRef(null);
  const specsRef = useRef(null);
  const reviewsRef = useRef(null);

  const [product, setProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(true);

  const [quantity, setQuantity] = useState(1);

  const [submittingCart, setSubmittingCart] = useState(false);
  const [addedPulse, setAddedPulse] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const [wishlistIds, setWishlistIds] = useState(() => new Set());
  const [wishPulse, setWishPulse] = useState(false);

  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [canReview, setCanReview] = useState(false);

  const scrollTo = useCallback((ref) => {
    if (!ref?.current) return;
    ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  /* ---------- load product ---------- */
  useEffect(() => {
    if (!productId) return;

    const controller = new AbortController();
    const signal = controller.signal;

    async function loadProduct() {
      setLoadingProduct(true);
      setMessage("");

      try {
        const res = await fetch(`${apiBase}/products/${productId}`, {
          signal,
          cache: "no-store",
        });
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

  /* ---------- load reviews (token for private rows when logged in) ---------- */
  useEffect(() => {
    if (!productId) return;

    const controller = new AbortController();
    const signal = controller.signal;

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    fetch(`${apiBase}/reviews/product/${productId}`, {
      signal,
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => {
          if (signal.aborted) return;
          setReviews(Array.isArray(d) ? d : []);
        })
        .catch(() => {});

    return () => controller.abort();
  }, [productId]);

  /* ---------- delivered-only eligibility ---------- */
  useEffect(() => {
    let alive = true;

    async function checkEligibility() {
      if (!user || !productId) {
        if (alive) setCanReview(false);
        return;
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) {
        if (alive) setCanReview(false);
        return;
      }

      setCheckingEligibility(true);

      try {
        const res = await fetch(`${apiBase}/orders/my`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        const ordersArr = Array.isArray(data?.orders) ? data.orders : [];
        const itemsArr = Array.isArray(data?.items) ? data.items : [];

        const deliveredOrderIds = new Set(
            ordersArr
                .filter((o) => String(o?.status || "").toLowerCase() === "delivered")
                .map((o) => o.id)
        );

        const eligible = itemsArr.some(
            (it) => deliveredOrderIds.has(it.orderId) && Number(it.productId) === Number(productId)
        );

        if (alive) setCanReview(eligible);
      } catch {
        if (alive) setCanReview(false);
      } finally {
        if (alive) setCheckingEligibility(false);
      }
    }

    checkEligibility();
    return () => {
      alive = false;
    };
  }, [user, productId]);

  /* ---------- load wishlist ---------- */
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

  // ✅ FIX: Use originalPrice as the base if available, to prevent double-discounting.
  // The backend sends 'price' as the *final* discounted price, but also sends 'originalPrice'.
  // We should calculate the discount info based on the original sticker price.
  const basePrice = product?.originalPrice ? Number(product.originalPrice) : price;

  const discountInfo = useMemo(() => getDiscountInfo(product, basePrice), [product, basePrice]);

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

  /* ---------- ratings: include ALL ratings for stats ---------- */
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

  /* ---------- public comments: approved only ---------- */
  const approvedComments = useMemo(() => {
    return reviews.filter((r) => {
      const st = String(r?.status || "").toLowerCase();
      const c = r?.comment;
      return st === "approved" && typeof c === "string" && c.trim().length > 0;
    });
  }, [reviews]);

  const totalRatings = reviews.length;

  /* ---------- actions ---------- */
  async function handleAddToCart() {
    if (!product) return;

    // ✅ FIX: Prevent adding to cart if price is 0.00
    if (price <= 0) {
      setMessage("Item not available for purchase.");
      setMessageType("error");
      return;
    }

    const maxStock = Number(product.stock || 0);
    if (maxStock > 0 && quantity > maxStock) {
      setMessage(`Only ${maxStock} in stock.`);
      setMessageType("error");
      return;
    }

    setMessage("");

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

      setAddedPulse(true);
      window.setTimeout(() => setAddedPulse(false), 850);
      return;
    }

    setSubmittingCart(true);
    try {
      await addToCartApi({ productId: product.id, quantity });
      window.dispatchEvent(new Event("cart-updated"));
      setMessage("Added to your bag.");
      setMessageType("success");

      setAddedPulse(true);
      window.setTimeout(() => setAddedPulse(false), 850);
    } catch (err) {
      if (err?.status === 401) logout();
      setMessage("Could not add to bag.");
      setMessageType("error");
    } finally {
      setSubmittingCart(false);
    }
  }

  async function toggleWishlist() {
    if (!product?.id) return;

    if (!user) {
      setMessage("Please log in to use wishlist.");
      setMessageType("error");
      return;
    }

    setMessage("");

    const productIdNum = Number(product.id);
    const currentlyWished = wishlistIds.has(productIdNum);

    // micro animation
    setWishPulse(true);
    window.setTimeout(() => setWishPulse(false), 320);

    // optimistic
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
      // rollback
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (currentlyWished) next.add(productIdNum);
        else next.delete(productIdNum);
        return next;
      });

      setMessage("Wishlist action failed.");
      setMessageType("error");
    }
  }

  async function handleSubmitReview(e) {
    e.preventDefault();

    if (!user) {
      setMessage("Log in to review.");
      setMessageType("error");
      return;
    }

    if (!canReview) {
      setMessage("You can review after delivery.");
      setMessageType("error");
      return;
    }

    setSubmittingReview(true);
    setMessage("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiBase}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId,
          rating,
          comment: reviewText.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Failed to submit review.");
        setMessageType("error");
        return;
      }

      const newStatus = data.status || (reviewText.trim() ? "pending" : "approved");

      // keep stats correct immediately (no Date.now in DOM; id is only used as key)
      const localId = `local-${Math.random().toString(16).slice(2)}`;

      setReviews((r) => [
        {
          id: localId,
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

      setMessage(newStatus === "approved" ? "Rating submitted!" : "Comment submitted (pending approval).");
      setMessageType("success");

      scrollTo(reviewsRef);
    } catch {
      setMessage("Network error. Please try again.");
      setMessageType("error");
    } finally {
      setSubmittingReview(false);
    }
  }

  const ratingOptions = useMemo(
      () => [5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} Stars` })),
      []
  );

  const isWishlisted = product?.id ? wishlistIds.has(Number(product.id)) : false;

  return (
      <SiteLayout>
        {/* Hydration-safe CSS (no styled-jsx) */}
        <style>{`
        @keyframes addPop {
          0% { transform: translateZ(0) scale(1); }
          45% { transform: translateZ(0) scale(1.03); }
          100% { transform: translateZ(0) scale(1); }
        }
        @keyframes addShine {
          0% { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
          25% { opacity: 0.80; }
          55% { opacity: 0.20; }
          100% { transform: translateX(120%) skewX(-18deg); opacity: 0; }
        }
        @keyframes heartPop {
          0% { transform: translateZ(0) scale(1); }
          35% { transform: translateZ(0) scale(1.18) rotate(-6deg); }
          70% { transform: translateZ(0) scale(0.95) rotate(4deg); }
          100% { transform: translateZ(0) scale(1); }
        }
        @keyframes heartRing {
          0% { transform: translateZ(0) scale(0.6); opacity: 0.0; }
          25% { opacity: 0.55; }
          100% { transform: translateZ(0) scale(1.55); opacity: 0; }
        }
      `}</style>

        <div className="space-y-8 pb-24">
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
                  type="button"
                  onClick={() => router.back()}
                  className="h-10 rounded-full border border-white/10 bg-white/5 px-4 hover:bg-white/10 transition text-[11px] font-semibold uppercase tracking-[0.18em]"
              >
                Back
              </button>
              <DripLink
                  href="/products"
                  className="h-10 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 hover:bg-white/10 transition text-[11px] font-semibold uppercase tracking-[0.18em]"
              >
                All drops
              </DripLink>
            </div>
          </div>

          {loadingProduct ? (
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[34px] bg-white/5 animate-pulse h-[640px]" />
                <div className="rounded-[34px] bg-white/5 animate-pulse h-[640px]" />
              </div>
          ) : !product ? (
              <GlassCard className="p-10 text-center">
                <p className="text-gray-200/80">Product not found.</p>
              </GlassCard>
          ) : (
              <>
                {/* HERO: reinvented */}
                <section className="relative overflow-hidden rounded-[46px] border border-white/10 bg-white/[0.03] backdrop-blur shadow-[0_18px_70px_rgba(0,0,0,0.38)]">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_circle_at_16%_14%,rgba(168,85,247,0.22),transparent_58%),radial-gradient(1100px_circle_at_86%_52%,rgba(251,113,133,0.14),transparent_62%),radial-gradient(900px_circle_at_55%_70%,rgba(255,255,255,0.05),transparent_60%)]" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/12 via-transparent to-black/22" />

                  <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] p-4 sm:p-6">
                    {/* LEFT: media */}
                    <div className="rounded-[38px] overflow-hidden border border-white/10 bg-black/15 shadow-[0_18px_70px_rgba(0,0,0,0.42)]">
                      <div className="relative h-[420px] sm:h-[560px] lg:h-[640px]">
                        <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full px-4 py-2 border border-white/10 bg-black/45 backdrop-blur text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
                        {getCategoryLabel(product.categoryId)}
                      </span>
                          {!soldOut ? (
                              <span className="inline-flex items-center rounded-full px-4 py-2 border border-white/10 bg-black/45 backdrop-blur text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
                          {Math.max(0, stock)} in stock
                        </span>
                          ) : (
                              <span className="inline-flex items-center rounded-full px-4 py-2 border border-white/10 bg-black/45 backdrop-blur text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
                          Sold out
                        </span>
                          )}
                          {discountInfo.hasDiscount ? (
                              <span className="inline-flex items-center rounded-full px-4 py-2 border border-white/10 bg-black/45 backdrop-blur text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
                          {discountInfo.percentOff}% off • save ${discountInfo.savings.toFixed(2)}
                        </span>
                          ) : null}
                        </div>

                        <div className="absolute right-4 top-4 z-10">
                          <button
                              type="button"
                              data-no-global-loader
                              onClick={toggleWishlist}
                              className={[
                                "relative h-11 w-11 rounded-full border border-white/12",
                                isWishlisted
                                    ? "bg-rose-500/85 text-white hover:bg-rose-600/90"
                                    : "bg-black/55 text-white/80 hover:bg-black/75 hover:text-white",
                                "backdrop-blur shadow-[0_12px_40px_rgba(0,0,0,0.35)] transition active:scale-95",
                                wishPulse ? "animate-[heartPop_300ms_ease-out]" : "",
                              ].join(" ")}
                              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                          >
                            {wishPulse ? (
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 rounded-full border border-white/45"
                                    style={{ animation: "heartRing 320ms ease-out forwards" }}
                                />
                            ) : null}

                            <svg
                                className="mx-auto h-5 w-5"
                                fill={isWishlisted ? "currentColor" : "none"}
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                              <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                              />
                            </svg>
                          </button>
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
                            <div className="absolute inset-0 grid place-items-center text-gray-400">No image</div>
                        )}

                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/70 via-black/12 to-transparent" />

                        <div className="absolute left-5 right-5 bottom-5">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-gray-200/70">Sneaks-Up Drop</p>
                          <p className="mt-1 text-2xl sm:text-3xl font-semibold text-white line-clamp-1">
                            {product.name}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 backdrop-blur">
                              <Stars value={avgRating} size="text-base" />
                              <span className="text-[12px] text-white/85 font-semibold">
                            {avgRating ? `${avgRating}/5` : "—"}
                          </span>
                              <button
                                  type="button"
                                  onClick={() => scrollTo(reviewsRef)}
                                  className="text-[12px] text-gray-200/70 hover:text-white transition"
                              >
                                ({totalRatings} rating{totalRatings === 1 ? "" : "s"})
                              </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => scrollTo(specsRef)}
                                className="h-10 rounded-full border border-white/10 bg-white/[0.06] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85 hover:bg-white/[0.10] transition active:scale-[0.98]"
                            >
                              View specs
                            </button>
                            <button
                                type="button"
                                onClick={() => scrollTo(storyRef)}
                                className="h-10 rounded-full border border-white/10 bg-white/[0.06] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85 hover:bg-white/[0.10] transition active:scale-[0.98]"
                            >
                              Read story
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: purchase card */}
                    <div className="rounded-[38px] border border-white/10 bg-black/25 backdrop-blur shadow-[0_18px_70px_rgba(0,0,0,0.35)] p-5 sm:p-6">
                      <SectionTitle
                          kicker="Purchase"
                          title="Lock the drop"
                          desc="Fast checkout. Clean inventory. Smooth actions."
                      />

                      {/* Price */}
                      <div className="mt-5 rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">Price</p>

                        {!discountInfo.hasDiscount ? (
                            <div className="mt-2 flex items-baseline justify-between gap-3">
                              <p className="text-3xl font-semibold text-white">${price.toFixed(2)}</p>
                              <span className="text-[10px] uppercase tracking-[0.22em] text-gray-300/70">
                          Standard
                        </span>
                            </div>
                        ) : (
                            <div className="mt-2 space-y-2">
                              <div className="flex items-end justify-between gap-3">
                                <div className="flex items-baseline gap-3 flex-wrap">
                            <span className="text-[13px] text-gray-300/60 line-through decoration-white/35">
                              ${discountInfo.original.toFixed(2)}
                            </span>
                                  <span className="text-3xl font-semibold text-white">
                              ${Number(discountInfo.discounted).toFixed(2)}
                            </span>
                                </div>
                                <span className="inline-flex items-center rounded-full px-3 py-1 border border-white/10 bg-black/35 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">
                            {discountInfo.percentOff}% off
                          </span>
                              </div>
                              <p className="text-[12px] text-gray-200/70">
                                You save <span className="text-white font-semibold">${discountInfo.savings.toFixed(2)}</span>
                              </p>
                            </div>
                        )}
                      </div>

                      {/* Quantity + Add */}
                      <div className="mt-5 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-gray-300/70">Quantity</p>

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
                            type="button"
                            onClick={handleAddToCart}
                            // ✅ FIX: Disable button if price is <= 0
                            disabled={submittingCart || soldOut || price <= 0}
                            className={[
                              "relative w-full h-12 rounded-full overflow-hidden",
                              "bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]",
                              "text-black uppercase tracking-[0.18em] text-[11px] font-semibold",
                              "hover:opacity-95 transition active:scale-[0.98]",
                              "disabled:opacity-50 disabled:cursor-not-allowed",
                              "shadow-[0_18px_70px_rgba(0,0,0,0.35)]",
                              addedPulse ? "animate-[addPop_260ms_ease-out]" : "",
                            ].join(" ")}
                        >
                          {!soldOut && !submittingCart && price > 0 ? (
                              <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100">
                          <span
                              className="absolute inset-y-0 w-1/3 bg-white/35 blur-sm"
                              style={{ animation: "addShine 1.15s ease-in-out infinite" }}
                          />
                        </span>
                          ) : null}

                          <span className="relative z-10 inline-flex items-center gap-2">
                        {soldOut ? (
                            "Sold out"
                        ) : price <= 0 ? (
                            "Unavailable"
                        ) : submittingCart ? (
                            <>
                              <span className="inline-block h-4 w-4 rounded-full border-2 border-black/30 border-t-black/80 animate-spin" />
                              Adding…
                            </>
                        ) : addedPulse ? (
                            <>
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/15">
                              ✓
                            </span>
                              Added
                            </>
                        ) : (
                            "Add to bag"
                        )}
                      </span>
                        </button>

                        {!user && !soldOut && price > 0 ? (
                            <p className="text-[11px] text-gray-300/60">
                              Guest mode: saved to bag until you log in.
                            </p>
                        ) : null}

                        {message ? (
                            <Banner type={messageType} onClose={() => setMessage("")}>
                              {message}
                            </Banner>
                        ) : null}
                      </div>

                      <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                      {/* Quick nav */}
                      <div className="mt-5 grid gap-2 sm:grid-cols-3">
                        <button
                            type="button"
                            onClick={() => scrollTo(storyRef)}
                            className="h-11 rounded-full border border-white/10 bg-white/[0.06] text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85 hover:bg-white/[0.10] transition active:scale-[0.98]"
                        >
                          Story
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollTo(specsRef)}
                            className="h-11 rounded-full border border-white/10 bg-white/[0.06] text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85 hover:bg-white/[0.10] transition active:scale-[0.98]"
                        >
                          Specs
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollTo(reviewsRef)}
                            className="h-11 rounded-full border border-white/10 bg-white/[0.06] text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85 hover:bg-white/[0.10] transition active:scale-[0.98]"
                        >
                          Reviews
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* STORY */}
                <section ref={storyRef} className="space-y-4">
                  <GlassCard className="p-6 sm:p-7">
                    <SectionTitle
                        kicker="Story"
                        title="About this pair"
                        desc="One clean narrative block. No repeats. All vibe."
                        right={
                          <span className="inline-flex items-center rounded-full px-4 py-2 border border-white/10 bg-black/30 backdrop-blur text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                      {getCategoryLabel(product.categoryId)}
                    </span>
                        }
                    />

                    <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
                      <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                        <p className="text-base sm:text-lg text-gray-100/90 leading-relaxed font-medium">
                          {product.description || "No description yet — but the silhouette speaks for itself."}
                        </p>
                      </div>

                      <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 space-y-3">
                        <p className="text-[10px] uppercase tracking-[0.26em] text-gray-300/60">At a glance</p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="text-gray-300/70">Stock</span>
                            <span className="text-white font-semibold">{soldOut ? "Sold out" : `${stock} available`}</span>
                          </div>
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="text-gray-300/70">Rating</span>
                            <span className="text-white font-semibold">{avgRating ? `${avgRating}/5` : "—"}</span>
                          </div>
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="text-gray-300/70">Discount</span>
                            <span className="text-white font-semibold">
                          {discountInfo.hasDiscount ? `${discountInfo.percentOff}%` : "—"}
                        </span>
                          </div>
                        </div>

                        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                        <button
                            type="button"
                            data-no-global-loader
                            onClick={toggleWishlist}
                            className={[
                              "h-11 w-full rounded-full border border-white/10 bg-white/[0.06] backdrop-blur",
                              "text-[11px] font-semibold uppercase tracking-[0.18em] transition",
                              "hover:bg-white/[0.10] active:scale-[0.98]",
                              wishPulse ? "animate-[heartPop_300ms_ease-out]" : "",
                            ].join(" ")}
                        >
                          {isWishlisted ? "♥ Wishlisted" : "♡ Add to wishlist"}
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                </section>

                {/* SPECS */}
                <section ref={specsRef} className="space-y-4">
                  <GlassCard className="p-6 sm:p-7">
                    <SectionTitle
                        kicker="Specs"
                        title="Details that matter"
                        desc="One clean grid — no duplicates — easy scanning."
                    />

                    <div className="mt-6">
                      <SpecGrid
                          items={[
                            { label: "Model", value: model },
                            { label: "Serial", value: serialNumber },
                            { label: "Warranty", value: warranty },
                            { label: "Distributor", value: distributor },
                          ]}
                      />
                    </div>

                    <div className="mt-6 rounded-[26px] border border-white/10 bg-black/20 p-5">
                      <p className="text-[10px] uppercase tracking-[0.26em] text-gray-300/60">Pricing summary</p>
                      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                        <div>
                          {!discountInfo.hasDiscount ? (
                              <p className="text-3xl font-semibold text-white">${price.toFixed(2)}</p>
                          ) : (
                              <div className="flex items-baseline gap-3 flex-wrap">
                          <span className="text-[13px] text-gray-300/60 line-through decoration-white/35">
                            ${discountInfo.original.toFixed(2)}
                          </span>
                                <span className="text-3xl font-semibold text-white">
                            ${Number(discountInfo.discounted).toFixed(2)}
                          </span>
                              </div>
                          )}
                          <p className="mt-1 text-[12px] text-gray-200/70">
                            {discountInfo.hasDiscount
                                ? `Save $${discountInfo.savings.toFixed(2)} today.`
                                : "Standard pricing for this drop."}
                          </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => scrollTo(reviewsRef)}
                            className="h-11 rounded-full border border-white/10 bg-white/[0.06] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85 hover:bg-white/[0.10] transition active:scale-[0.98]"
                        >
                          Jump to reviews
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                </section>

                {/* REVIEWS */}
                <section ref={reviewsRef} className="space-y-4">
                  <GlassCard className="p-6 sm:p-7">
                    <SectionTitle
                        kicker="Reviews"
                        title="Community ratings"
                        desc="Ratings count instantly. Comments appear after approval."
                        right={
                          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/25 px-4 py-2 backdrop-blur">
                            <div className="text-right">
                              <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">Average</p>
                              <p className="text-white font-semibold">{avgRating ? avgRating : "—"}</p>
                            </div>
                            <div className="h-7 w-px bg-white/10" />
                            <div className="text-right">
                              <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60">Ratings</p>
                              <p className="text-white font-semibold">{totalRatings}</p>
                            </div>
                          </div>
                        }
                    />

                    {/* distribution */}
                    <div className="mt-6 grid gap-2">
                      {[5, 4, 3, 2, 1].map((n) => {
                        const total = Math.max(1, totalRatings);
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
                              <span className="w-10 text-right text-[12px] text-gray-300/70">{pct}%</span>
                            </div>
                        );
                      })}
                    </div>

                    <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* Approved comments */}
                    {approvedComments.length === 0 ? (
                        <div className="rounded-[30px] border border-white/10 bg-black/20 p-8 text-center">
                          <p className="text-gray-200/85 text-lg font-semibold">
                            {totalRatings === 0 ? "No ratings yet" : "No public comments yet"}
                          </p>
                          <p className="mt-2 text-[12px] text-gray-300/70">
                            {totalRatings === 0
                                ? "Be the first to rate this drop."
                                : "Ratings exist, but comments appear only after approval."}
                          </p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 mt-6">
                          {approvedComments.map((r) => (
                              <ReviewCard key={r.id} r={r} />
                          ))}
                        </div>
                    )}
                  </GlassCard>

                  {/* Write review (separate card) */}
                  <form
                      onSubmit={handleSubmitReview}
                      className="rounded-[34px] border border-white/10 bg-white/[0.04] backdrop-blur p-6 sm:p-7 shadow-[0_18px_70px_rgba(0,0,0,0.35)]"
                  >
                    <SectionTitle
                        kicker="Write"
                        title="Leave a rating"
                        desc="If you received the item (delivered), you can review."
                        right={
                          !user ? (
                              <span className="text-[11px] text-gray-300/60">Log in to submit</span>
                          ) : checkingEligibility ? (
                              <span className="text-[11px] text-gray-300/60">Checking eligibility…</span>
                          ) : !canReview ? (
                              <span className="text-[11px] text-amber-200/80">Available after delivery</span>
                          ) : (
                              <span className="text-[11px] text-emerald-200/80">Eligible</span>
                          )
                        }
                    />

                    <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
                      <div className="space-y-3">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-gray-300/60">Rating</p>
                        <GlassSelect
                            value={rating}
                            onChange={(v) => setRating(Number(v))}
                            options={ratingOptions}
                            widthClass="w-full"
                        />
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2">
                          <Stars value={rating} />
                          <span className="text-[11px] text-gray-200/75">{rating}/5 selected</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-gray-300/60">
                          Comment <span className="opacity-50 lowercase tracking-normal">(optional)</span>
                        </p>
                        <textarea
                            rows={5}
                            value={reviewText}
                            onChange={(e) => setReviewText(e.target.value)}
                            disabled={!user || !canReview || checkingEligibility || submittingReview}
                            placeholder="Fit, comfort, materials — tell us what you noticed."
                            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-gray-300/45 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_35%,transparent)] disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div className="mt-5">
                      <button
                          type="submit"
                          disabled={!user || !canReview || checkingEligibility || submittingReview}
                          className="h-12 w-full rounded-full bg-white text-black uppercase tracking-[0.18em] text-[11px] font-semibold hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {!user
                            ? "Log in to review"
                            : !canReview
                                ? "Available after delivery"
                                : submittingReview
                                    ? "Submitting…"
                                    : "Submit review"}
                      </button>
                    </div>
                  </form>

                  {/* Bottom nav */}
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                        type="button"
                        onClick={() => scrollTo(storyRef)}
                        className="h-11 rounded-full border border-white/10 bg-white/[0.06] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85 hover:bg-white/[0.10] transition active:scale-[0.98]"
                    >
                      Back to story
                    </button>
                    <button
                        type="button"
                        onClick={() => scrollTo(specsRef)}
                        className="h-11 rounded-full border border-white/10 bg-white/[0.06] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85 hover:bg-white/[0.10] transition active:scale-[0.98]"
                    >
                      Specs
                    </button>
                    <button
                        type="button"
                        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                        className="h-11 rounded-full border border-white/10 bg-white/[0.06] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85 hover:bg-white/[0.10] transition active:scale-[0.98]"
                    >
                      Top
                    </button>
                  </div>
                </section>
              </>
          )}
        </div>
      </SiteLayout>
  );
}
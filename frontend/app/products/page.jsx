"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import SiteLayout from "../../components/SiteLayout";
import DripLink from "../../components/DripLink";
import StockBadge from "../../components/StockBadge";
import { useAuth } from "../../context/AuthContext";
import {
  getWishlistApi,
  addToWishlistApi,
  removeFromWishlistApi,
} from "../../lib/api";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

const CATEGORY_OPTIONS = [
  { id: "all", label: "All categories" },
  { id: "1", label: "Low Top" },
  { id: "2", label: "Mid Top" },
  { id: "3", label: "High Top" },
];

const SORT_OPTIONS = [
  { id: "popularity", label: "Most popular" },
  { id: "priceAsc", label: "Price: Low to High" },
  { id: "priceDesc", label: "Price: High to Low" },
];

function getCategoryLabel(categoryId) {
  const n = Number(categoryId);
  if (!n) return "Uncategorized";
  if (n === 1) return "Low Top";
  if (n === 2) return "Mid Top";
  if (n === 3) return "High Top";
  return `Category #${n}`;
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

function getPricing(product) {
  const price = Number(product?.price);

  const originalCandidate = Number(
    product?.originalPrice ??
      product?.basePrice ??
      product?.priceBeforeDiscount ??
      product?.compareAtPrice
  );

  const discountedCandidate = Number(
    product?.discountedPrice ??
      product?.salePrice ??
      product?.finalPrice ??
      product?.priceAfterDiscount
  );

  const discountPct = Number(
    product?.discountPercentage ??
      product?.discountPercent ??
      product?.discountPct ??
      product?.discount ??
      product?.salePercentage
  );

  if (
    Number.isFinite(originalCandidate) &&
    originalCandidate > 0 &&
    Number.isFinite(discountedCandidate) &&
    discountedCandidate > 0
  ) {
    const original = originalCandidate;
    const final = Math.min(discountedCandidate, originalCandidate);
    const pct = original > 0 ? Math.round(((original - final) / original) * 100) : 0;
    return { originalPrice: original, finalPrice: final, hasDiscount: final < original, discountPercent: pct };
  }

  if (
    Number.isFinite(originalCandidate) &&
    originalCandidate > 0 &&
    Number.isFinite(discountPct) &&
    discountPct > 0
  ) {
    const original = originalCandidate;
    const final = Math.max(0, original * (1 - discountPct / 100));
    return { originalPrice: original, finalPrice: final, hasDiscount: final < original, discountPercent: Math.round(discountPct) };
  }

  if (Number.isFinite(price) && price > 0 && Number.isFinite(discountPct) && discountPct > 0) {
    const original = price;
    const final = Math.max(0, original * (1 - discountPct / 100));
    return { originalPrice: original, finalPrice: final, hasDiscount: final < original, discountPercent: Math.round(discountPct) };
  }

  if (Number.isFinite(price) && price > 0 && Number.isFinite(originalCandidate) && originalCandidate > price) {
    const original = originalCandidate;
    const final = price;
    const pct = Math.round(((original - final) / original) * 100);
    return { originalPrice: original, finalPrice: final, hasDiscount: true, discountPercent: pct };
  }

  const final = Number.isFinite(price) && price > 0 ? price : 0;
  return { originalPrice: final, finalPrice: final, hasDiscount: false, discountPercent: 0 };
}

function GlassSelect({ label, value, onChange, options, widthClass = "w-[185px]" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selected = useMemo(() => options.find((o) => o.id === value) || options[0], [options, value]);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={rootRef} className={`relative ${widthClass} z-[70]`}>
      <span className="sr-only">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "h-10 w-full rounded-full border border-white/10 bg-white/[0.05] backdrop-blur-md",
          "px-4 pr-10 text-left text-[12px] text-gray-100",
          "shadow-[0_10px_34px_rgba(0,0,0,0.22)]",
          "focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_35%,transparent)]",
          "transition hover:bg-white/[0.07]",
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
        <div className="absolute z-[90] mt-2 w-full rounded-2xl overflow-hidden border border-black/10 bg-white/90 text-black shadow-[0_22px_70px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="p-1" role="listbox" aria-label={label}>
            {options.map((opt) => {
              const active = opt.id === value;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className={[
                    "w-full text-left px-3 py-2 rounded-xl text-[12px] font-medium transition",
                    active ? "bg-black text-white" : "hover:bg-black/10 text-black/80",
                  ].join(" ")}
                  role="option"
                  aria-selected={active}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Banner({ kind = "info", children, onClose }) {
  const styles =
    kind === "error"
      ? "border-rose-500/25 bg-rose-500/10 text-rose-100/90"
      : kind === "success"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100/90"
      : "border-white/10 bg-white/[0.04] text-gray-200/85";

  return (
    <div className={`relative rounded-2xl border px-4 py-3 text-[12px] ${styles}`}>
      <div className="pr-10">{children}</div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 hover:text-white hover:bg-white/[0.08] transition"
          aria-label="Dismiss message"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/[0.03] backdrop-blur p-4 shadow-[0_18px_70px_rgba(0,0,0,0.35)]">
      <div className="w-full aspect-square rounded-[22px] bg-white/10 animate-pulse mb-4" />
      <div className="h-4 w-2/3 rounded bg-white/10 animate-pulse mb-2" />
      <div className="h-4 w-1/2 rounded bg-white/10 animate-pulse mb-4" />
      <div className="h-10 w-full rounded-full bg-white/10 animate-pulse" />
    </div>
  );
}

function PricePill({ originalPrice, finalPrice, hasDiscount, discountPercent }) {
  return (
    <div
      className={[
        "relative inline-flex items-center gap-2 rounded-full px-3.5 py-1.5",
        "border border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,255,255,0.68))]",
        "backdrop-blur-md shadow-[0_14px_45px_rgba(0,0,0,0.30)]",
        "transition-transform duration-200 group-hover:scale-[1.02]",
      ].join(" ")}
      aria-label={
        hasDiscount
          ? `On sale. Was $${formatMoney(originalPrice)}, now $${formatMoney(finalPrice)}`
          : `Price $${formatMoney(finalPrice)}`
      }
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(to_right,rgba(255,255,255,0.55),transparent,rgba(255,255,255,0.35))] opacity-70"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -inset-0.5 rounded-full opacity-0 blur-md transition-opacity duration-200 group-hover:opacity-40 bg-[radial-gradient(60px_circle_at_30%_40%,rgba(168,85,247,0.35),transparent_70%),radial-gradient(60px_circle_at_70%_60%,rgba(251,113,133,0.30),transparent_70%)]"
        aria-hidden="true"
      />

      {hasDiscount && discountPercent > 0 ? (
        <span className="relative z-10 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] bg-black text-white shadow-[0_10px_25px_rgba(0,0,0,0.25)]">
          -{discountPercent}%
        </span>
      ) : null}

      <div className="relative z-10 inline-flex items-baseline gap-2">
        {hasDiscount ? (
          <span className="text-[10px] font-semibold tracking-[0.10em] text-black/45 line-through">
            ${formatMoney(originalPrice)}
          </span>
        ) : null}

        <span className="text-[12px] font-semibold tracking-[0.12em] text-black">
          ${formatMoney(finalPrice)}
        </span>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { user } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("info");

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("popularity");

  const [addingId, setAddingId] = useState(null);
  const [addedPulseId, setAddedPulseId] = useState(null);
  const addedPulseTimerRef = useRef(null);

  const [wishlistIds, setWishlistIds] = useState(() => new Set());
  const [wishPulseId, setWishPulseId] = useState(null);
  const wishPulseTimerRef = useRef(null);

  const isBrowser = typeof window !== "undefined";

  function showAlert(text) {
    if (isBrowser) window.alert(text);
  }

  function addToGuestCart(productId) {
    if (!isBrowser) return;

    const raw = localStorage.getItem("guestCart") || "[]";
    let cart = [];
    try {
      cart = JSON.parse(raw);
      if (!Array.isArray(cart)) cart = [];
    } catch {
      cart = [];
    }

    const existing = cart.find((item) => item.productId === productId);
    if (existing) existing.quantity += 1;
    else cart.push({ productId, quantity: 1 });

    localStorage.setItem("guestCart", JSON.stringify(cart));
    window.dispatchEvent(new Event("cart-updated"));
  }

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setMessage("");

      try {
        const res = await fetch(`${apiBase}/products`);
        if (!res.ok) {
          setMessageKind("error");
          setMessage("Failed to load products.");
          setProducts([]);
          return;
        }

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          setMessageKind("error");
          setMessage("Unexpected response while loading products.");
          setProducts([]);
          return;
        }

        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Products load error:", err);
        setMessageKind("error");
        setMessage("Failed to load products.");
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

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

  const filteredAndSorted = useMemo(() => {
    let list = Array.isArray(products) ? [...products] : [];
    list = list.filter((p) => p?.isActive !== false);

    const q = (deferredSearch || "").trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const name = (p?.name || "").toLowerCase();
        const desc = (p?.description || "").toLowerCase();
        return name.includes(q) || desc.includes(q);
      });
    }

    const min = parseFloat(minPrice);
    if (!Number.isNaN(min)) list = list.filter((p) => getPricing(p).finalPrice >= min);

    const max = parseFloat(maxPrice);
    if (!Number.isNaN(max)) list = list.filter((p) => getPricing(p).finalPrice <= max);

    if (categoryFilter !== "all") {
      const catId = Number(categoryFilter);
      if (!Number.isNaN(catId)) list = list.filter((p) => Number(p?.categoryId) === catId);
    }

    switch (sortBy) {
      case "priceAsc":
        list.sort((a, b) => getPricing(a).finalPrice - getPricing(b).finalPrice);
        break;
      case "priceDesc":
        list.sort((a, b) => getPricing(b).finalPrice - getPricing(a).finalPrice);
        break;
      case "popularity":
      default:
        list.sort((a, b) => {
          const aScore = Number(a?.popularity || 0);
          const bScore = Number(b?.popularity || 0);
          if (aScore === bScore) return Number(b?.id || 0) - Number(a?.id || 0);
          return bScore - aScore;
        });
        break;
    }

    return list;
  }, [products, deferredSearch, minPrice, maxPrice, categoryFilter, sortBy]);

  function handleResetFilters() {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setCategoryFilter("all");
    setSortBy("popularity");
  }

  function pulseAdded(productId) {
    setAddedPulseId(productId);
    if (addedPulseTimerRef.current) clearTimeout(addedPulseTimerRef.current);
    addedPulseTimerRef.current = setTimeout(() => {
      setAddedPulseId(null);
      addedPulseTimerRef.current = null;
    }, 900);
  }

  function pulseWish(productIdNum) {
    setWishPulseId(productIdNum);
    if (wishPulseTimerRef.current) clearTimeout(wishPulseTimerRef.current);
    wishPulseTimerRef.current = setTimeout(() => {
      setWishPulseId(null);
      wishPulseTimerRef.current = null;
    }, 320);
  }

  useEffect(() => {
    return () => {
      if (addedPulseTimerRef.current) clearTimeout(addedPulseTimerRef.current);
      if (wishPulseTimerRef.current) clearTimeout(wishPulseTimerRef.current);
    };
  }, []);

  async function toggleWishlist(productId) {
    if (!user) {
      const msg = "Please log in to use wishlist.";
      setMessageKind("info");
      setMessage(msg);
      showAlert(msg);
      return;
    }

    const productIdNum = Number(productId);
    const currentlyWished = wishlistIds.has(productIdNum);

    pulseWish(productIdNum);

    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (currentlyWished) next.delete(productIdNum);
      else next.add(productIdNum);
      return next;
    });

    try {
      if (currentlyWished) await removeFromWishlistApi(productIdNum);
      else await addToWishlistApi(productIdNum);

      setMessageKind("success");
      setMessage(currentlyWished ? "Removed from wishlist." : "Added to wishlist.");
    } catch {
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (currentlyWished) next.add(productIdNum);
        else next.delete(productIdNum);
        return next;
      });

      const msg = "Wishlist action failed.";
      setMessageKind("error");
      setMessage(msg);
      showAlert(msg);
    }
  }

  async function handleAddToCart(product) {
    const productId = product?.id;
    const stock = Number(product?.stock || 0);
    if (!productId) return;

    if (stock <= 0) {
      const msg = "This product is sold out and cannot be added to your bag.";
      setMessageKind("info");
      setMessage(msg);
      showAlert(msg);
      return;
    }

    if (!user) {
      try {
        setAddingId(productId);
        addToGuestCart(productId);
        setMessageKind("success");
        setMessage("Item added to your bag. Log in when you place your order.");
        pulseAdded(productId);
      } catch (err) {
        console.error("Guest add error:", err);
        const msg = "Could not add this item to your bag.";
        setMessageKind("error");
        setMessage(msg);
        showAlert(msg);
      } finally {
        setAddingId(null);
      }
      return;
    }

    try {
      const token = isBrowser ? localStorage.getItem("token") : null;
      if (!token) {
        const msg = "Session expired. Please log in again.";
        setMessageKind("error");
        setMessage(msg);
        showAlert(msg);
        return;
      }

      setAddingId(productId);
      setMessage("");

      const res = await fetch(`${apiBase}/cart/add`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        let data = null;
        if (ct.includes("application/json")) {
          try {
            data = await res.json();
          } catch {}
        }
        const msg = data?.message || "Could not add this item to your bag.";
        setMessageKind("error");
        setMessage(msg);
        showAlert(msg);
        return;
      }

      if (isBrowser) window.dispatchEvent(new Event("cart-updated"));
      setMessageKind("success");
      setMessage("Item added to your bag.");
      pulseAdded(productId);
    } catch (err) {
      console.error("Add to cart error:", err);
      const msg = "Could not add this item to your bag.";
      setMessageKind("error");
      setMessage(msg);
      showAlert(msg);
    } finally {
      setAddingId(null);
    }
  }

  const fieldBase =
    "h-10 rounded-full border border-white/10 bg-white/[0.05] backdrop-blur-md text-[12px] text-gray-100 placeholder:text-gray-400/70 px-4 shadow-[0_10px_34px_rgba(0,0,0,0.22)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_35%,transparent)] transition hover:bg-white/[0.07]";

  const numberFieldNoSpinner =
    "[appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  const resultsCount = filteredAndSorted.length;

  return (
    <SiteLayout>
      {/* ✅ Plain <style> (NO styled-jsx) => fixes hydration mismatch */}
      <style>{`
        @keyframes addPop {
          0% { transform: translateZ(0) scale(1); }
          45% { transform: translateZ(0) scale(1.03); }
          100% { transform: translateZ(0) scale(1); }
        }
        @keyframes addShine {
          0% { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
          25% { opacity: 0.75; }
          55% { opacity: 0.2; }
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

      <div className="space-y-6">
        {/* HERO */}
        <section className="relative">
          <div className="pointer-events-none absolute inset-0 rounded-[34px] overflow-hidden border border-border bg-surface">
            <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_12%_20%,rgba(168,85,247,0.20),transparent_58%),radial-gradient(900px_circle_at_85%_50%,rgba(251,113,133,0.16),transparent_64%)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/18 via-transparent to-black/22" />
            <div className="absolute -top-24 left-1/2 h-48 w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl opacity-20" />
          </div>

          <div className="relative rounded-[34px] p-5 sm:p-7">
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold tracking-[0.30em] uppercase text-gray-300/70">
                    Drops
                  </p>
                  <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-foreground">
                    Curated sneaker releases
                  </h1>
                  <p className="text-[12px] sm:text-sm text-gray-300/70 max-w-2xl">
                    Fast filters. Premium cards. Smooth actions.
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur">
                  <span className="text-[10px] uppercase tracking-[0.24em] text-gray-300/70">
                    {loading
                      ? "Loading…"
                      : `${resultsCount} result${resultsCount === 1 ? "" : "s"}`}
                  </span>
                </div>
              </div>

              {/* Sticky filter bar */}
              <div className="sticky top-3 z-30">
                <div className="relative rounded-[26px] border border-white/10 bg-white/[0.04] backdrop-blur p-3 sm:p-4 shadow-[0_16px_60px_rgba(0,0,0,0.34)]">
                  <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-[radial-gradient(900px_circle_at_18%_20%,rgba(168,85,247,0.12),transparent_55%),radial-gradient(900px_circle_at_86%_55%,rgba(251,113,133,0.10),transparent_62%)] opacity-70" />
                  <div className="relative flex flex-wrap items-center gap-2 sm:gap-3">
                    <label className="sr-only" htmlFor="product-search">
                      Search products
                    </label>
                    <input
                      id="product-search"
                      type="text"
                      placeholder="Search drops (name / description)"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className={`${fieldBase} min-w-[220px] flex-1`}
                      autoComplete="off"
                    />

                    <label className="sr-only" htmlFor="min-price">
                      Minimum price
                    </label>
                    <input
                      id="min-price"
                      type="number"
                      min="0"
                      inputMode="decimal"
                      placeholder="Min"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className={`${fieldBase} ${numberFieldNoSpinner} w-[98px]`}
                    />

                    <label className="sr-only" htmlFor="max-price">
                      Maximum price
                    </label>
                    <input
                      id="max-price"
                      type="number"
                      min="0"
                      inputMode="decimal"
                      placeholder="Max"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className={`${fieldBase} ${numberFieldNoSpinner} w-[98px]`}
                    />

                    <GlassSelect
                      label="Category"
                      value={categoryFilter}
                      onChange={setCategoryFilter}
                      options={CATEGORY_OPTIONS}
                      widthClass="w-[185px]"
                    />

                    <GlassSelect
                      label="Sort"
                      value={sortBy}
                      onChange={setSortBy}
                      options={SORT_OPTIONS}
                      widthClass="w-[210px]"
                    />

                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className={[
                        "h-10 px-4 rounded-full",
                        "text-[11px] font-semibold uppercase tracking-[0.18em]",
                        "border border-white/10 bg-white/5 text-white/85",
                        "hover:bg-white/10 transition active:scale-[0.98]",
                      ].join(" ")}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {message ? (
                <Banner kind={messageKind} onClose={() => setMessage("")}>
                  {message}
                </Banner>
              ) : null}
            </div>
          </div>
        </section>

        {/* CONTENT */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.03] backdrop-blur p-10 text-center shadow-[0_18px_70px_rgba(0,0,0,0.35)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_20%,rgba(168,85,247,0.10),transparent_60%),radial-gradient(900px_circle_at_80%_60%,rgba(251,113,133,0.08),transparent_62%)]" />
            <div className="relative space-y-4">
              <p className="text-sm text-gray-200/85">Nothing matches these filters.</p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-black hover:opacity-95 transition active:scale-[0.98]"
              >
                Reset filters
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAndSorted.map((product) => {
              const { originalPrice, finalPrice, hasDiscount, discountPercent } = getPricing(product);
              const stock = Number(product?.stock || 0);
              const isSoldOut = stock <= 0;

              const imageUrl = product?.imageUrl ? `${apiBase}${product.imageUrl}` : null;

              const pidNum = Number(product.id);
              const isWishlisted = wishlistIds.has(pidNum);
              const isWishPulse = wishPulseId === pidNum;

              const isAddedPulse = addedPulseId === product.id;

              return (
                <article
                  key={product.id}
                  className={[
                    "group relative overflow-hidden rounded-[32px]",
                    "border border-white/10 bg-white/[0.03] backdrop-blur",
                    "p-4 shadow-[0_18px_70px_rgba(0,0,0,0.35)]",
                    "transition-transform duration-200 hover:-translate-y-0.5",
                  ].join(" ")}
                >
                  <div className="pointer-events-none absolute inset-0 opacity-80 bg-[radial-gradient(700px_circle_at_22%_18%,rgba(168,85,247,0.12),transparent_60%),radial-gradient(700px_circle_at_86%_58%,rgba(251,113,133,0.10),transparent_62%)]" />

                  {/* ✅ Media wrapper */}
                  <div className="relative">
                    {/* ✅ DripLink only wraps the media area (no nested button inside <a>) */}
                    <DripLink
                      href={`/products/${product.id}`}
                      className="relative block rounded-[24px] overflow-hidden border border-white/10 bg-black/20 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_35%,transparent)]"
                      aria-label={`Open product: ${product?.name || "Product"}`}
                    >
                      <div className="w-full aspect-square flex items-center justify-center overflow-hidden">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={product?.name || "Sneaks-up drop"}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-[10px] uppercase tracking-[0.22em] text-gray-300/60">
                            SNEAKS-UP
                          </span>
                        )}
                      </div>

                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    </DripLink>

                    {/* overlays OUTSIDE the link */}
                    <div className="absolute left-3 top-3 z-10 flex gap-2">
                      <StockBadge stock={product?.stock} ink="dark" />
                    </div>

                    <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                      <PricePill
                        originalPrice={originalPrice}
                        finalPrice={finalPrice}
                        hasDiscount={hasDiscount}
                        discountPercent={discountPercent}
                      />
                    </div>

                    {/* Wishlist: outside link, no loader */}
                    <div className="absolute left-3 bottom-3 z-10">
                      <button
                        type="button"
                        data-no-global-loader
                        onClick={() => toggleWishlist(product.id)}
                        className={[
                          "relative p-2.5 rounded-full backdrop-blur transition-all active:scale-95",
                          "shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
                          isWishlisted
                            ? "bg-rose-500/90 border border-rose-400/30 text-white hover:bg-rose-600/90"
                            : "bg-black/60 border border-white/15 text-white/80 hover:bg-black/80 hover:text-white",
                          isWishPulse ? "animate-[heartPop_300ms_ease-out]" : "",
                        ].join(" ")}
                        aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                      >
                        {isWishPulse ? (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 rounded-full border border-white/45"
                            style={{ animation: "heartRing 320ms ease-out forwards" }}
                          />
                        ) : null}

                        <svg
                          className="w-4 h-4"
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
                  </div>

                  {/* body */}
                  <div className="relative pt-4 space-y-3">
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-semibold text-foreground line-clamp-1">
                        {product?.name || "Unnamed product"}
                      </h2>
                      {product?.description ? (
                        <p className="mt-1 text-[12px] text-gray-300/70 line-clamp-2 leading-snug">
                          {product.description}
                        </p>
                      ) : (
                        <p className="mt-1 text-[12px] text-gray-300/50">
                          Clean build. Premium materials. Limited drop.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-gray-300/60 uppercase tracking-[0.18em]">
                        {getCategoryLabel(product?.categoryId)}
                      </span>

                      <DripLink
                        href={`/products/${product.id}`}
                        className="text-[10px] uppercase tracking-[0.22em] text-gray-200/70 hover:text-white transition"
                      >
                        View →
                      </DripLink>
                    </div>

                    {/* Add to bag button with animation */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleAddToCart(product)}
                        disabled={addingId === product.id || isSoldOut}
                        className={[
                          "relative w-full inline-flex items-center justify-center rounded-full overflow-hidden",
                          "text-[11px] font-semibold uppercase tracking-[0.18em]",
                          "px-4 py-3 transition active:scale-[0.98]",
                          isSoldOut
                            ? "bg-white/10 text-gray-400 cursor-not-allowed border border-white/10"
                            : "bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] text-black hover:opacity-95",
                          "disabled:opacity-70 disabled:cursor-not-allowed",
                          isAddedPulse && !isSoldOut ? "animate-[addPop_260ms_ease-out]" : "",
                        ].join(" ")}
                      >
                        {!isSoldOut && addingId !== product.id ? (
                          <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100">
                            <span
                              className="absolute inset-y-0 w-1/3 bg-white/35 blur-sm"
                              style={{ animation: "addShine 1.15s ease-in-out infinite" }}
                            />
                          </span>
                        ) : null}

                        <span className="relative z-10 inline-flex items-center gap-2">
                          {isSoldOut ? (
                            "Sold out"
                          ) : addingId === product.id ? (
                            <>
                              <span className="inline-block h-4 w-4 rounded-full border-2 border-black/30 border-t-black/80 animate-spin" />
                              Adding…
                            </>
                          ) : isAddedPulse ? (
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

                      {!user && !isSoldOut ? (
                        <p className="mt-2 text-[11px] text-gray-300/60">
                          Guest mode: items save in your bag until you log in.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

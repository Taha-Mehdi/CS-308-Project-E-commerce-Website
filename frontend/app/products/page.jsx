"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SiteLayout from "../../components/SiteLayout";
import DripLink from "../../components/DripLink";
import StockBadge from "../../components/StockBadge";
import { useAuth } from "../../context/AuthContext";

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

/**
 * Premium custom dropdown:
 * - No hydration mismatch (single-line classNames)
 * - High z-index
 * - Not clipped (header background is clipped via a separate layer, not the section)
 */
function GlassSelect({ value, onChange, options, widthClass = "w-[185px]" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selected = useMemo(() => {
    return options.find((o) => o.id === value) || options[0];
  }, [options, value]);

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
        className="h-10 w-full rounded-full border border-white/10 bg-white/[0.05] backdrop-blur-md px-4 pr-10 text-left text-[12px] text-gray-100 shadow-[0_10px_34px_rgba(0,0,0,0.22)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_35%,transparent)]"
      >
        <span className="block truncate">{selected?.label}</span>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/70 text-xs">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute z-[80] mt-2 w-full rounded-2xl overflow-hidden border border-black/10 bg-white/90 text-black shadow-[0_22px_70px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="p-1">
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

export default function ProductsPage() {
  const { user } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("popularity");

  const [addingId, setAddingId] = useState(null);

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
          setMessage("Failed to load products.");
          setProducts([]);
          return;
        }

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          setMessage("Unexpected response while loading products.");
          setProducts([]);
          return;
        }

        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Products load error:", err);
        setMessage("Failed to load products.");
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  const filteredAndSorted = useMemo(() => {
    let list = [...products];
    list = list.filter((p) => p?.isActive !== false);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const name = (p?.name || "").toLowerCase();
        const desc = (p?.description || "").toLowerCase();
        return name.includes(q) || desc.includes(q);
      });
    }

    const min = parseFloat(minPrice);
    if (!Number.isNaN(min)) list = list.filter((p) => Number(p?.price || 0) >= min);

    const max = parseFloat(maxPrice);
    if (!Number.isNaN(max)) list = list.filter((p) => Number(p?.price || 0) <= max);

    if (categoryFilter !== "all") {
      const catId = Number(categoryFilter);
      if (!Number.isNaN(catId)) list = list.filter((p) => Number(p?.categoryId) === catId);
    }

    switch (sortBy) {
      case "priceAsc":
        list.sort((a, b) => Number(a?.price || 0) - Number(b?.price || 0));
        break;
      case "priceDesc":
        list.sort((a, b) => Number(b?.price || 0) - Number(a?.price || 0));
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
  }, [products, search, minPrice, maxPrice, categoryFilter, sortBy]);

  function handleResetFilters() {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setCategoryFilter("all");
    setSortBy("popularity");
  }

  async function handleAddToCart(product) {
    const productId = product?.id;
    const stock = Number(product?.stock || 0);
    if (!productId) return;

    if (stock <= 0) {
      const msg = "This product is sold out and cannot be added to your bag.";
      setMessage(msg);
      showAlert(msg);
      return;
    }

    if (!user) {
      try {
        setAddingId(productId);
        addToGuestCart(productId);
        setMessage("Item added to your bag. Log in when you place your order.");
      } catch (err) {
        console.error("Guest add error:", err);
        const msg = "Could not add this item to your bag.";
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
        setMessage(msg);
        showAlert(msg);
        return;
      }

      setAddingId(productId);
      setMessage("");

      const res = await fetch(`${apiBase}/cart/add`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
        setMessage(msg);
        showAlert(msg);
        return;
      }

      if (isBrowser) window.dispatchEvent(new Event("cart-updated"));
      setMessage("Item added to your bag.");
    } catch (err) {
      console.error("Add to cart error:", err);
      const msg = "Could not add this item to your bag.";
      setMessage(msg);
      showAlert(msg);
    } finally {
      setAddingId(null);
    }
  }

  const fieldBase =
    "h-10 rounded-full border border-white/10 bg-white/[0.05] backdrop-blur-md text-[12px] text-gray-100 placeholder:text-gray-400/70 px-4 shadow-[0_10px_34px_rgba(0,0,0,0.22)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_35%,transparent)]";

  const pillButton =
    "h-10 px-4 rounded-full text-[11px] font-semibold uppercase tracking-[0.18em] transition active:scale-[0.98]";

  const numberFieldNoSpinner =
    "[appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <SiteLayout>
      <div className="space-y-6">
        {/* HEADER (background clipped without clipping dropdown menus) */}
        <section className="relative">
          {/* CLIPPED BACKGROUND LAYER (fixes purple hue overflow) */}
          <div className="pointer-events-none absolute inset-0 rounded-[34px] overflow-hidden border border-border bg-surface">
            <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_12%_20%,rgba(168,85,247,0.18),transparent_58%),radial-gradient(900px_circle_at_85%_50%,rgba(251,113,133,0.12),transparent_64%)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/14 via-transparent to-black/18" />
          </div>

          {/* CONTENT LAYER (NOT clipped, so dropdowns can overflow) */}
          <div className="relative rounded-[34px] p-5 sm:p-6">
            <div className="relative space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/70">
                    Drops
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                    Curated sneaker releases
                  </h1>
                  <p className="text-[12px] sm:text-sm text-gray-300/70 max-w-xl">
                    Search, filter, and lock your picks — clean UI, fast actions.
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur">
                  <span className="text-[10px] uppercase tracking-[0.24em] text-gray-300/70">
                    {filteredAndSorted.length} results
                  </span>
                </div>
              </div>

              {/* FILTER BAR */}
              <div className="relative z-20 rounded-[24px] border border-white/10 bg-white/[0.04] backdrop-blur p-3 sm:p-4 shadow-[0_16px_60px_rgba(0,0,0,0.32)]">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <input
                    type="text"
                    placeholder="Search drops"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`${fieldBase} min-w-[200px] flex-1`}
                  />

                  <input
                    type="number"
                    min="0"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className={`${fieldBase} ${numberFieldNoSpinner} w-[92px]`}
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className={`${fieldBase} ${numberFieldNoSpinner} w-[92px]`}
                  />

                  <GlassSelect
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    options={CATEGORY_OPTIONS}
                    widthClass="w-[180px]"
                  />
                  <GlassSelect
                    value={sortBy}
                    onChange={setSortBy}
                    options={SORT_OPTIONS}
                    widthClass="w-[200px]"
                  />

                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className={`${pillButton} border border-white/10 bg-white/5 text-white/85 hover:bg-white/10`}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {message && (
                <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[12px] text-gray-200/80">
                  {message}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* CONTENT */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[30px] border border-white/10 bg-white/[0.03] backdrop-blur p-4 shadow-[0_18px_70px_rgba(0,0,0,0.35)]"
              >
                <div className="w-full aspect-square rounded-[22px] bg-white/10 animate-pulse mb-4" />
                <div className="h-4 w-2/3 rounded bg-white/10 animate-pulse mb-2" />
                <div className="h-4 w-1/3 rounded bg-white/10 animate-pulse mb-4" />
                <div className="h-10 w-full rounded-full bg-white/10 animate-pulse" />
              </div>
            ))}
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="rounded-[30px] border border-white/10 bg-white/[0.03] backdrop-blur p-10 text-center shadow-[0_18px_70px_rgba(0,0,0,0.35)]">
            <p className="text-sm text-gray-200/80">Nothing matches these filters.</p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-5 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-black hover:opacity-95 transition active:scale-[0.98]"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAndSorted.map((product) => {
              const priceNumber = Number(product?.price || 0);
              const stock = Number(product?.stock || 0);
              const isSoldOut = stock <= 0;

              const imageUrl = product?.imageUrl ? `${apiBase}${product.imageUrl}` : null;

              return (
                <div
                  key={product.id}
                  className="group relative overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.03] backdrop-blur p-4 shadow-[0_18px_70px_rgba(0,0,0,0.35)] transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(600px_circle_at_25%_20%,rgba(168,85,247,0.10),transparent_60%),radial-gradient(600px_circle_at_85%_55%,rgba(251,113,133,0.08),transparent_62%)]" />

                  <DripLink
                    href={`/products/${product.id}`}
                    className="relative block rounded-[22px] overflow-hidden border border-white/10 bg-black/20"
                  >
                    <div className="w-full aspect-square flex items-center justify-center overflow-hidden">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product?.name || "Sneaks-up drop"}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                        />
                      ) : (
                        <span className="text-[10px] uppercase tracking-[0.22em] text-gray-300/60">
                          SNEAKS-UP
                        </span>
                      )}
                    </div>

                    <div className="absolute left-3 top-3">
                      <StockBadge stock={product?.stock} ink="dark" />
                    </div>

                    <div className="absolute right-3 top-3">
                      <span className="inline-flex items-center rounded-full px-3 py-1 border border-black/10 bg-white/80 backdrop-blur text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
                        ${priceNumber.toFixed(2)}
                      </span>
                    </div>

                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  </DripLink>

                  <div className="relative pt-4 space-y-2">
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-foreground line-clamp-1">
                        {product?.name}
                      </h2>
                      {product?.description && (
                        <p className="mt-1 text-[12px] text-gray-300/70 line-clamp-2 leading-snug">
                          {product.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
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

                    <div className="pt-3">
                      <button
                        type="button"
                        onClick={() => handleAddToCart(product)}
                        disabled={addingId === product.id || isSoldOut}
                        className={[
                          "w-full inline-flex items-center justify-center rounded-full",
                          "text-[11px] font-semibold uppercase tracking-[0.18em]",
                          "px-4 py-3 transition active:scale-[0.98]",
                          isSoldOut
                            ? "bg-white/10 text-gray-400 cursor-not-allowed border border-white/10"
                            : "bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] text-black hover:opacity-95",
                          "disabled:opacity-70 disabled:cursor-not-allowed",
                        ].join(" ")}
                      >
                        {isSoldOut ? "Sold out" : addingId === product.id ? "Adding…" : "Add to bag"}
                      </button>

                      {!user && !isSoldOut && (
                        <p className="mt-2 text-[11px] text-gray-300/60">
                          Guest mode: items save in your bag until you log in.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import SiteLayout from "../../components/SiteLayout";
import DripLink from "../../components/DripLink";
import StockBadge from "../../components/StockBadge";
import { useAuth } from "../../context/AuthContext";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

// Fixed category set – must match backend IDs
const CATEGORY_OPTIONS = [
  { id: 1, label: "Low Top" },
  { id: 2, label: "Mid Top" },
  { id: 3, label: "High Top" },
];

const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce((acc, opt) => {
  acc[opt.id] = opt.label;
  return acc;
}, {});

function getCategoryLabel(categoryId) {
  const num = Number(categoryId);
  if (!num) return "Uncategorized";
  return CATEGORY_LABELS[num] || `Category #${num}`;
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

  // Load products from backend
  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setMessage("");

      try {
        const res = await fetch(`${apiBase}/products`);

        if (!res.ok) {
          let msg = "Failed to load products.";
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            try {
              const errJson = await res.json();
              if (errJson?.message) msg = errJson.message;
            } catch {}
          }
          setMessage(msg);
          setProducts([]);
          return;
        }

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          setMessage("Unexpected response while loading products.");
          setProducts([]);
          return;
        }

        let data;
        try {
          data = await res.json();
        } catch {
          setMessage("Could not decode products data.");
          setProducts([]);
          return;
        }

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

  // Filter + sort products
  const filteredAndSorted = useMemo(() => {
    let list = [...products];

    // Only active products (but out-of-stock allowed)
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
    if (!Number.isNaN(min)) {
      list = list.filter((p) => Number(p?.price || 0) >= min);
    }

    const max = parseFloat(maxPrice);
    if (!Number.isNaN(max)) {
      list = list.filter((p) => Number(p?.price || 0) <= max);
    }

    if (categoryFilter !== "all") {
      const catId = Number(categoryFilter);
      if (!Number.isNaN(catId)) {
        list = list.filter((p) => Number(p?.categoryId) === catId);
      }
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

    // Guest cart
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

    // Server cart
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
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      const ct = res.headers.get("content-type") || "";
      let data = null;
      if (ct.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
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

  // Theme controls
  const controlBase =
    "h-10 rounded-full border border-border bg-white/5 text-[11px] text-gray-100 " +
    "placeholder:text-gray-400/70 px-3 backdrop-blur " +
    "focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_45%,transparent)]";

  const selectBase =
    "h-10 rounded-full border border-border bg-white/5 text-[11px] text-gray-100 " +
    "px-3 backdrop-blur focus:outline-none focus:ring-2 " +
    "focus:ring-[color-mix(in_oklab,var(--drip-accent)_45%,transparent)]";

  return (
    <SiteLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <section className="rounded-[28px] border border-border bg-black/25 backdrop-blur p-5 sm:p-6 shadow-[0_16px_60px_rgba(0,0,0,0.40)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold tracking-[0.26em] uppercase text-gray-300/70">
                  Drops
                </p>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                  Curated sneaker releases
                </h1>
                <p className="text-xs text-gray-300/70 max-w-xl">
                  Search, filter, and lock your picks. Minimal, clean, and fast.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.22em] text-gray-300/60">
                  {filteredAndSorted.length} results
                </span>
              </div>
            </div>

            {/* FILTER BAR */}
            <div className="rounded-full border border-white/10 bg-white/5 p-2 backdrop-blur">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search drops"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`${controlBase} min-w-[190px]`}
                />

                <input
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className={`${controlBase} w-[90px]`}
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className={`${controlBase} w-[90px]`}
                />

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className={selectBase}
                >
                  <option value="all">All categories</option>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat.id} value={String(cat.id)}>
                      {cat.label}
                    </option>
                  ))}
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className={selectBase}
                >
                  <option value="popularity">Most popular</option>
                  <option value="priceAsc">Price: Low to High</option>
                  <option value="priceDesc">Price: High to Low</option>
                </select>

                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="
                    h-10 px-4 rounded-full
                    border border-white/10 bg-white/5
                    text-[11px] font-semibold uppercase tracking-[0.18em]
                    text-gray-100 hover:bg-white/10 transition active:scale-[0.98]
                  "
                >
                  Reset
                </button>
              </div>
            </div>

            {message && (
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] text-gray-200/80">
                {message}
              </div>
            )}
          </div>
        </section>

        {/* LOADING */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-4 shadow-[0_16px_60px_rgba(0,0,0,0.40)]"
              >
                <div className="w-full aspect-square rounded-[22px] bg-white/10 animate-pulse mb-4" />
                <div className="h-4 w-2/3 rounded bg-white/10 animate-pulse mb-2" />
                <div className="h-4 w-1/3 rounded bg-white/10 animate-pulse mb-4" />
                <div className="h-10 w-full rounded-full bg-white/10 animate-pulse" />
              </div>
            ))}
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-8 text-center">
            <p className="text-sm text-gray-200/80">
              Nothing matches these filters.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="
                mt-4 inline-flex items-center justify-center rounded-full
                bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em]
                text-black hover:opacity-95 transition active:scale-[0.98]
              "
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
                  className="
                    group rounded-[28px] border border-border
                    bg-black/20 backdrop-blur p-4
                    shadow-[0_16px_60px_rgba(0,0,0,0.40)]
                    transition-transform duration-200 hover:-translate-y-0.5
                  "
                >
                  {/* IMAGE */}
                  <DripLink
                    href={`/products/${product.id}`}
                    className="block rounded-[22px] overflow-hidden bg-black/20 border border-white/10"
                  >
                    <div className="w-full aspect-square flex items-center justify-center overflow-hidden">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product?.name || "Sneaks-up drop"}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <span className="text-[10px] uppercase tracking-[0.22em] text-gray-300/60">
                          Sneaks-up
                        </span>
                      )}
                    </div>
                  </DripLink>

                  {/* TEXT */}
                  <div className="pt-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-foreground line-clamp-1">
                          {product?.name}
                        </h2>
                        {product?.description && (
                          <p className="mt-1 text-[11px] text-gray-300/70 line-clamp-2 leading-snug">
                            {product.description}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0">
                        <div
                          className="
                            inline-flex items-center rounded-full px-3 py-1.5
                            border border-white/10 bg-black/30 text-white
                            text-[12px] font-semibold
                          "
                        >
                          ${priceNumber.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <StockBadge stock={product?.stock} tone="muted" />
                      <span className="text-[10px] text-gray-300/60 uppercase tracking-[0.18em]">
                        {getCategoryLabel(product?.categoryId)}
                      </span>
                    </div>

                    {/* CTA: hover on desktop, always visible on mobile */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleAddToCart(product)}
                        disabled={addingId === product.id || isSoldOut}
                        className={[
                          "w-full inline-flex items-center justify-center rounded-full",
                          "text-[11px] font-semibold uppercase tracking-[0.18em]",
                          "px-4 py-2.5 transition active:scale-[0.98]",
                          "md:opacity-0 md:translate-y-1 md:group-hover:opacity-100 md:group-hover:translate-y-0",
                          isSoldOut
                            ? "bg-white/10 text-gray-400 cursor-not-allowed border border-white/10"
                            : "bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] text-black hover:opacity-95",
                          "disabled:opacity-70 disabled:cursor-not-allowed",
                        ].join(" ")}
                      >
                        {isSoldOut
                          ? "Sold out"
                          : addingId === product.id
                          ? "Adding…"
                          : "Add to bag"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom microcopy */}
        {!loading && filteredAndSorted.length > 0 && (
          <div className="pt-2 text-center">
            <p className="text-[10px] uppercase tracking-[0.26em] text-gray-300/55">
              Tip: sort “Price: High to Low” for hype pairs
            </p>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

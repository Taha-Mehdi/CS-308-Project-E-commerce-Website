"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../components/SiteLayout";
import StockBadge from "../../components/StockBadge";
import { useAuth } from "../../context/AuthContext";
import { getProductsApi, addToCartApi } from "../../lib/api";

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function ProductsPage() {
  const { user } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [addingId, setAddingId] = useState(null);

  const isBrowser = typeof window !== "undefined";

  function showAlert(text) {
    if (isBrowser) {
      window.alert(text);
    }
  }

  function addToGuestCart(productId) {
    if (!isBrowser) return;

    try {
      const raw = localStorage.getItem("guestCart") || "[]";
      let cart = [];

      try {
        cart = JSON.parse(raw);
        if (!Array.isArray(cart)) {
          cart = [];
        }
      } catch {
        cart = [];
      }

      const existing = cart.find((item) => item.productId === productId);
      if (existing) {
        existing.quantity += 1;
      } else {
        cart.push({ productId, quantity: 1 });
      }

      localStorage.setItem("guestCart", JSON.stringify(cart));
      window.dispatchEvent(new Event("cart-updated"));
    } catch (err) {
      console.error("Guest cart error:", err);
      throw err;
    }
  }

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setMessage("");

      try {
        const data = await getProductsApi();

        if (!Array.isArray(data)) {
          setMessage("Product data format is invalid.");
          setProducts([]);
          return;
        }

        setProducts(data);
      } catch (err) {
        console.error("Products load error:", err);
        const msg =
          err?.message && err.message !== "API request failed"
            ? err.message
            : "Failed to load drops.";
        setMessage(msg);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  // Build category list from products (clean + minimal)
  const categories = useMemo(() => {
    const map = new Map();

    products.forEach((p) => {
      if (p.categoryId == null) return;
      const value = String(p.categoryId);
      // Try to find a readable label if backend provides it
      const label =
        p.categoryName ||
        p.category ||
        p.categoryLabel ||
        `Category ${p.categoryId}`;
      if (!map.has(value)) {
        map.set(value, label);
      }
    });

    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [products]);

  const filtered = useMemo(() => {
    let list = [...products];

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => (p.name || "").toLowerCase().includes(q));
    }

    const min = parseFloat(minPrice);
    if (!Number.isNaN(min)) {
      list = list.filter((p) => Number(p.price || 0) >= min);
    }

    const max = parseFloat(maxPrice);
    if (!Number.isNaN(max)) {
      list = list.filter((p) => Number(p.price || 0) <= max);
    }

    if (categoryFilter) {
      list = list.filter(
        (p) => p.categoryId != null && String(p.categoryId) === categoryFilter
      );
    }

    // Only show active products
    list = list.filter((p) => p.isActive !== false);

    return list;
  }, [products, search, minPrice, maxPrice, categoryFilter]);

  function handleResetFilters() {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setCategoryFilter("");
  }

  async function handleAddToCart(productId) {
    console.log("ADD TO CART CLICK", { productId, user });

    // Guest user → localStorage cart
    if (!user) {
      try {
        setAddingId(productId);
        addToGuestCart(productId);

        const msg =
          "Drop added to your bag. You’ll be asked to log in when you check out.";
        setMessage(msg);
      } catch (err) {
        console.error("Guest add error:", err);
        const msg = "Could not add this drop to your bag.";
        setMessage(msg);
        showAlert(msg);
      } finally {
        setAddingId(null);
      }
      return;
    }

    // Logged-in user → server cart
    try {
      setAddingId(productId);
      setMessage("");

      await addToCartApi({ productId, quantity: 1 });

      if (isBrowser) {
        window.dispatchEvent(new Event("cart-updated"));
      }

      setMessage("Drop added to your bag.");
    } catch (err) {
      console.error("Add to cart error:", err);
      const msg =
        err?.data?.message ||
        err?.message ||
        "Could not add this drop to your bag.";
      setMessage(msg);
      showAlert(msg);
    } finally {
      setAddingId(null);
    }
  }

  if (loading) {
    return (
      <SiteLayout>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="h-5 w-28 rounded-full bg-gray-200 animate-pulse" />
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-8 w-32 rounded-full bg-gray-200 animate-pulse" />
              <div className="h-8 w-24 rounded-full bg-gray-200 animate-pulse" />
              <div className="h-8 w-24 rounded-full bg-gray-200 animate-pulse" />
              <div className="h-8 w-28 rounded-full bg-gray-200 animate-pulse" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="w-full aspect-square rounded-2xl bg-gray-200 animate-pulse mb-3" />
                <div className="h-4 w-2/3 rounded bg-gray-200 animate-pulse mb-2" />
                <div className="h-4 w-1/3 rounded bg-gray-200 animate-pulse mb-4" />
                <div className="h-8 w-24 rounded-full bg-gray-200 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-lg sm:text-xl font-semibold tracking-[0.22em] uppercase text-gray-900">
              Drops
            </h1>
            <p className="text-[11px] text-gray-500 uppercase tracking-[0.18em]">
              Latest heat · Limited stock · First come, first served
            </p>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-2 py-1 backdrop-blur">
            <input
              type="text"
              placeholder="Search drops"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 rounded-full border-none bg-transparent px-3 text-[11px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-0 min-w-[140px]"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                placeholder="Min $"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="h-8 w-[80px] rounded-full border border-gray-200 bg-white px-3 text-[11px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-black/40"
              />
              <span className="text-[10px] text-gray-400 px-1">–</span>
              <input
                type="number"
                min="0"
                placeholder="Max $"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="h-8 w-[80px] rounded-full border border-gray-200 bg-white px-3 text-[11px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-black/40"
              />
            </div>

            {/* Category dropdown */}
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-8 max-w-[180px] appearance-none truncate rounded-full border border-gray-200 bg-white pl-3 pr-8 text-[11px] text-gray-800 focus:outline-none focus:ring-1 focus:ring-black/40"
              >
                <option value="">All categories</option>
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-gray-400">
                ▾
              </span>
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              className="h-8 px-3 rounded-full bg-black text-white text-[10px] font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 active:scale-[0.97] transition-all"
            >
              Reset
            </button>
          </div>
        </div>

        {message && (
          <p className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 inline-block">
            {message}
          </p>
        )}

        {/* Product grid */}
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500">
            No drops match your filters. Try adjusting your search.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => {
              const priceNumber = Number(product.price || 0);
              const imageUrl = product.imageUrl
                ? `${apiBase}${product.imageUrl}`
                : null;
              const outOfStock =
                typeof product.stock === "number" && product.stock <= 0;

              return (
                <div
                  key={product.id}
                  className="group rounded-3xl border border-gray-200 bg-white p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col"
                >
                  <Link
                    href={`/products/${product.id}`}
                    className="block mb-3 rounded-2xl overflow-hidden bg-gray-100 relative"
                  >
                    <div className="w-full aspect-square flex items-center justify-center">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product.name || "Drop"}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <span className="text-[9px] uppercase tracking-[0.22em] text-gray-400">
                          Hype drop
                        </span>
                      )}
                    </div>
                    {outOfStock && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
                          Sold out
                        </span>
                      </div>
                    )}
                  </Link>

                  <div className="flex-1 space-y-1 mb-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-gray-900 line-clamp-1">
                        {product.name}
                      </h2>
                      <p className="text-xs font-semibold text-gray-900">
                        ${priceNumber.toFixed(2)}
                      </p>
                    </div>
                    {product.description && (
                      <p className="text-[11px] text-gray-500 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    <div className="pt-1">
                      <StockBadge stock={product.stock} tone="muted" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddToCart(product.id)}
                    disabled={addingId === product.id || outOfStock}
                    className="mt-auto inline-flex items-center justify-center rounded-full bg-black text-white text-[11px] font-semibold uppercase tracking-[0.18em] px-4 py-2 hover:bg-gray-900 active:scale-[0.97] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {outOfStock
                      ? "Sold out"
                      : addingId === product.id
                      ? "Adding…"
                      : "Add to bag"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
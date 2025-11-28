"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../components/SiteLayout";
import { useAuth } from "../../context/AuthContext";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function ProductsPage() {
  const { user } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [addingId, setAddingId] = useState(null);

  // Fetch products
  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setMessage("");
      try {
        const res = await fetch(`${apiBase}/products`);

        if (!res.ok) {
          let msg = "Failed to load drops.";
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            try {
              const errJson = await res.json();
              if (errJson && errJson.message) msg = errJson.message;
            } catch {
              // ignore
            }
          }
          setMessage(msg);
          setProducts([]);
          setLoading(false);
          return;
        }

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          setMessage("Unexpected response while loading drops.");
          setProducts([]);
          setLoading(false);
          return;
        }

        let data;
        try {
          data = await res.json();
        } catch {
          setMessage("Could not decode drops data.");
          setProducts([]);
          setLoading(false);
          return;
        }

        if (!Array.isArray(data)) {
          setMessage("Drops data format is invalid.");
          setProducts([]);
          setLoading(false);
          return;
        }

        setProducts(data);
      } catch (err) {
        console.error("Products load error:", err);
        setMessage("Failed to load drops.");
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  // Filtered products
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

    // Only show active products
    list = list.filter((p) => p.isActive !== false);

    return list;
  }, [products, search, minPrice, maxPrice]);

  function handleResetFilters() {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
  }

  async function handleAddToCart(productId) {
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;

      if (!token) {
        setMessage("Login to add pairs to your bag.");
        if (typeof window !== "undefined") {
          window.alert("Login to add pairs to your bag.");
        }
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
        body: JSON.stringify({
          productId,
          quantity: 1,
        }),
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
        console.error("Add to cart failed:", data || {});
        const msg =
          (data && data.message) || "Could not add this pair to your bag.";
        setMessage(msg);
        if (typeof window !== "undefined") {
          window.alert(msg);
        }
        return;
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cart-updated"));
      }

      setMessage("Pair added to your bag.");
    } catch (err) {
      console.error("Add to cart error:", err);
      const msg = "Could not add this pair to your bag.";
      setMessage(msg);
      if (typeof window !== "undefined") {
        window.alert(msg);
      }
    } finally {
      setAddingId(null);
    }
  }

  // If loading, show skeleton grid
  if (loading) {
    return (
      <SiteLayout>
        <div className="space-y-5">
          {/* Header row skeleton */}
          <div className="flex items-center justify-between gap-3">
            <div className="h-5 w-24 rounded-full bg-gray-200 animate-pulse" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-32 rounded-full bg-gray-200 animate-pulse" />
              <div className="h-8 w-24 rounded-full bg-gray-200 animate-pulse" />
              <div className="h-8 w-24 rounded-full bg-gray-200 animate-pulse" />
              <div className="h-8 w-28 rounded-full bg-gray-200 animate-pulse" />
            </div>
          </div>

          {/* Cards skeleton */}
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
        {/* Top row: title + filters inline */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg sm:text-xl font-semibold tracking-[0.22em] uppercase text-gray-900">
            Drops
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-full border border-gray-300 bg-white px-3 text-[11px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-black/40 min-w-[150px]"
            />
            {/* Min price */}
            <input
              type="number"
              min="0"
              placeholder="Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="h-9 rounded-full border border-gray-300 bg-white px-3 text-[11px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-black/40 w-[80px]"
            />
            {/* Max price */}
            <input
              type="number"
              min="0"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="h-9 rounded-full border border-gray-300 bg-white px-3 text-[11px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-black/40 w-[80px]"
            />
            {/* Reset */}
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-9 px-4 rounded-full border bg-white/80 backdrop-blur text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-800 hover:bg-black hover:text-white transition-all active:scale-[0.97]"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Optional message */}
        {message && (
          <p className="text-[11px] text-gray-600">{message}</p>
        )}

        {/* Product grid */}
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500">
            No drops match your filters. Try clearing them.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => {
              const priceNumber = Number(product.price || 0);
              const imageUrl = product.imageUrl
                ? `${apiBase}${product.imageUrl}`
                : null;

              return (
                <div
                  key={product.id}
                  className="group rounded-3xl border border-gray-200 bg-white p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col"
                >
                  {/* Clickable image zone */}
                  <Link
                    href={`/products/${product.id}`}
                    className="block mb-3 rounded-2xl overflow-hidden bg-gray-100"
                  >
                    <div className="w-full aspect-square flex items-center justify-center">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product.name || "Sneaks-up drop"}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <span className="text-[9px] uppercase tracking-[0.22em] text-gray-400">
                          Sneaks-up drop
                        </span>
                      )}
                    </div>
                  </Link>

                  {/* Text info */}
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
                    <p className="text-[11px] text-gray-500">
                      Stock:{" "}
                      <span className="font-medium text-gray-900">
                        {product.stock}
                      </span>
                    </p>
                  </div>

                  {/* Add to bag */}
                  <button
                    type="button"
                    onClick={() => handleAddToCart(product.id)}
                    disabled={addingId === product.id}
                    className="mt-auto inline-flex items-center justify-center rounded-full bg-black text-white text-[11px] font-semibold uppercase tracking-[0.18em] px-4 py-2 hover:bg-gray-900 active:scale-[0.97] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {addingId === product.id ? "Adding…" : "Add to bag"}
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

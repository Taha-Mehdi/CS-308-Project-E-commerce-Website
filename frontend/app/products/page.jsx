"use client";

import { useEffect, useMemo, useState } from "react";
import SiteLayout from "../../components/SiteLayout";
import ProductCard from "../../components/ProductCard";
import { parseJsonSafe } from "../../lib/api";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setMessage("");

      try {
        const res = await fetch(`${apiBase}/products?....`);

        if (!res.ok) {
          setProducts([]);
          return;
        }

        const data = await parseJsonSafe(res);

        if (!Array.isArray(data)) {
          setProducts([]);
        } else {
          setProducts(data);
        }

        if (!res.ok) {
          setProducts([]);
          setMessage(data.message || "Failed to load products.");
        } else {
          setProducts(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Products load error:", err);
        setProducts([]);
        setMessage("Failed to load products.");
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [apiBase]);

  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Search filter
    if (search.trim() !== "") {
      const s = search.trim().toLowerCase();
      list = list.filter((p) => {
        const name = (p.name || "").toLowerCase();
        const desc = (p.description || "").toLowerCase();
        return name.includes(s) || desc.includes(s);
      });
    }

    // Price filters
    const min = minPrice !== "" ? Number(minPrice) : null;
    const max = maxPrice !== "" ? Number(maxPrice) : null;

    list = list.filter((p) => {
      const priceNum = Number(p.price || 0);
      if (min !== null && priceNum < min) return false;
      if (max !== null && priceNum > max) return false;
      return true;
    });

    if (inStockOnly) {
      list = list.filter((p) => (p.stock || 0) > 0);
    }

    return list;
  }, [products, search, minPrice, maxPrice, inStockOnly]);

  function handleResetFilters() {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
  }

  return (
    <SiteLayout>
      <div className="space-y-6">
        {/* Header + filters inline */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
            Drops
          </h1>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              type="text"
              placeholder="Search drops…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 sm:flex-none w-40 sm:w-52 border border-gray-300 rounded-full px-4 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-gray-300 transition"
            />

            <input
              type="number"
              min="0"
              step="0.01"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min"
              className="w-20 border border-gray-300 rounded-full px-3 py-2 text-xs text-gray-900 bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-gray-300 transition"
            />

            <input
              type="number"
              min="0"
              step="0.01"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max"
              className="w-20 border border-gray-300 rounded-full px-3 py-2 text-xs text-gray-900 bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-gray-300 transition"
            />

            <label className="inline-flex items-center gap-1.5 text-xs text-gray-900">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="h-4 w-4 border-gray-300 rounded"
              />
              <span>In stock</span>
            </label>

            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition"
            >
              Reset
            </button>
          </div>
        </header>

        {/* Divider */}
        <div className="h-px bg-gray-200" />

        {/* Grid */}
        <section className="space-y-3">
          {message && (
            <p className="text-xs text-red-600">{message}</p>
          )}

          {loading ? (
            <p className="text-sm text-gray-500">Loading drops…</p>
          ) : filteredProducts.length === 0 ? (
            <p className="text-sm text-gray-500">No matching drops.</p>
          ) : (
            <>
              <p className="text-[11px] text-gray-500 uppercase tracking-[0.18em]">
                {filteredProducts.length} drop
                {filteredProducts.length !== 1 ? "s" : ""}
              </p>
              <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </SiteLayout>
  );
}

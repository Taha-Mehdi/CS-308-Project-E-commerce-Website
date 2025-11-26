"use client";

import { useEffect, useMemo, useState } from "react";
import SiteLayout from "../../components/SiteLayout";
import ProductCard from "../../components/ProductCard";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  async function loadProducts() {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/products`
      );
      const data = await res.json();

      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load products:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const priceNumber = Number(p.price || 0);

      if (inStockOnly && (!p.stock || p.stock <= 0)) {
        return false;
      }

      if (minPrice !== "" && priceNumber < Number(minPrice)) {
        return false;
      }

      if (maxPrice !== "" && priceNumber > Number(maxPrice)) {
        return false;
      }

      if (search.trim() !== "") {
        const term = search.toLowerCase();
        const nameMatch = (p.name || "").toLowerCase().includes(term);
        const descMatch = (p.description || "")
          .toLowerCase()
          .includes(term);
        if (!nameMatch && !descMatch) {
          return false;
        }
      }

      return true;
    });
  }, [products, search, inStockOnly, minPrice, maxPrice]);

  return (
    <SiteLayout>
      <div className="space-y-6">
        {/* Header + filters */}
        <div className="space-y-3">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            All Products
          </h1>
          <p className="text-xs text-gray-500">
            Browse the catalog. Use search and filters to narrow down
            results.
          </p>

          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            {/* Search */}
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">
                Search
              </label>
              <input
                type="text"
                placeholder="Search by name or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring focus:ring-gray-300"
              />
            </div>

            {/* Price filters */}
            <div className="flex gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Min price
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-24 border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring focus:ring-gray-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Max price
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-24 border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring focus:ring-gray-300"
                />
              </div>
            </div>

            {/* In stock toggle */}
            <div className="flex items-center gap-2">
              <input
                id="inStockOnly"
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="h-4 w-4 border-gray-300 rounded"
              />
              <label
                htmlFor="inStockOnly"
                className="text-xs text-gray-700"
              >
                In stock only
              </label>
            </div>
          </div>
        </div>

        {/* Products grid */}
        {loading ? (
          <p className="text-sm text-gray-500">Loading products…</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-sm text-gray-500">
            No products match your filters.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

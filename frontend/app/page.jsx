"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteLayout from "../components/SiteLayout";
import ProductCard from "../components/ProductCard";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveIndex, setLiveIndex] = useState(0);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  // Load products
  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/products`);
        if (!res.ok) return setProducts([]);

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) return setProducts([]);

        let data = [];
        try {
          data = await res.json();
        } catch {}
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Products load error:", err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [apiBase]);

  // Auto-rotate live image
  useEffect(() => {
    if (!products.length) return;
    const interval = setInterval(() => {
      setLiveIndex((prev) => (prev + 1) % products.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [products]);

  // Shuffle for random sections
  const shuffledProducts = useMemo(() => {
    if (!products.length) return [];
    const arr = [...products];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [products]);

  const featured = shuffledProducts.slice(0, 4);
  const mostWanted = shuffledProducts.slice(4, 8).length
    ? shuffledProducts.slice(4, 8)
    : shuffledProducts.slice(0, 4);

  const newArrivals = products.slice(4, 8).length
    ? products.slice(4, 8)
    : products.slice(0, 4);

  const liveProduct =
    products.length > 0 ? products[liveIndex % products.length] : null;

  const liveImageUrl =
    liveProduct?.imageUrl ? `${apiBase}${liveProduct.imageUrl}` : null;

  return (
    <SiteLayout>
      <div className="space-y-10 sm:space-y-12">
        {/* HERO SECTION */}
        <section className="rounded-3xl bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white px-5 sm:px-8 py-8 sm:py-10 flex flex-col md:flex-row gap-8 items-center">
          {/* Left copy */}
          <div className="flex-1 space-y-4">
            <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-400">
              SNEAKER HEAVEN
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight tracking-tight">
              Discover the next{" "}
              <span className="text-blue-400">sneaker drop</span>.
            </h1>
            <p className="text-sm sm:text-base text-gray-300 max-w-xl">
              A hype-driven marketplace for limited pairs, clean daily rotation,
              and everything in between.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/products"
                className="px-5 py-2.5 rounded-full bg-white text-black text-xs sm:text-sm font-semibold uppercase tracking-[0.12em] hover:bg-gray-100 transition-colors"
              >
                Browse drops
              </Link>
              <Link
                href="/cart"
                className="px-5 py-2.5 rounded-full border border-white/40 text-xs sm:text-sm font-semibold uppercase tracking-[0.12em] text-white hover:bg-white hover:text-black transition-colors"
              >
                View bag
              </Link>

              {user ? (
                <Link
                  href="/orders"
                  className="px-5 py-2.5 rounded-full border border-white/30 text-xs sm:text-sm font-semibold uppercase tracking-[0.12em] text-gray-200 hover:bg-white/10 transition-colors"
                >
                  Your orders
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="px-5 py-2.5 rounded-full border border-white/30 text-xs sm:text-sm font-semibold uppercase tracking-[0.12em] text-gray-200 hover:bg-white/10 transition-colors"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>

          {/* RIGHT — FIXED LIVE DROP IMAGE (MATCHES PRODUCT CARD) */}
          <div className="flex-1 max-w-sm w-full">
            <div className="rounded-3xl bg-black/30 border border-white/10 px-4 py-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* neon dot */}
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-lime-400 shadow-[0_0_10px_rgba(132,255,99,0.9)] animate-pulse" />
                  <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-gray-300">
                    Live drops
                  </p>
                </div>
                <span className="text-[10px] text-gray-400">
                  {products.length} pairs
                </span>
              </div>

              {/* Square image exactly like product cards */}
              <div className="rounded-2xl overflow-hidden bg-gray-100 border border-white/10">
                <div className="w-full aspect-square flex items-center justify-center overflow-hidden">
                  {loading ? (
                    <div className="text-xs text-gray-500">Loading…</div>
                  ) : !liveImageUrl ? (
                    <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                      Sneaks
                    </span>
                  ) : (
                    <img
                      src={liveImageUrl}
                      alt={liveProduct?.name || "Live drop"}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURED */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                Featured
              </p>
              <h2 className="text-sm sm:text-base font-semibold text-gray-900">
                Spotlight drops
              </h2>
            </div>
            <Link
              href="/products"
              className="text-[11px] text-gray-700 underline hover:text-black"
            >
              View all drops
            </Link>
          </div>

          {!featured.length ? (
            <p className="text-sm text-gray-500">No drops live yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>

        {/* NEW ARRIVALS */}
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
              New arrivals
            </p>
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">
              Fresh on the shelf
            </h2>
          </div>

          {!newArrivals.length ? (
            <p className="text-sm text-gray-500">Nothing new yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {newArrivals.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>

        {/* MOST WANTED */}
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
              Most wanted
            </p>
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">
              Hype picks from the vault
            </h2>
          </div>

          {!mostWanted.length ? (
            <p className="text-sm text-gray-500">Not enough data yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {mostWanted.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </div>
    </SiteLayout>
  );
}

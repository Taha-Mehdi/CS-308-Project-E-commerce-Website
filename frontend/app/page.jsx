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
        {/* HERO SECTION (cleaner + more premium) */}
        <section className="relative overflow-hidden rounded-[32px] border border-border bg-surface p-5 sm:p-8">
          {/* background glow */}
          <div
            className="
              pointer-events-none absolute inset-0
              bg-[radial-gradient(900px_circle_at_18%_18%,rgba(168,85,247,0.20),transparent_52%),radial-gradient(900px_circle_at_78%_38%,rgba(251,113,133,0.16),transparent_58%)]
            "
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/25" />

          <div className="relative flex flex-col md:flex-row gap-8 items-center">
            {/* Left copy */}
            <div className="flex-1">
              <p className="text-[11px] font-semibold tracking-[0.26em] uppercase text-gray-300/70">
                Sneaker heaven
              </p>

              <h1 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight tracking-tight text-foreground">
                Discover the next{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]">
                  sneaker drop
                </span>
                .
              </h1>

              <p className="mt-4 text-sm sm:text-base text-gray-300/85 max-w-xl">
                A hype-driven marketplace for limited pairs, clean daily
                rotation, and everything in between.
              </p>

              {/* Only 2 buttons now */}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="
                    px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold uppercase tracking-[0.12em]
                    bg-primary text-black hover:opacity-95 transition active:scale-[0.98]
                  "
                >
                  Browse drops
                </Link>

                <Link
                  href="/cart"
                  className="
                    px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold uppercase tracking-[0.12em]
                    border border-border text-foreground hover:bg-white/10 transition active:scale-[0.98]
                  "
                >
                  View bag
                </Link>
              </div>

              {/* small, clean counter (replaces the removed chips) */}
              <div className="mt-7 text-[11px] text-gray-300/70">
                {products.length ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-black/20 px-3 py-1.5">
                    <span className="inline-block size-1.5 rounded-full bg-[var(--drip-accent-2)]" />
                    {products.length} live pairs
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-black/20 px-3 py-1.5">
                    <span className="inline-block size-1.5 rounded-full bg-[var(--drip-accent)]" />
                    Loading drops…
                  </span>
                )}
              </div>
            </div>

            {/* Right: Square live drop card */}
            <div className="flex-1 max-w-md w-full">
              <div
                className="
                  rounded-[28px] overflow-hidden
                  border border-border
                  bg-[color-mix(in_oklab,var(--background)_80%,black_20%)]
                  shadow-[0_18px_55px_rgba(0,0,0,0.45)]
                "
              >
                {/* header */}
                <div className="px-5 pt-5 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-2.5 rounded-full bg-[var(--drip-accent)] shadow-[0_0_12px_rgba(168,85,247,0.65)] animate-pulse" />
                    <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-200">
                      Live drop
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-300/70">
                    {products.length ? `${products.length} pairs` : ""}
                  </span>
                </div>

                {/* SQUARE IMAGE */}
                <div className="px-5 pb-5">
                  <div className="relative rounded-[22px] overflow-hidden border border-white/10 bg-black/25 aspect-square">
                    {/* overlay fade */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                    {loading ? (
                      <div className="h-full w-full grid place-items-center">
                        <div className="text-xs text-gray-300/70">Loading…</div>
                      </div>
                    ) : !liveImageUrl ? (
                      <div className="h-full w-full grid place-items-center">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-gray-300/70">
                          Sneaks
                        </span>
                      </div>
                    ) : (
                      <img
                        src={liveImageUrl}
                        alt={liveProduct?.name || "Live drop"}
                        className="w-full h-full object-cover"
                      />
                    )}

                    {/* price chip (top-left) */}
                    {liveProduct?.price != null && (
                      <div className="absolute left-4 top-4">
                        <div
                          className="
                            inline-flex items-center gap-2 rounded-full px-3 py-1.5
                            border border-[color-mix(in_oklab,var(--drip-accent)_45%,transparent)]
                            bg-black/55 backdrop-blur
                            shadow-[0_10px_30px_rgba(0,0,0,0.35)]
                          "
                        >
                          <span className="inline-block size-1.5 rounded-full bg-[var(--drip-accent-2)]" />
                          <span className="text-[12px] font-semibold text-white">
                            ${Number(liveProduct.price).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* name strip (bottom) */}
                    <div className="absolute left-4 right-4 bottom-4">
                      <p className="text-[12px] font-semibold text-white line-clamp-1">
                        {liveProduct?.name || "Live drop"}
                      </p>

                      {/* sleek micro underline */}
                      <div className="mt-2 h-[2px] w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] opacity-90"
                          style={{
                            width: products.length
                              ? `${32 + ((liveIndex % 5) * 12)}%`
                              : "44%",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* removed: Rotating highlights + See all */}
            </div>
          </div>
        </section>

        {/* FEATURED */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-300/70 uppercase">
                Featured
              </p>
              <h2 className="text-sm sm:text-base font-semibold text-foreground">
                Spotlight drops
              </h2>
            </div>
            <Link
              href="/products"
              className="text-[11px] text-gray-300/80 underline hover:text-white"
            >
              View all drops
            </Link>
          </div>

          {!featured.length ? (
            <p className="text-sm text-gray-300/70">No drops live yet.</p>
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
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-300/70 uppercase">
              New arrivals
            </p>
            <h2 className="text-sm sm:text-base font-semibold text-foreground">
              Fresh on the shelf
            </h2>
          </div>

          {!newArrivals.length ? (
            <p className="text-sm text-gray-300/70">Nothing new yet.</p>
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
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-300/70 uppercase">
              Most wanted
            </p>
            <h2 className="text-sm sm:text-base font-semibold text-foreground">
              Hype picks from the vault
            </h2>
          </div>

          {!mostWanted.length ? (
            <p className="text-sm text-gray-300/70">Not enough data yet.</p>
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

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

  // -------------------------
  // Load products
  // -------------------------
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

    if (apiBase) loadProducts();
  }, [apiBase]);

  // -------------------------
  // Auto-rotate
  // -------------------------
  useEffect(() => {
    if (!products.length) return;
    const interval = setInterval(() => {
      setLiveIndex((prev) => (prev + 1) % products.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [products]);

  // -------------------------
  // Product lists
  // -------------------------
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

  // -------------------------
  // Helpers
  // -------------------------
  const formatPrice = (p) => {
    const n = Number(p);
    if (Number.isFinite(n)) return `$${n.toFixed(2)}`;
    return "";
  };

  const safeIndex = (i) => {
    if (!products.length) return 0;
    const n = products.length;
    return ((i % n) + n) % n;
  };

  const productAt = (offset = 0) => {
    if (!products.length) return null;
    return products[safeIndex(liveIndex + offset)];
  };

  const imageUrlOf = (prod) => {
    if (!prod?.imageUrl) return null;
    return `${apiBase}${prod.imageUrl}`;
  };

  // Discover carousel products
  const p0 = productAt(0);
  const p1 = productAt(1);
  const p2 = productAt(2);
  const p3 = productAt(3);

  const img0 = imageUrlOf(p0);
  const img1 = imageUrlOf(p1);
  const img2 = imageUrlOf(p2);
  const img3 = imageUrlOf(p3);

  return (
    <SiteLayout>
      <div className="space-y-10 sm:space-y-12">
        {/* =========================
           HERO
           ========================= */}
        <section className="relative overflow-hidden rounded-[44px] border border-border bg-surface p-4 sm:p-6">
          <div
            className="
              pointer-events-none absolute inset-0
              bg-[radial-gradient(1100px_circle_at_10%_18%,rgba(168,85,247,0.26),transparent_56%),radial-gradient(1000px_circle_at_92%_40%,rgba(251,113,133,0.18),transparent_60%)]
            "
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/16 via-transparent to-black/24" />
          <div className="pointer-events-none absolute inset-0 opacity-80 bg-[radial-gradient(1200px_circle_at_55%_45%,rgba(255,255,255,0.06),transparent_60%)]" />

          <div className="relative grid gap-4 md:gap-5 md:grid-cols-[1.15fr_0.85fr] items-center">
            {/* Left: SQUARE VIDEO */}
            <div className="relative">
              <div
                className="
                  relative rounded-[36px] overflow-hidden
                  border border-border bg-black/15
                  shadow-[0_26px_90px_rgba(0,0,0,0.58)]
                "
              >
                <div className="absolute left-4 top-4 z-10">
                  <div
                    className="
                      inline-flex items-center gap-2 rounded-full px-3.5 py-1.5
                      border border-[color-mix(in_oklab,var(--drip-accent)_55%,transparent)]
                      bg-black/45 backdrop-blur
                      shadow-[0_10px_30px_rgba(0,0,0,0.35)]
                    "
                  >
                    <span className="inline-block size-1.5 rounded-full bg-[var(--drip-accent)] shadow-[0_0_18px_rgba(168,85,247,0.85)]" />
                    <span className="text-[11px] font-semibold tracking-[0.26em] uppercase text-white">
                      Drop culture
                    </span>
                  </div>
                </div>

                <div className="w-full aspect-square">
                  <video
                    className="block w-full h-full object-cover"
                    src="/spotlight.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                <div className="absolute left-5 right-5 bottom-5">
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-base sm:text-lg font-semibold text-white leading-tight">
                      Built to turn heads.
                    </p>

                    <div className="hidden sm:block">
                      <div className="h-[2px] w-28 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] opacity-90 w-[78%]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: TEXT */}
            <div className="relative">
              <div className="hidden md:block pointer-events-none absolute -left-2 top-6 bottom-6 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

              <div className="relative px-1 sm:px-2 md:pl-6">
                <h1 className="mt-1 text-[34px] sm:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight text-foreground">
                  The home of the <span className="text-white/95">next</span>{" "}
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]">
                    sneaker drop
                  </span>
                  .
                </h1>

                <p className="mt-4 text-sm sm:text-base text-gray-300/85 max-w-xl">
                  A premium rotation of limited pairs — discover what’s live and
                  move fast when the drop hits.
                </p>

                <div className="mt-8">
                  <Link
                    href="/products"
                    className="
                      group relative inline-flex items-center justify-center
                      px-8 py-4 rounded-full
                      text-xs sm:text-sm font-semibold uppercase tracking-[0.18em]
                      text-foreground
                      border border-white/15 bg-white/[0.06] backdrop-blur
                      hover:bg-white/[0.10] transition active:scale-[0.98]
                      shadow-[0_22px_80px_rgba(0,0,0,0.25)]
                      overflow-hidden
                    "
                  >
                    <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300 bg-[radial-gradient(180px_circle_at_25%_40%,rgba(255,255,255,0.18),transparent_55%)]" />
                    <span className="pointer-events-none absolute -inset-10 opacity-40 bg-[radial-gradient(300px_circle_at_70%_40%,rgba(168,85,247,0.20),transparent_60%)]" />
                    <span className="relative flex items-center gap-2">
                      View drops
                      <span className="inline-block translate-x-0 group-hover:translate-x-0.5 transition">
                        →
                      </span>
                    </span>
                  </Link>
                </div>

                <div className="mt-8 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <p className="mt-4 text-[12px] text-gray-300/70 max-w-xl">
                  Built by sneakerheads, for sneakerheads.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================
              FEATURED
           ========================= */}
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-gray-300/70 uppercase">
                Featured
              </p>
              <h2 className="mt-1 text-base sm:text-lg font-semibold text-foreground">
                Spotlight featured
              </h2>
              <p className="mt-1 text-[12px] text-gray-300/70">
                The cleanest picks, highlighted right now.
              </p>
            </div>

            <Link
              href="/products"
              className="
                text-[11px] font-semibold uppercase tracking-[0.18em]
                rounded-full border border-border bg-black/20 px-4 py-2
                hover:bg-white/10 transition
              "
            >
              Shop
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

        {/* =========================
           DISCOVER (TWO SECTIONS: TEXT + TALL CAROUSEL)
           ========================= */}
        <section className="relative overflow-hidden rounded-[44px] border border-border bg-surface p-4 sm:p-6">
          <div
            className="
              pointer-events-none absolute inset-0
              bg-[radial-gradient(1100px_circle_at_16%_20%,rgba(168,85,247,0.20),transparent_56%),radial-gradient(1100px_circle_at_88%_52%,rgba(251,113,133,0.12),transparent_62%)]
            "
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/14 via-transparent to-black/20" />

          <div className="relative grid gap-6 md:grid-cols-[0.95fr_1.05fr] items-center">
            {/* Left: TEXT */}
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-2">
                <span className="inline-block size-2 rounded-full bg-[var(--drip-accent)] shadow-[0_0_18px_rgba(168,85,247,0.8)]" />
                <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-200/80">
                  Live rotation
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-tight tracking-tight text-foreground">
                Discover the next{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]">
                  drop
                </span>{" "}
                before it disappears.
              </h2>

              <p className="text-sm sm:text-base text-gray-300/85 max-w-xl">
                The lineup updates automatically. When something hits, you’ll see
                it here first.
              </p>

              <div className="pt-2">
                <Link
                  href="/products"
                  className="
                    group relative inline-flex items-center justify-center
                    px-7 py-3.5 rounded-full
                    text-xs sm:text-sm font-semibold uppercase tracking-[0.16em]
                    text-foreground
                    border border-white/15 bg-white/[0.06] backdrop-blur
                    hover:bg-white/[0.10] transition active:scale-[0.98]
                    shadow-[0_18px_70px_rgba(0,0,0,0.20)]
                    overflow-hidden
                  "
                >
                  <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300 bg-[radial-gradient(160px_circle_at_25%_40%,rgba(255,255,255,0.16),transparent_55%)]" />
                  <span className="pointer-events-none absolute -inset-10 opacity-35 bg-[radial-gradient(280px_circle_at_70%_40%,rgba(168,85,247,0.18),transparent_62%)]" />
                  <span className="relative flex items-center gap-2">
                    Explore rotation <span className="group-hover:translate-x-0.5 transition">→</span>
                  </span>
                </Link>
              </div>

              <div className="pt-3 flex items-center gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={[
                      "h-1.5 w-1.5 rounded-full transition",
                      i === (products.length ? liveIndex % 5 : 0)
                        ? "bg-[var(--drip-accent)] shadow-[0_0_14px_rgba(168,85,247,0.7)]"
                        : "bg-white/20",
                    ].join(" ")}
                  />
                ))}
              </div>
            </div>

            {/* Right: TALL MAIN CARD + THUMBS */}
            <div className="w-full">
              <div className="relative">
                <div className="pointer-events-none absolute -inset-10 rounded-[64px] bg-[radial-gradient(520px_circle_at_45%_35%,rgba(168,85,247,0.18),transparent_60%),radial-gradient(650px_circle_at_70%_60%,rgba(251,113,133,0.10),transparent_65%)]" />

                <div className="grid gap-4 sm:gap-5 sm:grid-cols-[1fr_110px] items-center">
                  {/* Main tall product card */}
                  <div className="relative">
                    <div className="relative aspect-[4/5] sm:aspect-[3/4] rounded-[34px] overflow-hidden shadow-[0_34px_130px_rgba(0,0,0,0.55)]">
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                      {loading ? (
                        <div className="h-full w-full grid place-items-center">
                          <div className="text-xs text-gray-300/70">
                            Loading…
                          </div>
                        </div>
                      ) : !img0 ? (
                        <div className="h-full w-full grid place-items-center">
                          <span className="text-[10px] uppercase tracking-[0.2em] text-gray-300/70">
                            No products yet
                          </span>
                        </div>
                      ) : (
                        <img
                          src={img0}
                          alt={p0?.name || "Product"}
                          className="h-full w-full object-cover"
                        />
                      )}

                      {!!p0 && (
                        <div className="absolute left-5 right-5 bottom-5">
                          <div className="flex items-end justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] tracking-[0.26em] uppercase text-gray-200/70">
                                Now rotating
                              </p>
                              <p className="mt-1 text-base sm:text-lg font-semibold text-white line-clamp-1">
                                {p0?.name || "Product"}
                              </p>
                            </div>

                            {!!formatPrice(p0?.price) && (
                              <div className="shrink-0 rounded-full px-4 py-2 border border-white/12 bg-black/45 backdrop-blur text-[12px] font-semibold text-white shadow-[0_14px_55px_rgba(0,0,0,0.35)]">
                                {formatPrice(p0?.price)}
                              </div>
                            )}
                          </div>

                          <div className="mt-3 h-[2px] w-full rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] opacity-95"
                              style={{
                                width: products.length
                                  ? `${48 + ((liveIndex % 5) * 10)}%`
                                  : "60%",
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Thumbnails */}
                  <div className="hidden sm:flex flex-col gap-3">
                    {[p1, p2, p3].map((p, i) => {
                      const u = imageUrlOf(p);
                      return (
                        <div
                          key={p?.id ?? i}
                          className="relative overflow-hidden rounded-[18px] aspect-square border border-white/10 shadow-[0_14px_55px_rgba(0,0,0,0.25)] opacity-85"
                        >
                          {u ? (
                            <img
                              src={u}
                              alt={p?.name || "Up next"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full grid place-items-center bg-white/5">
                              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-300/60">
                                Next
                              </span>
                            </div>
                          )}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* NEW ARRIVALS */}
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-300/70 uppercase">
              New arrivals
            </p>
            <h2 className="mt-1 text-base sm:text-lg font-semibold text-foreground">
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

        {/* POSTERS */}
        <section className="relative overflow-hidden rounded-[44px] border border-border bg-surface p-4 sm:p-6">
          <div
            className="
              pointer-events-none absolute inset-0
              bg-[radial-gradient(1100px_circle_at_20%_18%,rgba(168,85,247,0.16),transparent_55%),radial-gradient(1100px_circle_at_90%_55%,rgba(251,113,133,0.12),transparent_62%)]
            "
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/12 via-transparent to-black/18" />

          <div className="relative text-center">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
              Campaign classics. Studio energy.
            </h2>
            <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          <div className="relative mt-6 grid gap-5 lg:grid-cols-3 items-stretch">
            {[
              {
                src: "/posters/poster-1.jpg",
                kicker: "Featured print",
                title: "NIKE • Window Takeover",
              },
              {
                src: "/posters/poster-2.jpg",
                kicker: "Archive",
                title: "AIR • Courting a Legend",
              },
              {
                src: "/posters/poster-3.jpg",
                kicker: "Studio cut",
                title: "AIR MAX • Just do it",
              },
            ].map((p, idx) => (
              <div
                key={p.src}
                className={[
                  "group relative overflow-hidden rounded-[30px]",
                  "border border-white/10",
                  "shadow-[0_30px_110px_rgba(0,0,0,0.50)]",
                  "transition duration-300 hover:-translate-y-1",
                  idx === 1 ? "lg:-translate-y-2" : "",
                ].join(" ")}
              >
                <div className="pointer-events-none absolute -inset-10 opacity-0 group-hover:opacity-100 transition duration-300 bg-[radial-gradient(520px_circle_at_35%_25%,rgba(168,85,247,0.22),transparent_60%)]" />

                <div className="relative aspect-[3/4] md:aspect-[4/5] lg:aspect-[3/4]">
                  <img
                    src={p.src}
                    alt={p.title}
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/12 to-transparent" />

                  <div className="absolute left-5 right-5 bottom-5">
                    <p className="text-[10px] tracking-[0.28em] uppercase text-gray-200/75">
                      {p.kicker}
                    </p>
                    <p className="mt-1 text-base sm:text-lg font-semibold text-white leading-tight">
                      {p.title}
                    </p>

                    <div className="mt-3 h-[2px] w-24 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full w-full bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] opacity-95" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* MOST WANTED */}
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-300/70 uppercase">
              Most wanted
            </p>
            <h2 className="mt-1 text-base sm:text-lg font-semibold text-foreground">
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

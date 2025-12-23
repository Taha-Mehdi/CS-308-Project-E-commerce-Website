"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import SiteLayout from "../components/SiteLayout";
import ProductCard from "../components/ProductCard";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { user } = useAuth(); // kept (you may use it later)
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Drop Radar rotation
  const [liveIndex, setLiveIndex] = useState(0);
  const [radarHover, setRadarHover] = useState(false);
  const intervalRef = useRef(null);

  // -------------------------
  // Fast, abortable load
  // -------------------------
  useEffect(() => {
    if (!apiBase) return;

    const controller = new AbortController();
    const signal = controller.signal;

    async function loadProducts() {
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/products`, {
          signal,
          cache: "no-store",
        });

        if (!res.ok) {
          setProducts([]);
          return;
        }

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          setProducts([]);
          return;
        }

        const data = await res.json().catch(() => []);
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err?.name !== "AbortError") console.error("Products load error:", err);
        setProducts([]);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    loadProducts();
    return () => controller.abort();
  }, [apiBase]);

  // -------------------------
  // Auto-rotate (pause on hover)
  // -------------------------
  useEffect(() => {
    if (!products.length) return;

    setLiveIndex((prev) => (prev >= products.length ? 0 : prev));

    if (intervalRef.current) clearInterval(intervalRef.current);
    if (radarHover) return;

    intervalRef.current = setInterval(() => {
      setLiveIndex((prev) => (prev + 1) % products.length);
    }, 2600);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [products.length, radarHover]);

  // -------------------------
  // Derived lists (memoized)
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

  const featured = useMemo(() => shuffledProducts.slice(0, 4), [shuffledProducts]);

  const mostWanted = useMemo(() => {
    const slice = shuffledProducts.slice(4, 8);
    return slice.length ? slice : shuffledProducts.slice(0, 4);
  }, [shuffledProducts]);

  const newArrivals = useMemo(() => {
    const slice = products.slice(4, 8);
    return slice.length ? slice : products.slice(0, 4);
  }, [products]);

  // -------------------------
  // Helpers (stable)
  // -------------------------
  const formatPrice = useCallback((p) => {
    const n = Number(p);
    return Number.isFinite(n) ? `$${n.toFixed(2)}` : "";
  }, []);

  const safeIndex = useCallback(
    (i) => {
      const n = products.length;
      if (!n) return 0;
      return ((i % n) + n) % n;
    },
    [products.length]
  );

  const productAt = useCallback(
    (offset = 0) => {
      if (!products.length) return null;
      return products[safeIndex(liveIndex + offset)];
    },
    [products, liveIndex, safeIndex]
  );

  const imageUrlOf = useCallback(
    (prod) => {
      if (!prod?.imageUrl || !apiBase) return null;
      return `${apiBase}${prod.imageUrl}`;
    },
    [apiBase]
  );

  // Radar picks
  const p0 = productAt(0);
  const p1 = productAt(1);
  const p2 = productAt(2);
  const p3 = productAt(3);

  const img0 = imageUrlOf(p0);
  const img1 = imageUrlOf(p1);
  const img2 = imageUrlOf(p2);
  const img3 = imageUrlOf(p3);

  const liveName = p0?.name || "Live Drop";
  const livePrice = formatPrice(p0?.price);
  const liveId = p0?.id;
  const liveHref = liveId ? `/products/${liveId}` : "/products";

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
           DROP RADAR
           ========================= */}
        <section
          className="relative overflow-hidden rounded-[44px] border border-border bg-surface p-4 sm:p-6"
          onMouseEnter={() => setRadarHover(true)}
          onMouseLeave={() => setRadarHover(false)}
        >
          <div
            className="
              pointer-events-none absolute inset-0
              bg-[radial-gradient(1200px_circle_at_18%_18%,rgba(168,85,247,0.22),transparent_55%),radial-gradient(1100px_circle_at_88%_55%,rgba(251,113,133,0.12),transparent_62%),radial-gradient(900px_circle_at_55%_55%,rgba(255,255,255,0.05),transparent_60%)]
            "
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/12 via-transparent to-black/18" />

          <div className="relative grid gap-6 md:grid-cols-[0.9fr_1.1fr] items-center">
            {/* LEFT */}
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 py-2">
                  <span className="inline-block size-2 rounded-full bg-[var(--drip-accent)] shadow-[0_0_18px_rgba(168,85,247,0.85)]" />
                  <span className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-200/80">
                    Drop radar
                  </span>
                </div>

                {/* ✅ Live scan dot is neon green */}
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-2">
                  <span
                    className={[
                      "inline-block size-2 rounded-full",
                      radarHover
                        ? "bg-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.95)]"
                        : "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,1)]",
                    ].join(" ")}
                  />
                  <span className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-200/70">
                    {radarHover ? "paused" : "live scan"}
                  </span>
                </div>
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-tight tracking-tight text-foreground">
                The drip isn’t found — it’s{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]">
                  detected
                </span>
                .
              </h2>

              <p className="text-sm sm:text-base text-gray-300/85 max-w-xl">
                A live scan of what’s rotating right now. Hover to freeze the
                radar, then jump into the drop.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href={liveHref}
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
                    Enter live drop{" "}
                    <span className="group-hover:translate-x-0.5 transition">→</span>
                  </span>
                </Link>

                <Link
                  href="/products"
                  className="
                    inline-flex items-center justify-center
                    px-6 py-3.5 rounded-full
                    text-xs sm:text-sm font-semibold uppercase tracking-[0.16em]
                    text-gray-100/90
                    border border-white/12 bg-black/15
                    hover:bg-white/10 transition active:scale-[0.98]
                  "
                >
                  Browse all
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
                <span className="ml-2 text-[11px] tracking-[0.22em] uppercase text-gray-300/60">
                  scanning
                </span>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] tracking-[0.28em] uppercase text-gray-200/60">
                    Up next
                  </p>
                  <p className="text-[10px] tracking-[0.28em] uppercase text-gray-200/45">
                    auto-rotates
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3">
                  {[{ p: p1, img: img1 }, { p: p2, img: img2 }, { p: p3, img: img3 }].map(
                    (item, idx) => (
                      <div
                        key={item?.p?.id ?? idx}
                        className="
                          relative overflow-hidden rounded-[18px]
                          border border-white/10 bg-black/10
                          shadow-[0_14px_55px_rgba(0,0,0,0.20)]
                        "
                      >
                        <div className="aspect-[4/3]">
                          {item.img ? (
                            <img
                              src={item.img}
                              alt={item?.p?.name || "Up next"}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="h-full w-full grid place-items-center bg-white/5">
                              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-300/60">
                                Next
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                        <div className="absolute left-3 right-3 bottom-3">
                          <p className="text-[11px] font-semibold text-white/90 line-clamp-1">
                            {item?.p?.name || "—"}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: LIVE CARD (wider main image only) */}
            <div className="relative">
              <div className="pointer-events-none absolute -inset-10 rounded-[64px] bg-[radial-gradient(520px_circle_at_45%_35%,rgba(168,85,247,0.20),transparent_60%),radial-gradient(650px_circle_at_70%_60%,rgba(251,113,133,0.12),transparent_65%)]" />

              <div className="relative">
                <div className="pointer-events-none absolute inset-0 rounded-[40px] opacity-60 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:18px_18px]" />

                <div className="relative rounded-[40px] border border-white/10 bg-black/10 p-4 sm:p-5 shadow-[0_34px_130px_rgba(0,0,0,0.45)]">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] tracking-[0.28em] uppercase text-gray-200/65">
                        Live card
                      </p>
                      <p className="mt-1 text-lg sm:text-xl font-semibold text-white line-clamp-2 sm:line-clamp-1">
                        {loading ? "Loading…" : liveName}
                      </p>
                    </div>

                    {!!livePrice && (
                      <div
                        className="
                          shrink-0 w-fit
                          rounded-full px-4 py-2
                          border border-white/12 bg-black/45 backdrop-blur
                          text-[12px] font-semibold text-white
                          shadow-[0_14px_55px_rgba(0,0,0,0.35)]
                        "
                      >
                        {livePrice}
                      </div>
                    )}
                  </div>

                  {/* ✅ Only the main product image (no side stack) */}
                  <Link
                    href={liveHref}
                    className="
                      group relative block mt-4
                      rounded-[34px] overflow-hidden
                      border border-white/10
                      shadow-[0_34px_130px_rgba(0,0,0,0.55)]
                      active:scale-[0.99] transition
                      w-full
                    "
                    aria-label="Open live drop"
                  >
                    <div className="relative h-[440px] sm:h-[520px] md:h-[560px]">
                      {loading ? (
                        <div className="absolute inset-0 grid place-items-center bg-white/5">
                          <div className="text-xs text-gray-300/70">Loading…</div>
                        </div>
                      ) : !img0 ? (
                        <div className="absolute inset-0 grid place-items-center bg-white/5">
                          <span className="text-[10px] uppercase tracking-[0.2em] text-gray-300/70">
                            No products yet
                          </span>
                        </div>
                      ) : (
                        <img
                          src={img0}
                          alt={p0?.name || "Product"}
                          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          loading="eager"
                          decoding="async"
                          fetchPriority="high"
                        />
                      )}

                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="pointer-events-none absolute -inset-12 opacity-0 group-hover:opacity-100 transition duration-300 bg-[radial-gradient(380px_circle_at_35%_35%,rgba(168,85,247,0.22),transparent_60%)]" />

                      <div className="absolute left-5 right-5 bottom-5">
                        <div className="flex items-end justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] tracking-[0.26em] uppercase text-gray-200/70">
                              Detected
                            </p>
                            <p className="mt-1 text-base sm:text-lg font-semibold text-white line-clamp-1">
                              {p0?.name || "Product"}
                            </p>
                          </div>

                          <div className="shrink-0 text-[11px] font-semibold tracking-[0.2em] uppercase text-white/80">
                            open →
                          </div>
                        </div>

                        <div className="mt-3 h-[2px] w-full rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] opacity-95"
                            style={{
                              width: products.length ? `${46 + ((liveIndex % 5) * 10)}%` : "60%",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>

                <div className="pointer-events-none mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" />
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

        {/* POSTERS (taller, bigger, one line) */}
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

          {/* ✅ One line on desktop, taller cards */}
          <div className="relative mt-6 grid gap-5 grid-cols-1 md:grid-cols-3 items-stretch">
            {[
              { src: "/posters/poster-1.jpg", kicker: "Featured print", title: "NIKE • Window Takeover" },
              { src: "/posters/poster-2.jpg", kicker: "Archive", title: "AIR • Courting a Legend" },
              { src: "/posters/poster-3.jpg", kicker: "Studio cut", title: "AIR MAX • Just do it" },
            ].map((p) => (
              <div
                key={p.src}
                className="
                  group relative overflow-hidden rounded-[30px]
                  border border-white/10
                  shadow-[0_30px_110px_rgba(0,0,0,0.50)]
                  transition duration-300 hover:-translate-y-1
                "
              >
                <div className="pointer-events-none absolute -inset-10 opacity-0 group-hover:opacity-100 transition duration-300 bg-[radial-gradient(520px_circle_at_35%_25%,rgba(168,85,247,0.22),transparent_60%)]" />

                {/* ✅ Bigger/taller visual */}
                <div className="relative h-[420px] sm:h-[520px]">
                  <img
                    src={p.src}
                    alt={p.title}
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/12 to-transparent" />

                  <div className="absolute left-5 right-5 bottom-5">
                    <p className="text-[10px] tracking-[0.28em] uppercase text-gray-200/80">
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

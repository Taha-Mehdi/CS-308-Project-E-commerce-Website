"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteLayout from "../components/SiteLayout";
import ProductCard from "../components/ProductCard";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { user } = useAuth();
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    async function loadFeatured() {
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/products`);

        if (!res.ok) {
          // if 429 / 500 / etc → just show no featured
          setFeatured([]);
          setLoading(false);
          return;
        }

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          // response is probably HTML or plain text ("Too many requests...")
          setFeatured([]);
          setLoading(false);
          return;
        }

        let data;
        try {
          data = await res.json();
        } catch {
          setFeatured([]);
          setLoading(false);
          return;
        }

        if (!Array.isArray(data)) {
          setFeatured([]);
        } else {
          setFeatured(data.slice(0, 4));
        }
      } catch (err) {
        console.error("Failed to load featured products:", err);
        setFeatured([]);
      } finally {
        setLoading(false);
      }
    }

    loadFeatured();
  }, [apiBase]);

  return (
    <SiteLayout>
      <div className="space-y-10 sm:space-y-12">
        {/* 1. HERO SECTION */}
        <section className="rounded-3xl bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white px-5 sm:px-8 py-8 sm:py-10 flex flex-col md:flex-row gap-8 items-center">
          {/* Left: copy */}
          <div className="flex-1 space-y-4">
            <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-400">
              SNEAKS-UP · ONLINE STORE
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight tracking-tight">
              Discover the next{" "}
              <span className="text-blue-400">sneaker drop</span>.
            </h1>
            <p className="text-sm sm:text-base text-gray-300 max-w-xl">
              A full-stack ecommerce experience for hype sneakers. Browse
              drops, add to your bag, and track your orders — backed by
              Node, Neon, and Next.js.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/products"
                className="px-4 sm:px-5 py-2.5 rounded-full bg-white text-black text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] hover:bg-gray-100 transition-colors"
              >
                Browse drops
              </Link>
              <Link
                href="/cart"
                className="px-4 sm:px-5 py-2.5 rounded-full border border-white/30 text-xs sm:text-sm font-medium uppercase tracking-[0.16em] text-white hover:bg-white hover:text-black transition-colors"
              >
                View bag
              </Link>
              {user ? (
                <Link
                  href="/orders"
                  className="px-4 sm:px-5 py-2.5 rounded-full border border-white/20 text-[11px] sm:text-xs font-medium uppercase tracking-[0.16em] text-gray-200 hover:bg-white/10 transition-colors"
                >
                  Your orders
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="px-4 sm:px-5 py-2.5 rounded-full border border-white/20 text-[11px] sm:text-xs font-medium uppercase tracking-[0.16em] text-gray-200 hover:bg-white/10 transition-colors"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>

          {/* Right: account / tech card */}
          <div className="flex-1 max-w-sm w-full">
            <div className="rounded-3xl bg-white text-gray-900 p-5 sm:p-6 shadow-xl space-y-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                  Account status
                </p>
                <p className="text-sm font-semibold">
                  {user
                    ? user.fullName || user.email
                    : "Guest user"}
                </p>
                <p className="text-[11px] text-gray-500">
                  {user
                    ? user.roleId === 1
                      ? "Logged in · Admin"
                      : "Logged in · Customer"
                    : "Not signed in"}
                </p>
              </div>

              <div className="h-px bg-gray-200" />

              <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
                <div className="flex-1 min-w-[8rem] space-y-0.5">
                  <p className="font-semibold text-gray-900">
                    Backend
                  </p>
                  <p>Node.js · Express</p>
                  <p>Neon · Drizzle ORM</p>
                </div>
                <div className="flex-1 min-w-[8rem] space-y-0.5">
                  <p className="font-semibold text-gray-900">
                    Frontend
                  </p>
                  <p>Next.js (App Router)</p>
                  <p>Tailwind · Recharts</p>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-2">
                {user ? (
                  <Link
                    href="/account"
                    className="px-3.5 py-2 rounded-full border border-gray-300 text-[11px] font-medium uppercase tracking-[0.16em] text-gray-800 hover:bg-gray-100 transition-colors"
                  >
                    Account
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="px-3.5 py-2 rounded-full bg-black text-white text-[11px] font-medium uppercase tracking-[0.16em] hover:bg-gray-900 transition-colors"
                    >
                      Login
                    </Link>
                    <Link
                      href="/register"
                      className="px-3.5 py-2 rounded-full border border-gray-300 text-[11px] font-medium uppercase tracking-[0.16em] text-gray-800 hover:bg-gray-100 transition-colors"
                    >
                      Sign up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 2. FEATURED DROPS */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                Featured
              </p>
              <h2 className="text-sm sm:text-base font-semibold text-gray-900">
                Latest drops
              </h2>
            </div>
            <Link
              href="/products"
              className="text-[11px] text-gray-700 underline underline-offset-4 hover:text-black"
            >
              View all drops
            </Link>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading drops…</p>
          ) : featured.length === 0 ? (
            <p className="text-sm text-gray-500">
              No featured drops available yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        {/* 3. BROWSE BY VIBE */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                Collections
              </p>
              <h2 className="text-sm sm:text-base font-semibold text-gray-900">
                Browse by vibe
              </h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm space-y-2">
              <p className="text-xs font-semibold text-gray-900">
                New arrivals
              </p>
              <p className="text-xs text-gray-500">
                Latest pairs just added to the catalog. Perfect for
                showcasing the “drop” feel of your backend.
              </p>
              <Link
                href="/products"
                className="text-[11px] text-gray-800 underline underline-offset-4"
              >
                Shop now
              </Link>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm space-y-2">
              <p className="text-xs font-semibold text-gray-900">
                Everyday rotation
              </p>
              <p className="text-xs text-gray-500">
                Clean, versatile sneakers for daily wear — use this section
                to talk about your sample data or pricing.
              </p>
              <Link
                href="/products"
                className="text-[11px] text-gray-800 underline underline-offset-4"
              >
                Explore pairs
              </Link>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm space-y-2">
              <p className="text-xs font-semibold text-gray-900">
                Limited feel
              </p>
              <p className="text-xs text-gray-500">
                Even if stock is fake, this section sells the idea of heat,
                limited runs, and the hype store experience.
              </p>
              <Link
                href="/products"
                className="text-[11px] text-gray-800 underline underline-offset-4"
              >
                View drops
              </Link>
            </div>
          </div>
        </section>

        {/* 4. PROJECT / TECH SECTION */}
        <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                CS-308 · Course project
              </p>
              <h2 className="text-sm sm:text-base font-semibold text-gray-900">
                Under the hood
              </h2>
            </div>
            <Link
              href="/admin"
              className="text-[11px] text-gray-700 underline underline-offset-4 hover:text-black"
            >
              Admin dashboard
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 text-xs text-gray-600">
            <div className="space-y-1">
              <p className="font-semibold text-gray-900 text-sm">
                Backend
              </p>
              <p>Node.js · Express</p>
              <p>JWT auth · bcrypt</p>
              <p>Helmet · rate limiting</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-gray-900 text-sm">
                Data & security
              </p>
              <p>Neon (PostgreSQL)</p>
              <p>Drizzle ORM · Migrations</p>
              <p>Validation with Zod</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-gray-900 text-sm">
                Frontend
              </p>
              <p>Next.js App Router</p>
              <p>Tailwind CSS</p>
              <p>Recharts (analytics)</p>
            </div>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}

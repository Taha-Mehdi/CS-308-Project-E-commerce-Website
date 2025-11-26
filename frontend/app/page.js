"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import SiteLayout from "../components/SiteLayout";
import ProductCard from "../components/ProductCard";

export default function HomePage() {
  const { user, loadingUser } = useAuth();
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
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
        setLoadingProducts(false);
      }
    }

    loadProducts();
  }, []);

  const featured = products.slice(0, 4);

  return (
    <SiteLayout>
      <div className="space-y-10">
        {/* Hero section */}
        <section className="grid gap-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-center">
          <div className="space-y-4">
            <p className="text-[11px] font-semibold tracking-[0.24em] text-gray-500 uppercase">
              Online Store · CS308 Project
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-gray-900">
              Stay wild with your ideas.
            </h1>
            <p className="text-sm sm:text-base text-gray-600 max-w-xl">
              A minimal ecommerce experience inspired by premium mockup stores.
              Browse products, manage your cart, place orders, and track your
              history with a clean, focused interface.
            </p>

            {loadingUser ? (
              <p className="text-xs text-gray-500">Checking login status...</p>
            ) : user ? (
              <p className="text-xs text-gray-600">
                Logged in as{" "}
                <span className="font-medium text-gray-900">
                  {user.fullName}
                </span>{" "}
                <span className="text-gray-500">({user.email})</span>
              </p>
            ) : (
              <p className="text-xs text-gray-600">
                You&apos;re browsing as a guest.{" "}
                <Link
                  href="/login"
                  className="underline underline-offset-4 text-gray-900 font-medium"
                >
                  Login
                </Link>{" "}
                or{" "}
                <Link
                  href="/register"
                  className="underline underline-offset-4 text-gray-900 font-medium"
                >
                  create an account
                </Link>{" "}
                to sync your cart and orders.
              </p>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/products"
                className="inline-flex items-center px-4 py-2.5 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-900 transition-colors"
              >
                Browse products
              </Link>
              <Link
                href="/cart"
                className="inline-flex items-center px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium text-gray-800 hover:bg-gray-100 transition-colors"
              >
                View cart
              </Link>
            </div>
          </div>

          {/* Right side: simple highlight / stats */}
          <div className="border border-gray-200 bg-white rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.2em] text-gray-500 uppercase">
                Snapshot
              </p>
              <p className="text-sm text-gray-600">
                This is a fully functional ecommerce backend & frontend:
                authentication, products, cart, orders, admin, and invoices.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">
                  Products
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {products.length}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">
                  Status
                </p>
                <p className="mt-1 text-xs font-medium text-emerald-600">
                  Connected
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">
                  Mode
                </p>
                <p className="mt-1 text-xs font-medium text-gray-900">
                  Dev / Local
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Featured products */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-[0.2em] text-gray-600 uppercase">
              Featured Products
            </h2>
            <Link
              href="/products"
              className="text-xs text-gray-700 hover:text-black underline underline-offset-4"
            >
              View all
            </Link>
          </div>

          {loadingProducts ? (
            <p className="text-xs text-gray-500">Loading products…</p>
          ) : featured.length === 0 ? (
            <p className="text-xs text-gray-500">
              No products yet. Add some via the backend admin API.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </div>
    </SiteLayout>
  );
}

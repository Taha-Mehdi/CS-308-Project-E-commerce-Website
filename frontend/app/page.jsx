"use client";

import Link from "next/link";
import SiteLayout from "../components/SiteLayout";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <SiteLayout>
      <div className="space-y-8">
        {/* Hero */}
        <section className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-center">
          <div className="space-y-4">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
              CS308 · Ecommerce Store
            </p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">
              A simple online store with real authentication, cart, and orders.
            </h1>
            <p className="text-sm text-gray-600 max-w-xl">
              Browse products, add items to your cart, place orders, and see a
              small admin dashboard. This project connects a Next.js frontend to
              a Node/Express + PostgreSQL backend.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/products"
                className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-900 transition-colors"
              >
                Browse products
              </Link>
              <Link
                href="/cart"
                className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium text-gray-800 hover:bg-gray-100 transition-colors"
              >
                View cart
              </Link>
              {user && (
                <Link
                  href="/orders"
                  className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  Your orders
                </Link>
              )}
              {user && user.roleId === 1 && (
                <Link
                  href="/admin"
                  className="px-4 py-2.5 rounded-full border border-gray-900 text-xs font-medium text-gray-900 hover:bg-gray-900 hover:text-white transition-colors"
                >
                  Admin dashboard
                </Link>
              )}
            </div>
          </div>

          {/* Simple preview card */}
          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-4 space-y-4">
            <div className="rounded-2xl bg-gray-900 text-white p-4 space-y-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">
                Logged in as
              </p>
              <p className="text-sm font-medium">
                {user
                  ? `${user.fullName} (${user.email})`
                  : "Guest user"}
              </p>
              <p className="text-[11px] text-gray-300">
                Role:{" "}
                {user
                  ? user.roleId === 1
                    ? "Admin"
                    : "Customer"
                  : "Not logged in"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-gray-600">
                Quick links
              </p>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <Link
                  href="/products"
                  className="px-3 py-1.5 rounded-full border border-gray-300 text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  Products
                </Link>
                <Link
                  href="/cart"
                  className="px-3 py-1.5 rounded-full border border-gray-300 text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  Cart
                </Link>
                <Link
                  href="/orders"
                  className="px-3 py-1.5 rounded-full border border-gray-300 text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  Orders
                </Link>
                {user && user.roleId === 1 && (
                  <>
                    <Link
                      href="/admin/products"
                      className="px-3 py-1.5 rounded-full border border-gray-300 text-gray-800 hover:bg-gray-100 transition-colors"
                    >
                      Admin · Products
                    </Link>
                    <Link
                      href="/admin/analytics"
                      className="px-3 py-1.5 rounded-full border border-gray-300 text-gray-800 hover:bg-gray-100 transition-colors"
                    >
                      Admin · Analytics
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}

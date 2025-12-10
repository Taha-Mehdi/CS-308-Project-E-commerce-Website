"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../components/SiteLayout";
import { useAuth } from "../../context/AuthContext";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function AdminDashboardPage() {
  const { user, loadingUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);

  async function safeJson(res) {
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  // Load admin data
  async function loadDashboard() {
    setLoading(true);
    setMessage("");

    let token = null;
    if (typeof window !== "undefined") {
      token = localStorage.getItem("token") || null;
    }

    if (!token) {
      setOrders([]);
      setProducts([]);
      setMessage("Please log in as an admin to view the dashboard.");
      setLoading(false);
      return;
    }

    try {
      // Admin orders: GET /orders (admin only)
      const ordersRes = await fetch(`${apiBase}/orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let ordersData = [];
      if (ordersRes.ok) {
        const json = await safeJson(ordersRes);
        if (Array.isArray(json)) {
          ordersData = json;
        }
      } else if (ordersRes.status === 403) {
        setMessage("You do not have admin permissions.");
      }

      setOrders(ordersData);

      // Products: GET /products
      const productsRes = await fetch(`${apiBase}/products`);
      let productsData = [];
      if (productsRes.ok) {
        const json = await safeJson(productsRes);
        if (Array.isArray(json)) {
          productsData = json;
        }
      }

      setProducts(productsData);
    } catch (err) {
      console.error("Admin dashboard load error:", err);
      setMessage("Failed to load admin metrics.");
      setOrders([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!loadingUser && user && user.roleId === 1) {
      loadDashboard();
    } else if (!loadingUser && (!user || user.roleId !== 1)) {
      setLoading(false);
    }
  }, [loadingUser, user]);

  // Derived metrics
  const stats = useMemo(() => {
    const totalOrders = orders.length;

    const totalRevenue = orders.reduce((sum, o) => {
      const num = Number(o.total || 0);
      return sum + (Number.isNaN(num) ? 0 : num);
    }, 0);

    // use the new statuses
    const processingOrders = orders.filter((o) => o.status === "processing").length;
    const inTransitOrders = orders.filter((o) => o.status === "in_transit").length;
    const deliveredOrders = orders.filter((o) => o.status === "delivered").length;

    const totalProducts = products.length;
    const lowStockProducts = products.filter((p) => {
      if (typeof p.stock !== "number") return false;
      return p.stock > 0 && p.stock <= 5;
    }).length;

    const outOfStock = products.filter((p) => {
      if (typeof p.stock !== "number") return false;
      return p.stock === 0;
    }).length;

    return {
      totalOrders,
      totalRevenue,
      processingOrders,
      inTransitOrders,
      deliveredOrders,
      totalProducts,
      lowStockProducts,
      outOfStock,
    };
  }, [orders, products]);

  // Loading state while checking auth
  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-500">Checking admin access…</p>
      </SiteLayout>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-4">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
            Admin dashboard
          </h1>
          <p className="text-sm text-gray-600 max-w-sm">
            You need to be logged in as an admin to access the SNEAKS-UP control
            center.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-semibold uppercase tracking-[0.18em] text-gray-800 hover:bg-gray-100 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // Logged in but not admin
  if (user.roleId !== 1) {
    return (
      <SiteLayout>
        <div className="space-y-3">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
            Admin dashboard
          </h1>
          <p className="text-sm text-gray-600">
            Your account does not have admin permissions.
          </p>
          <Link
            href="/"
            className="inline-flex text-xs text-gray-800 underline underline-offset-4 mt-2"
          >
            Back to homepage
          </Link>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-500">
              Sneaks-up · Admin
            </p>
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
              Control room
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Live snapshot of drops, orders, and stock across the SNEAKS-UP
              store.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadDashboard}
              className="px-3.5 py-1.5 rounded-full border border-gray-300 bg-white text-[11px] font-medium text-gray-800 hover:bg-gray-100 transition-colors"
            >
              Hard refresh
            </button>
          </div>
        </div>

        {message && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700">
            {message}
          </div>
        )}

        {/* Top metrics grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white/95 px-4 py-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-500">
                Orders
              </p>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-gray-900">
              {stats.totalOrders}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              {stats.processingOrders} processing · {stats.inTransitOrders} in-transit
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/95 px-4 py-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-500">
                Revenue
              </p>
              <span className="w-2 h-2 rounded-full bg-black" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-gray-900">
              ${stats.totalRevenue.toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              Delivered orders: {stats.deliveredOrders}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/95 px-4 py-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-500">
                Catalog
              </p>
              <span className="w-2 h-2 rounded-full bg-sky-500" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-gray-900">
              {stats.totalProducts}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              {stats.lowStockProducts} low stock · {stats.outOfStock} sold out
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/95 px-4 py-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-500">
                Health
              </p>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-gray-900">
              {stats.processingOrders + stats.inTransitOrders > 0 ? "Live" : "Stable"}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              Processing: {stats.processingOrders} · In-transit: {stats.inTransitOrders}
            </p>
          </div>
        </div>

        {/* Navigation cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Products */}
          <Link
            href="/admin/products"
            className="group rounded-3xl border border-gray-200 bg-white/95 px-5 py-5 shadow-sm flex flex-col justify-between hover:border-black hover:-translate-y-[2px] hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-gray-500">
                  Manage
                </p>
                <h2 className="mt-1 text-sm font-semibold text-gray-900">
                  Products
                </h2>
              </div>
              <span className="inline-flex h-7 px-3 rounded-full bg-black text-[11px] font-medium text-white items-center justify-center">
                {stats.totalProducts} live
              </span>
            </div>
            <p className="mt-3 text-xs text-gray-600">
              Edit drops, adjust stock, and upload sneaker imagery for the next
              release.
            </p>
            <div className="mt-4 flex items-center gap-1 text-[11px] text-gray-900">
              <span>Open products panel</span>
              <span className="group-hover:translate-x-[2px] transition-transform">
                →
              </span>
            </div>
          </Link>

          {/* Orders */}
          <Link
            href="/admin/orders"
            className="group rounded-3xl border border-gray-200 bg-white/95 px-5 py-5 shadow-sm flex flex-col justify-between hover:border-black hover:-translate-y-[2px] hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-gray-500">
                  Monitor
                </p>
                <h2 className="mt-1 text-sm font-semibold text-gray-900">
                  Orders
                </h2>
              </div>
              <span className="inline-flex h-7 px-3 rounded-full bg-gray-900 text-[11px] font-medium text-white items-center justify-center">
                {stats.processingOrders + stats.inTransitOrders} active
              </span>
            </div>
            <p className="mt-3 text-xs text-gray-600">
              Review order flow, update statuses, and watch drops move through
              the pipeline.
            </p>
            <div className="mt-4 flex items-center gap-1 text-[11px] text-gray-900">
              <span>Open orders panel</span>
              <span className="group-hover:translate-x-[2px] transition-transform">
                →
              </span>
            </div>
          </Link>

          {/* Analytics (replaces Categories) */}
          <Link
            href="/admin/analytics"
            className="group rounded-3xl border border-gray-200 bg-white/95 px-5 py-5 shadow-sm flex flex-col justify-between hover:border-black hover:-translate-y-[2px] hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-gray-500">
                  Insights
                </p>
                <h2 className="mt-1 text-sm font-semibold text-gray-900">
                  Analytics
                </h2>
              </div>
              <span className="inline-flex h-7 px-3 rounded-full bg-sky-600 text-[11px] font-medium text-white items-center justify-center">
                Live
              </span>
            </div>
            <p className="mt-3 text-xs text-gray-600">
              Visualize revenue, order volume, and product performance over
              time.
            </p>
            <div className="mt-4 flex items-center gap-1 text-[11px] text-gray-900">
              <span>Open analytics</span>
              <span className="group-hover:translate-x-[2px] transition-transform">
                →
              </span>
            </div>
          </Link>
        </div>

        {/* Mini recent orders preview */}
        {!loading && orders.length > 0 && (
          <div className="mt-2 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-900">
                Latest activity
              </p>
              <Link
                href="/admin/orders"
                className="text-[11px] text-gray-600 underline underline-offset-4 hover:text-gray-900"
              >
                View all admin orders
              </Link>
            </div>
            <div className="space-y-2">
              {orders
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
                )
                .slice(0, 4)
                .map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/80 px-3 py-2.5"
                  >
                    <div>
                      <p className="text-xs font-medium text-gray-900">
                        Order #{o.id}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {o.createdAt
                          ? new Date(o.createdAt).toLocaleString()
                          : "Unknown"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gray-900">
                        ${Number(o.total || 0).toFixed(2)}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {o.status}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

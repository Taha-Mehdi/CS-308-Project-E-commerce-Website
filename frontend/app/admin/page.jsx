"use client";

import { useEffect, useMemo, useState } from "react";
import DripLink from "../../components/DripLink";
import { apiRequest, getProductsApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

function metricCardTint(kind) {
  const base =
    "rounded-[28px] border border-border bg-black/25 backdrop-blur p-5 shadow-[0_16px_60px_rgba(0,0,0,0.45)]";
  if (kind === "orders")
    return `${base} [background:radial-gradient(1200px_500px_at_20%_-20%,rgba(255,255,255,0.10),transparent_60%),rgba(0,0,0,0.25)]`;
  if (kind === "revenue")
    return `${base} [background:radial-gradient(1200px_500px_at_20%_-20%,rgba(80,200,255,0.12),transparent_60%),rgba(0,0,0,0.25)]`;
  if (kind === "catalog")
    return `${base} [background:radial-gradient(1200px_500px_at_20%_-20%,rgba(255,110,199,0.12),transparent_60%),rgba(0,0,0,0.25)]`;
  return `${base} [background:radial-gradient(1200px_500px_at_20%_-20%,rgba(132,255,99,0.10),transparent_60%),rgba(0,0,0,0.25)]`;
}

function pillBase() {
  return "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border";
}

function statusPill(tone = "neutral") {
  const base = pillBase();
  if (tone === "live")
    return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
  if (tone === "muted")
    return `${base} border-white/10 bg-white/5 text-gray-200/80`;
  if (tone === "blue")
    return `${base} border-sky-500/25 bg-sky-500/10 text-sky-200`;
  if (tone === "pink")
    return `${base} border-pink-500/25 bg-pink-500/10 text-pink-200`;
  return `${base} border-white/10 bg-white/5 text-gray-200/80`;
}

function isAdminPanelRole(user) {
  const rn = user?.roleName || user?.role || user?.role_name || "";
  return rn === "admin" || rn === "product_manager";
}

export default function AdminDashboardPage() {
  const { user, loadingUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);

  async function loadDashboard() {
    setLoading(true);
    setMessage("");

    try {
      // Orders endpoint is admin-only
      const ordersData = await apiRequest("/orders", { method: "GET", auth: true });
      setOrders(Array.isArray(ordersData) ? ordersData : []);

      // Products are public
      const productsData = await getProductsApi();
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (err) {
      console.error("Admin dashboard load error:", err);
      setMessage(err?.message || "Failed to load admin metrics.");
      setOrders([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Layout guards handle access, but keep this to avoid firing requests
    // before we know user is loaded/authorized
    if (!loadingUser && user && isAdminPanelRole(user)) {
      loadDashboard();
    } else if (!loadingUser) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingUser, user]);

  const stats = useMemo(() => {
    const totalOrders = orders.length;

    const totalRevenue = orders.reduce((sum, o) => {
      const num = Number(o.total || 0);
      return sum + (Number.isNaN(num) ? 0 : num);
    }, 0);

    const processingOrders = orders.filter((o) => o.status === "processing").length;
    const inTransitOrders = orders.filter((o) => o.status === "in_transit").length;
    const deliveredOrders = orders.filter((o) => o.status === "delivered").length;

    const totalProducts = products.length;
    const lowStockProducts = products.filter(
      (p) => typeof p.stock === "number" && p.stock > 0 && p.stock <= 5
    ).length;
    const outOfStock = products.filter(
      (p) => typeof p.stock === "number" && p.stock === 0
    ).length;

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
            Control room
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Store snapshot
          </h1>
          <p className="text-sm text-gray-300/70 max-w-2xl">
            Live snapshot of drops, orders, and stock across the store.
          </p>

          <div className="pt-2 flex flex-wrap gap-2">
            <span className={statusPill("live")}>Live</span>
            <span className={statusPill("muted")}>Admin only</span>
            <span className={statusPill("blue")}>Metrics</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadDashboard}
            className="
              h-10 px-5 inline-flex items-center justify-center rounded-full
              border border-border bg-white/5 text-[11px] font-semibold uppercase tracking-[0.18em]
              text-gray-100 hover:bg-white/10 transition active:scale-[0.98]
            "
          >
            Hard refresh
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-gray-200/80">
          {message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={metricCardTint("orders")}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/70">
              Orders
            </p>
            <span className="h-2 w-2 rounded-full bg-[var(--drip-accent)]" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-white">{stats.totalOrders}</p>
          <p className="mt-1 text-[11px] text-gray-300/60">
            {stats.processingOrders} processing · {stats.inTransitOrders} in-transit
          </p>
        </div>

        <div className={metricCardTint("revenue")}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/70">
              Revenue
            </p>
            <span className="h-2 w-2 rounded-full bg-[var(--drip-accent-2)]" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-white">
            ${stats.totalRevenue.toFixed(2)}
          </p>
          <p className="mt-1 text-[11px] text-gray-300/60">
            Delivered: {stats.deliveredOrders}
          </p>
        </div>

        <div className={metricCardTint("catalog")}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/70">
              Catalog
            </p>
            <span className="h-2 w-2 rounded-full bg-pink-400" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-white">{stats.totalProducts}</p>
          <p className="mt-1 text-[11px] text-gray-300/60">
            {stats.lowStockProducts} low stock · {stats.outOfStock} sold out
          </p>
        </div>

        <div className={metricCardTint("health")}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/70">
              Health
            </p>
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-white">
            {stats.processingOrders + stats.inTransitOrders > 0 ? "Live" : "Stable"}
          </p>
          <p className="mt-1 text-[11px] text-gray-300/60">
            Processing: {stats.processingOrders} · In-transit: {stats.inTransitOrders}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <DripLink
          href="/admin/products"
          className="
            group rounded-[28px] border border-border bg-black/20 backdrop-blur
            p-5 shadow-[0_16px_60px_rgba(0,0,0,0.40)]
            hover:bg-black/25 transition
            flex flex-col justify-between
          "
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
                Manage
              </p>
              <h2 className="mt-1 text-sm font-semibold text-white">Products</h2>
            </div>
            <span className={statusPill("muted")}>{stats.totalProducts} live</span>
          </div>
          <p className="mt-3 text-[11px] text-gray-300/60">
            Edit drops, adjust stock, and upload sneaker imagery.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100/90">
            Open <span className="opacity-70 group-hover:opacity-100">→</span>
          </div>
        </DripLink>

        <DripLink
          href="/admin/orders"
          className="
            group rounded-[28px] border border-border bg-black/20 backdrop-blur
            p-5 shadow-[0_16px_60px_rgba(0,0,0,0.40)]
            hover:bg-black/25 transition
            flex flex-col justify-between
          "
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
                Monitor
              </p>
              <h2 className="mt-1 text-sm font-semibold text-white">Orders</h2>
            </div>
            <span className={statusPill("blue")}>
              {stats.processingOrders + stats.inTransitOrders} active
            </span>
          </div>
          <p className="mt-3 text-[11px] text-gray-300/60">
            Review order flow and update statuses.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100/90">
            Open <span className="opacity-70 group-hover:opacity-100">→</span>
          </div>
        </DripLink>

        <DripLink
          href="/admin/analytics"
          className="
            group rounded-[28px] border border-border bg-black/20 backdrop-blur
            p-5 shadow-[0_16px_60px_rgba(0,0,0,0.40)]
            hover:bg-black/25 transition
            flex flex-col justify-between
          "
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
                Insights
              </p>
              <h2 className="mt-1 text-sm font-semibold text-white">Analytics</h2>
            </div>
            <span className={statusPill("pink")}>Live</span>
          </div>
          <p className="mt-3 text-[11px] text-gray-300/60">
            Visualize revenue, order volume, and product performance.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100/90">
            Open <span className="opacity-70 group-hover:opacity-100">→</span>
          </div>
        </DripLink>
      </div>

      {loading && <p className="text-[11px] text-gray-300/60">Loading metrics…</p>}
    </div>
  );
}

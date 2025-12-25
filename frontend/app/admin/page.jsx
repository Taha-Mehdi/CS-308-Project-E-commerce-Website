"use client";

import { useEffect, useMemo, useState } from "react";
import DripLink from "../../components/DripLink";
import { apiRequest, getProductsApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

/* ----------------- UI helpers ----------------- */
const cx = (...a) => a.filter(Boolean).join(" ");

function pillBase() {
  return cx(
    "inline-flex items-center justify-center",
    "rounded-full px-3 py-1",
    "text-[10px] font-semibold uppercase tracking-[0.18em]",
    "border whitespace-nowrap shrink-0"
  );
}

function statusPill(tone = "neutral") {
  const base = pillBase();
  if (tone === "live") return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
  if (tone === "muted") return `${base} border-white/10 bg-white/5 text-gray-200/80`;
  if (tone === "blue") return `${base} border-sky-500/25 bg-sky-500/10 text-sky-200`;
  if (tone === "pink") return `${base} border-pink-500/25 bg-pink-500/10 text-pink-200`;
  if (tone === "warn") return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
  if (tone === "danger") return `${base} border-rose-500/25 bg-rose-500/10 text-rose-200`;
  return `${base} border-white/10 bg-white/5 text-gray-200/80`;
}

function cardBase() {
  return "rounded-[30px] border border-border bg-black/20 backdrop-blur shadow-[0_16px_60px_rgba(0,0,0,0.45)]";
}

function panelTint(kind) {
  const base = cardBase();
  if (kind === "orders")
    return `${base} [background:radial-gradient(1200px_520px_at_18%_-20%,rgba(255,255,255,0.10),transparent_60%),rgba(0,0,0,0.25)]`;
  if (kind === "revenue")
    return `${base} [background:radial-gradient(1200px_520px_at_18%_-20%,rgba(80,200,255,0.12),transparent_60%),rgba(0,0,0,0.25)]`;
  if (kind === "catalog")
    return `${base} [background:radial-gradient(1200px_520px_at_18%_-20%,rgba(255,110,199,0.12),transparent_60%),rgba(0,0,0,0.25)]`;
  return base;
}

function money(n) {
  const num = Number(n || 0);
  if (Number.isNaN(num)) return "$0.00";
  return `$${num.toFixed(2)}`;
}

function normalizeStatus(s) {
  const v = String(s || "").toLowerCase();
  if (v === "processing") return { label: "Processing", tone: "warn" };
  if (v === "in_transit") return { label: "In transit", tone: "blue" };
  if (v === "delivered") return { label: "Delivered", tone: "live" };
  if (v) return { label: v.replaceAll("_", " "), tone: "muted" };
  return { label: "Unknown", tone: "muted" };
}

function safeDate(iso) {
  if (!iso || typeof iso !== "string") return "";
  return iso.slice(0, 10);
}

function isAdminPanelRole(user) {
  const rn = user?.roleName || user?.role || user?.role_name || "";
  return rn === "admin" || rn === "product_manager";
}

function MiniStat({ label, value, sub, pillText, pillTone = "muted" }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 min-w-0">
      {/* IMPORTANT: use flex-wrap so pill never overlaps */}
      <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-white break-words">{value}</p>
          {sub ? <p className="mt-1 text-[11px] text-gray-300/60 break-words">{sub}</p> : null}
        </div>
        {pillText ? <span className={statusPill(pillTone)}>{pillText}</span> : null}
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, desc, right }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between min-w-0">
      <div className="space-y-1 min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/70">
          {eyebrow}
        </p>
        <h2 className="text-lg sm:text-xl font-semibold text-white">{title}</h2>
        {desc ? <p className="text-[12px] text-gray-300/70">{desc}</p> : null}
      </div>
      {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
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
      const [ordersData, productsData] = await Promise.all([
        apiRequest("/orders", { method: "GET", auth: true }),
        getProductsApi(),
      ]);

      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (err) {
      console.error("Admin dashboard load error:", err);
      setMessage(err?.message || "Failed to load admin snapshot.");
      setOrders([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
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
      const num = Number(o?.total || 0);
      return sum + (Number.isNaN(num) ? 0 : num);
    }, 0);

    const processingOrders = orders.filter((o) => o?.status === "processing").length;
    const inTransitOrders = orders.filter((o) => o?.status === "in_transit").length;
    const deliveredOrders = orders.filter((o) => o?.status === "delivered").length;

    const totalProducts = products.length;
    const lowStockProducts = products.filter((p) => Number(p?.stock) > 0 && Number(p?.stock) <= 5).length;
    const outOfStock = products.filter((p) => Number(p?.stock) === 0).length;

    const activeOrders = processingOrders + inTransitOrders;

    return {
      totalOrders,
      totalRevenue,
      processingOrders,
      inTransitOrders,
      deliveredOrders,
      totalProducts,
      lowStockProducts,
      outOfStock,
      activeOrders,
    };
  }, [orders, products]);

  const recentProducts = useMemo(() => {
    const list = [...products].sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));
    return list.slice(0, 6);
  }, [products]);

  const lowStockList = useMemo(() => {
    const list = products
      .filter((p) => Number(p?.stock) > 0 && Number(p?.stock) <= 5)
      .sort((a, b) => Number(a?.stock || 0) - Number(b?.stock || 0));
    return list.slice(0, 6);
  }, [products]);

  const recentOrders = useMemo(() => {
    const list = [...orders].sort((a, b) => {
      const ta = new Date(a?.createdAt || 0).getTime();
      const tb = new Date(b?.createdAt || 0).getTime();
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return tb - ta;
      return Number(b?.id || 0) - Number(a?.id || 0);
    });
    return list.slice(0, 8);
  }, [orders]);

  const healthTone = stats.activeOrders > 0 || stats.lowStockProducts > 0 ? "warn" : "live";

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Header (no left-side analytics / sales tools buttons) */}
      <section className="relative overflow-hidden rounded-[34px] border border-border bg-surface p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_12%_20%,rgba(168,85,247,0.18),transparent_58%),radial-gradient(900px_circle_at_85%_50%,rgba(251,113,133,0.12),transparent_64%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/14 via-transparent to-black/18" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between min-w-0">
          <div className="space-y-2 min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Control room
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Store snapshot
            </h1>
            <p className="text-sm text-gray-300/70 max-w-2xl">
              Products + orders in one place — responsive, no overlap.
            </p>

            <div className="pt-2 flex flex-wrap gap-2">
              <span className={statusPill("live")}>Live</span>
              <span className={statusPill("muted")}>Admin only</span>
              <span className={statusPill("blue")}>Ops</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
      </section>

      {message && (
        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-gray-200/80">
          {message}
        </div>
      )}

      {/* KPI row */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <div className={cx(panelTint("revenue"), "p-5 min-w-0")}>
          <div className="flex items-center justify-between gap-3 min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/70">
              Revenue
            </p>
            <span className="h-2 w-2 rounded-full bg-[var(--drip-accent-2)] shrink-0" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-white break-words">{money(stats.totalRevenue)}</p>
          <p className="mt-1 text-[11px] text-gray-300/60 break-words">
            Delivered: {stats.deliveredOrders} · Total: {stats.totalOrders}
          </p>
        </div>

        <div className={cx(panelTint("orders"), "p-5 min-w-0")}>
          <div className="flex items-center justify-between gap-3 min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/70">
              Active orders
            </p>
            <span className="h-2 w-2 rounded-full bg-[var(--drip-accent)] shrink-0" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-white break-words">{stats.activeOrders}</p>
          <p className="mt-1 text-[11px] text-gray-300/60 break-words">
            {stats.processingOrders} processing · {stats.inTransitOrders} in-transit
          </p>
        </div>

        <div className={cx(panelTint("catalog"), "p-5 min-w-0")}>
          <div className="flex items-center justify-between gap-3 min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/70">
              Catalog
            </p>
            <span className="h-2 w-2 rounded-full bg-pink-400 shrink-0" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-white break-words">{stats.totalProducts}</p>
          <p className="mt-1 text-[11px] text-gray-300/60 break-words">
            {stats.lowStockProducts} low stock · {stats.outOfStock} sold out
          </p>
        </div>
      </div>

      {/* Products row */}
      <section className={cx(cardBase(), "p-5 sm:p-6 min-w-0")}>
        <SectionHeader
          eyebrow="Products"
          title="Inventory overview"
          desc="Quick actions + what needs attention right now."
          right={
            <>
              <DripLink
                href="/admin/products"
                className="h-10 inline-flex items-center justify-center rounded-full border border-border bg-white/5 px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100 hover:bg-white/10 transition"
              >
                Manage products →
              </DripLink>
              <span className={statusPill(stats.outOfStock > 0 ? "danger" : "muted")}>
                {stats.outOfStock} sold out
              </span>
              <span className={statusPill(stats.lowStockProducts > 0 ? "warn" : "muted")}>
                {stats.lowStockProducts} low stock
              </span>
            </>
          }
        />

        <div className="mt-5 grid gap-4 grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] min-w-0">
          {/* Left */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 min-w-0">
            <MiniStat
              label="Live products"
              value={stats.totalProducts}
              sub={`${stats.lowStockProducts} low stock · ${stats.outOfStock} sold out`}
              pillText={stats.outOfStock > 0 ? "Attention" : "Healthy"}
              pillTone={stats.outOfStock > 0 ? "danger" : stats.lowStockProducts > 0 ? "warn" : "live"}
            />

            <MiniStat
              label="Inventory health"
              value={stats.lowStockProducts + stats.outOfStock > 0 ? "Needs attention" : "Stable"}
              sub={
                stats.lowStockProducts + stats.outOfStock > 0
                  ? "Restock recommended for flagged items"
                  : "No immediate restock flags"
              }
              pillText={stats.lowStockProducts + stats.outOfStock > 0 ? "Monitor" : "Live"}
              pillTone={stats.lowStockProducts + stats.outOfStock > 0 ? "warn" : "live"}
            />

            <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 sm:col-span-2 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
                  Low stock list
                </p>
                <span className={statusPill(lowStockList.length ? "warn" : "live")}>
                  {lowStockList.length ? "Needs restock" : "All good"}
                </span>
              </div>

              {lowStockList.length === 0 ? (
                <p className="mt-3 text-[12px] text-gray-200/70">No low-stock items 🎉</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {lowStockList.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 min-w-0"
                    >
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-white truncate">{p.name}</p>
                        <p className="text-[11px] text-gray-300/60">ID #{p.id}</p>
                      </div>
                      <span className={statusPill(Number(p.stock) === 0 ? "danger" : "warn")}>
                        {Number(p.stock) === 0 ? "sold out" : `${p.stock} left`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right */}
          <div className="rounded-[26px] border border-white/10 bg-black/15 p-4 sm:p-5 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
                Recent products
              </p>
              <span className={statusPill("muted")}>{recentProducts.length} shown</span>
            </div>

            <div className="mt-4 grid gap-2">
              {recentProducts.map((p) => (
                <div
                  key={p.id}
                  className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 hover:bg-white/[0.06] transition min-w-0"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-white truncate">{p.name}</p>
                    <p className="mt-0.5 text-[11px] text-gray-300/60 break-words">
                      ID #{p.id} · {money(p.price)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                    <span
                      className={statusPill(
                        Number(p.stock) === 0 ? "danger" : Number(p.stock) <= 5 ? "warn" : "live"
                      )}
                    >
                      {Number(p.stock) === 0 ? "sold out" : `${p.stock} in stock`}
                    </span>
                    <span className="text-white/70 group-hover:text-white transition">→</span>
                  </div>
                </div>
              ))}

              {recentProducts.length === 0 && (
                <p className="text-[12px] text-gray-200/70">No products yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Orders row */}
      <section className={cx(cardBase(), "p-5 sm:p-6 min-w-0")}>
        <SectionHeader
          eyebrow="Orders"
          title="Fulfillment pipeline"
          desc="See what’s moving, what’s pending, and what’s delivered."
          right={
            <>
              <DripLink
                href="/admin/orders"
                className="h-10 inline-flex items-center justify-center rounded-full border border-border bg-white/5 px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100 hover:bg-white/10 transition"
              >
                Manage orders →
              </DripLink>
              <span className={statusPill(healthTone)}>{stats.activeOrders > 0 ? "In motion" : "Stable"}</span>
            </>
          }
        />

        <div className="mt-5 grid gap-4 grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] min-w-0">
          {/* Left */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 min-w-0">
            <MiniStat
              label="Total orders"
              value={stats.totalOrders}
              sub={`${stats.deliveredOrders} delivered`}
              pillText={stats.totalOrders > 0 ? "Live" : "Empty"}
              pillTone={stats.totalOrders > 0 ? "blue" : "muted"}
            />
            <MiniStat
              label="Active"
              value={stats.activeOrders}
              sub={`${stats.processingOrders} processing · ${stats.inTransitOrders} in transit`}
              pillText={stats.activeOrders > 0 ? "Monitor" : "Stable"}
              pillTone={stats.activeOrders > 0 ? "warn" : "live"}
            />

            <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 sm:col-span-2 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
                  Revenue snapshot
                </p>
                <span className={statusPill("live")}>Live</span>
              </div>
              <div className="mt-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="text-3xl font-semibold text-white break-words">{money(stats.totalRevenue)}</p>
                  <p className="mt-1 text-[11px] text-gray-300/60">From all orders</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="rounded-[26px] border border-white/10 bg-black/15 p-4 sm:p-5 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
                Recent orders
              </p>
              <span className={statusPill("muted")}>{recentOrders.length} shown</span>
            </div>

            <div className="mt-4 grid gap-2">
              {recentOrders.map((o) => {
                const s = normalizeStatus(o?.status);
                return (
                  <div
                    key={o.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 min-w-0"
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-white break-words">
                        Order #{o.id}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-300/60 break-words">
                        {safeDate(o.createdAt)} · Total {money(o.total)}
                      </p>
                    </div>

                    {/* IMPORTANT: flex-wrap + shrink-0 so it never overlaps */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                      <span className={statusPill(s.tone)}>{s.label}</span>
                    </div>
                  </div>
                );
              })}

              {recentOrders.length === 0 && (
                <p className="text-[12px] text-gray-200/70">No orders yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {loading && <p className="text-[11px] text-gray-300/60">Loading metrics…</p>}
    </div>
  );
}

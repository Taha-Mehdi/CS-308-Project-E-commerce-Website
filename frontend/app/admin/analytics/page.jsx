"use client";

import { useEffect, useMemo, useState } from "react";
import SiteLayout from "../../../components/SiteLayout";
import DripLink from "../../../components/DripLink";
import { useAuth } from "../../../context/AuthContext";
import { calculateAnalytics } from "../../../lib/analytics";

// Recharts
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

function panelClass() {
  return "rounded-[28px] border border-border bg-black/25 backdrop-blur p-5 shadow-[0_16px_60px_rgba(0,0,0,0.45)]";
}

function metricCard(tint = "neutral") {
  const base =
    "rounded-[26px] border border-border bg-black/20 backdrop-blur p-4 shadow-[0_16px_60px_rgba(0,0,0,0.40)]";
  if (tint === "amber")
    return `${base} [background:radial-gradient(1200px_500px_at_15%_-20%,rgba(255,200,60,0.12),transparent_60%),rgba(0,0,0,0.22)]`;
  if (tint === "blue")
    return `${base} [background:radial-gradient(1200px_500px_at_15%_-20%,rgba(80,200,255,0.12),transparent_60%),rgba(0,0,0,0.22)]`;
  if (tint === "green")
    return `${base} [background:radial-gradient(1200px_500px_at_15%_-20%,rgba(90,255,170,0.10),transparent_60%),rgba(0,0,0,0.22)]`;
  if (tint === "red")
    return `${base} [background:radial-gradient(1200px_500px_at_15%_-20%,rgba(255,110,110,0.10),transparent_60%),rgba(0,0,0,0.22)]`;
  return `${base} [background:radial-gradient(1200px_500px_at_15%_-20%,rgba(255,255,255,0.08),transparent_60%),rgba(0,0,0,0.22)]`;
}

function formatStatusLabel(status) {
  switch (status) {
    case "processing":
      return "processing";
    case "in_transit":
      return "in-transit";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
    case "paid":
      return "paid";
    case "pending":
      return "pending";
    case "shipped":
      return "shipped";
    default:
      return status || "unknown";
  }
}

export default function AdminAnalyticsPage() {
  const { user, loadingUser } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function safeJson(res) {
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  // FETCH ORDERS (Admin)
  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      setMessage("");

      try {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;

        if (!token) {
          setOrders([]);
          setMessage("Please login as admin to view analytics.");
          setLoading(false);
          return;
        }

        const res = await fetch(`${apiBase}/orders`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const json = await safeJson(res);
          setMessage(json?.message || "Failed to load analytics.");
          setOrders([]);
          setLoading(false);
          return;
        }

        const data = await safeJson(res);
        if (!Array.isArray(data)) {
          setMessage("Analytics format invalid.");
          setOrders([]);
          setLoading(false);
          return;
        }

        setOrders(data);
      } catch (err) {
        console.error("Analytics load error:", err);
        setMessage("Failed to load analytics.");
        setOrders([]);
      } finally {
        setLoading(false);
      }
    }

    if (!loadingUser && user?.roleId === 1) loadAnalytics();
    else if (!loadingUser) setLoading(false);
  }, [loadingUser, user]);

  // ---------------- DATA PROCESSING ----------------
  const analytics = useMemo(() => calculateAnalytics(orders), [orders]);

  // Build status chart data dynamically from whatever statuses exist
  const statusChartData = useMemo(() => {
    const entries = Object.entries(analytics.statusCounts || {});
    if (entries.length === 0) return [];

    const priorityOrder = [
      "processing",
      "in_transit",
      "delivered",
      "cancelled",
      "paid",
      "pending",
      "shipped",
    ];

    const sortKey = (status) => {
      const idx = priorityOrder.indexOf(status);
      return idx === -1 ? 999 : idx;
    };

    const sorted = entries.sort(
      ([aStatus], [bStatus]) => sortKey(aStatus) - sortKey(bStatus)
    );

    return sorted.map(([status, count]) => ({
      statusLabel: formatStatusLabel(status),
      rawStatus: status,
      count: count || 0,
    }));
  }, [analytics.statusCounts]);

  // -------- AUTH GATES --------
  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-300/70">Checking admin access…</p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-6 py-6">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Admin
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Analytics dashboard
            </h1>
            <p className="text-sm text-gray-300/70 max-w-md">
              Please login as admin to view analytics.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <DripLink
              href="/login"
              className="
                h-10 px-5 inline-flex items-center justify-center rounded-full
                bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                text-black text-[11px] font-semibold uppercase tracking-[0.18em]
                hover:opacity-95 transition active:scale-[0.98]
              "
            >
              Login
            </DripLink>
            <DripLink
              href="/"
              className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white self-center"
            >
              Back to homepage
            </DripLink>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (user.roleId !== 1) {
    return (
      <SiteLayout>
        <div className="space-y-4 py-6">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Admin
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Analytics dashboard
            </h1>
            <p className="text-sm text-gray-300/70">
              Your account does not have admin permissions.
            </p>
          </div>

          <DripLink
            href="/"
            className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
          >
            Back to homepage
          </DripLink>
        </div>
      </SiteLayout>
    );
  }

  // ---------------- UI START ----------------
  return (
    <SiteLayout>
      <div className="space-y-6 py-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Sneaks-up · Admin
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Analytics dashboard
            </h1>
            <p className="text-sm text-gray-300/70 max-w-2xl">
              A live visual view of store performance and order movement.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <DripLink
              href="/admin/orders"
              className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
            >
              Manage orders
            </DripLink>
            <DripLink
              href="/admin"
              className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
            >
              Back to admin dashboard
            </DripLink>
          </div>
        </div>

        {/* MESSAGE */}
        {message && (
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-gray-200/80">
            {message}
          </div>
        )}

        {/* METRICS */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={metricCard("green")}>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Total revenue
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              ${Number(analytics.totalRevenue || 0).toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-gray-300/55">
              Excludes cancelled orders
            </p>
          </div>

          <div className={metricCard("neutral")}>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Orders
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {Number(analytics.orderCount || 0)}
            </p>
            <p className="mt-1 text-[11px] text-gray-300/55">Total orders</p>
          </div>

          <div className={metricCard("blue")}>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Avg order value
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              ${Number(analytics.avgOrderValue || 0).toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-gray-300/55">
              Based on all orders
            </p>
          </div>
        </div>

        {/* SECONDARY METRICS */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className={metricCard("neutral")}>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Recent 7d revenue
            </p>
            <p className="mt-2 text-xl font-semibold text-white">
              ${Number(analytics.recentRevenue || 0).toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-gray-300/55">
              Sum of the last 7 days
            </p>
          </div>

          <div className={metricCard("green")}>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Completion rate
            </p>
            <p className="mt-2 text-xl font-semibold text-white">
              {Number(analytics.completionRate || 0).toFixed(0)}%
            </p>
            <p className="mt-1 text-[11px] text-gray-300/55">
              Share of non-cancelled orders
            </p>
          </div>

          <div className={metricCard("blue")}>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Avg revenue/day
            </p>
            <p className="mt-2 text-xl font-semibold text-white">
              ${Number(analytics.avgPerDay || 0).toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-gray-300/55">
              Across revenue days
            </p>
          </div>

          <div className={metricCard("amber")}>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Top day
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {analytics.topDay?.date || "–"}
            </p>
            <p className="mt-1 text-[11px] text-gray-300/55">
              {analytics.topDay
                ? `$${Number(analytics.topDay.revenue || 0).toFixed(2)}`
                : "No revenue yet"}
            </p>
          </div>
        </div>

        {/* CHARTS */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* REVENUE LINE CHART */}
          <div className={`${panelClass()} lg:col-span-2`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Revenue over time
                </h2>
                <p className="text-[11px] text-gray-300/55">
                  Based on real backend order data
                </p>
              </div>

              <span className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border border-white/10 bg-white/5 text-gray-200/80">
                {analytics.revenueByDay?.length || 0} points
              </span>
            </div>

            <div className="mt-4 h-72">
              {loading ? (
                <div className="flex items-center justify-center h-full text-xs text-gray-300/60">
                  Loading chart…
                </div>
              ) : !analytics.revenueByDay || analytics.revenueByDay.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-gray-300/60">
                  Not enough data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.revenueByDay}>
                    <CartesianGrid strokeDasharray="4 4" opacity={0.12} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickMargin={8} />
                    <YAxis tick={{ fontSize: 10 }} tickMargin={4} width={52} />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        background: "rgba(0,0,0,0.9)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 12,
                        color: "white",
                      }}
                      formatter={(val) => [`$${val}`, "Revenue"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="rgba(255,255,255,0.95)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* STATUS BAR CHART */}
          <div className={panelClass()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Orders by status
                </h2>
                <p className="text-[11px] text-gray-300/55">
                  Distribution across pipeline
                </p>
              </div>
            </div>

            <div className="mt-4 h-72">
              {loading ? (
                <div className="flex items-center justify-center h-full text-xs text-gray-300/60">
                  Loading chart…
                </div>
              ) : statusChartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-gray-300/60">
                  Not enough data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData}>
                    <CartesianGrid strokeDasharray="4 4" opacity={0.12} />
                    <XAxis
                      dataKey="statusLabel"
                      tick={{ fontSize: 10 }}
                      tickMargin={10}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickMargin={4}
                      allowDecimals={false}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        background: "rgba(0,0,0,0.9)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 12,
                        color: "white",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, color: "white" }} />
                    <Bar
                      dataKey="count"
                      fill="rgba(255,255,255,0.9)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* FOOTNOTE */}
        <div className="text-[11px] text-gray-300/55">
          Analytics are computed from{" "}
          <code className="px-1 py-0.5 bg-white/5 border border-white/10 rounded text-[10px]">
            /orders
          </code>{" "}
          (admin route). Update statuses in{" "}
          <DripLink href="/admin/orders" className="underline underline-offset-4">
            Admin → Orders
          </DripLink>{" "}
          to see charts react.
        </div>
      </div>
    </SiteLayout>
  );
}

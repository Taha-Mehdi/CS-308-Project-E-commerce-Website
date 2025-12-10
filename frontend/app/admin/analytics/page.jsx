"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../../components/SiteLayout";
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
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // FETCH ORDERS (Admin)
  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      setMessage("");

      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("token")
            : null;

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
          let msg = "Failed to load analytics.";
          try {
            const ct = res.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              const json = await res.json();
              if (json?.message) msg = json.message;
            }
          } catch {
            // ignore
          }

          setMessage(msg);
          setOrders([]);
          setLoading(false);
          return;
        }

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          setMessage("Unexpected response.");
          setOrders([]);
          setLoading(false);
          return;
        }

        const data = await res.json();
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
  }, [apiBase, loadingUser, user]);

  // ---------------- DATA PROCESSING ----------------
  const analytics = useMemo(() => calculateAnalytics(orders), [orders]);

  // Build status chart data dynamically from whatever statuses exist
  const statusChartData = useMemo(() => {
    const entries = Object.entries(analytics.statusCounts || {});

    if (entries.length === 0) return [];

    // Sort so the main shipping pipeline appears first
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
        <p className="text-sm text-gray-500">Checking admin access…</p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">Admin · Analytics</h1>
          <p className="text-sm text-gray-600">Please login as admin.</p>
          <Link href="/login" className="underline text-sm">
            Login →
          </Link>
        </div>
      </SiteLayout>
    );
  }

  if (user.roleId !== 1) {
    return (
      <SiteLayout>
        <h1 className="text-xl font-semibold">No Admin Access</h1>
      </SiteLayout>
    );
  }

  // ---------------- UI START ----------------

  return (
    <SiteLayout>
      <div className="space-y-8">
        {/* HEADER */}
        <div>
          <p className="text-[11px] font-semibold tracking-[0.25em] text-gray-500 uppercase">
            Sneaks-up Admin
          </p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Analytics Dashboard
          </h1>
          <p className="text-sm text-gray-500">
            A live visual view of store performance & sneaker movement.
          </p>
        </div>

        {/* MESSAGE */}
        {message && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-2 text-sm">
            {message}
          </div>
        )}

        {/* METRIC TILES */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl p-5 bg-white shadow-sm border border-gray-200 flex flex-col gap-1">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              Total Revenue
            </p>
            <p className="text-3xl font-semibold text-gray-900">
              ${analytics.totalRevenue.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">
              Excludes cancelled orders
            </p>
          </div>

          <div className="rounded-2xl p-5 bg-white shadow-sm border border-gray-200 flex flex-col gap-1">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              Orders
            </p>
            <p className="text-3xl font-semibold text-gray-900">
              {analytics.orderCount}
            </p>
            <p className="text-xs text-gray-500">Total orders</p>
          </div>

          <div className="rounded-2xl p-5 bg-white shadow-sm border border-gray-200 flex flex-col gap-1">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              Avg Order Value
            </p>
            <p className="text-3xl font-semibold text-gray-900">
              ${analytics.avgOrderValue.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">Based on all orders</p>
          </div>
        </div>

        {/* SECONDARY METRICS */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl p-4 bg-white border border-gray-200 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              Recent 7d Revenue
            </p>
            <p className="text-2xl font-semibold text-gray-900">
              ${analytics.recentRevenue.toFixed(2)}
            </p>
            <p className="text-[11px] text-gray-500">
              Sum of the last 7 days
            </p>
          </div>
          <div className="rounded-2xl p-4 bg-white border border-gray-200 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              Completion rate
            </p>
            <p className="text-2xl font-semibold text-emerald-700">
              {analytics.completionRate.toFixed(0)}%
            </p>
            <p className="text-[11px] text-gray-500">
              Share of non-cancelled orders
            </p>
          </div>
          <div className="rounded-2xl p-4 bg-white border border-gray-200 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              Avg revenue / day
            </p>
            <p className="text-2xl font-semibold text-gray-900">
              ${analytics.avgPerDay.toFixed(2)}
            </p>
            <p className="text-[11px] text-gray-500">Across revenue days</p>
          </div>
          <div className="rounded-2xl p-4 bg-white border border-gray-200 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              Top day
            </p>
            <p className="text-lg font-semibold text-gray-900">
              {analytics.topDay?.date || "–"}
            </p>
            <p className="text-[11px] text-gray-500">
              {analytics.topDay
                ? `$${analytics.topDay.revenue.toFixed(2)}`
                : "No revenue yet"}
            </p>
          </div>
        </div>

        {/* CHARTS */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* REVENUE LINE CHART */}
          <div className="lg:col-span-2 rounded-3xl bg-white shadow border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900">
              Revenue Over Time
            </h2>
            <p className="text-[11px] text-gray-500 mb-4">
              Based on real backend order data
            </p>

            <div className="h-72">
              {analytics.revenueByDay.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-gray-500">
                  Not enough data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.revenueByDay}>
                    <CartesianGrid strokeDasharray="4 4" opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickMargin={8}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickMargin={4}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(val) => [`$${val}`, "Revenue"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#111"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* STATUS BAR CHART */}
          <div className="rounded-3xl bg-white shadow border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900">
              Orders by Status
            </h2>
            <p className="text-[11px] text-gray-500 mb-4">
              Visual distribution of your order pipeline
            </p>

            <div className="h-72">
              {statusChartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-gray-500">
                  Not enough data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData}>
                    <CartesianGrid strokeDasharray="4 4" opacity={0.3} />
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
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="count" fill="#111" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* FOOTNOTE */}
        <div className="text-[11px] text-gray-500">
          Analytics are computed from{" "}
          <code className="px-1 py-0.5 bg-gray-100 border rounded text-[10px]">
            /orders
          </code>{" "}
          (admin route). Update order statuses in{" "}
          <Link href="/admin/orders" className="underline">
            Admin → Orders
          </Link>{" "}
          to see charts react.
        </div>
      </div>
    </SiteLayout>
  );
}

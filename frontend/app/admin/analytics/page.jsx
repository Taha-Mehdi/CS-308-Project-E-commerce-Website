"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../../components/SiteLayout";
import { useAuth } from "../../../context/AuthContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export default function AdminAnalyticsPage() {
  const { user, loadingUser } = useAuth();

  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [message, setMessage] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    async function loadAnalyticsData() {
      if (!user || user.roleId !== 1) return;

      setLoadingData(true);
      setMessage("");

      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("token")
            : null;

        if (!token) {
          setOrders([]);
          setItems([]);
          setProducts([]);
          setLoadingData(false);
          return;
        }

        // 1) Orders (all)
        try {
          const oRes = await fetch(`${apiBase}/orders`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (oRes.ok) {
            const ct = oRes.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              let odata = null;
              try {
                odata = await oRes.json();
              } catch {
                odata = null;
              }

              if (Array.isArray(odata)) {
                setOrders(odata);
                setItems([]);
              } else if (odata && typeof odata === "object") {
                setOrders(Array.isArray(odata.orders) ? odata.orders : []);
                setItems(Array.isArray(odata.items) ? odata.items : []);
              } else {
                setOrders([]);
                setItems([]);
              }
            } else {
              setOrders([]);
              setItems([]);
            }
          } else {
            setOrders([]);
            setItems([]);
          }
        } catch (err) {
          console.error("Analytics orders load error:", err);
          setOrders([]);
          setItems([]);
        }

        // 2) Products
        try {
          const pRes = await fetch(`${apiBase}/products`);
          if (pRes.ok) {
            const ct2 = pRes.headers.get("content-type") || "";
            if (ct2.includes("application/json")) {
              const pData = await pRes.json();
              setProducts(Array.isArray(pData) ? pData : []);
            } else {
              setProducts([]);
            }
          } else {
            setProducts([]);
          }
        } catch {
          setProducts([]);
        }
      } catch (err) {
        console.error("Analytics load error:", err);
        setOrders([]);
        setItems([]);
        setProducts([]);
        setMessage("Failed to load analytics data.");
      } finally {
        setLoadingData(false);
      }
    }

    if (!loadingUser && user && user.roleId === 1) {
      loadAnalyticsData();
    }
  }, [apiBase, loadingUser, user]);

  const productsMap = useMemo(() => {
    const m = new Map();
    for (const p of products) {
      m.set(p.id, p);
    }
    return m;
  }, [products]);

  // ---------- METRICS ----------
  const totalRevenue = useMemo(() => {
    return orders.reduce((sum, order) => {
      const t = Number(order.total || 0);
      if (Number.isNaN(t)) return sum;
      return sum + t;
    }, 0);
  }, [orders]);

  const totalOrders = useMemo(() => orders.length, [orders]);

  const avgOrderValue = useMemo(() => {
    if (!totalOrders) return 0;
    return totalRevenue / totalOrders;
  }, [totalRevenue, totalOrders]);

  // Revenue per date
  const revenueByDate = useMemo(() => {
    const map = new Map();
    for (const order of orders) {
      const created = order.createdAt || order.created_at;
      if (!created) continue;
      const d = new Date(created);
      if (Number.isNaN(d.getTime())) continue;
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD

      const current = map.get(key) || { date: key, revenue: 0, orders: 0 };
      const amount = Number(order.total || 0) || 0;
      current.revenue += amount;
      current.orders += 1;
      map.set(key, current);
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => (a.date < b.date ? -1 : 1));
    return arr;
  }, [orders]);

  // Top products
  const topProducts = useMemo(() => {
    const revenueMap = new Map();

    for (const item of items) {
      const p = productsMap.get(item.productId);
      const name =
        p?.name || item.productName || `Product #${item.productId}`;
      const unitPrice = Number(
        item.unitPrice ?? item.price ?? p?.price ?? 0
      );
      const lineRevenue = unitPrice * (item.quantity || 0);

      const current = revenueMap.get(item.productId) || {
        productId: item.productId,
        name,
        revenue: 0,
      };
      current.revenue += lineRevenue;
      revenueMap.set(item.productId, current);
    }

    const arr = Array.from(revenueMap.values());
    arr.sort((a, b) => b.revenue - a.revenue);
    return arr.slice(0, 5);
  }, [items, productsMap]);

  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-500">
          Checking your admin access…
        </p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-4">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
            Admin · Analytics
          </h1>
          <p className="text-sm text-gray-600">
            You need to be logged in as an admin to view analytics.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login?next=/admin/analytics"
              className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/"
              className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium uppercase tracking-[0.18em] text-gray-800 hover:bg-gray-100 transition-colors"
            >
              Back to home
            </Link>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (user.roleId !== 1) {
    return (
      <SiteLayout>
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
            Admin · Analytics
          </h1>
          <p className="text-sm text-gray-600">
            Your account does not have admin permissions.
          </p>
          <Link
            href="/"
            className="inline-flex text-[11px] text-gray-700 underline underline-offset-4 mt-2"
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
        {/* HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
              SNEAKS-UP · Admin
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
              Analytics
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              High-level view of orders, revenue, and top-performing drops.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-[11px] text-gray-700 underline underline-offset-4 hover:text-black"
          >
            Back to dashboard
          </Link>
        </header>

        {message && (
          <p className="text-xs text-red-600">{message}</p>
        )}

        {/* KPIs */}
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                Total revenue
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                ${totalRevenue.toFixed(2)}
              </p>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              Sum of all order totals in the system.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                Orders
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {totalOrders}
              </p>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              Total number of orders placed.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                Avg. order value
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                ${avgOrderValue.toFixed(2)}
              </p>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              Average value per order.
            </p>
          </div>
        </section>

        {/* CHARTS GRID */}
        <section className="grid gap-4 lg:grid-cols-2">
          {/* Revenue over time */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col gap-3 min-h-[260px]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                  Revenue
                </p>
                <h2 className="text-sm font-semibold text-gray-900">
                  Revenue over time
                </h2>
              </div>
            </div>
            {loadingData ? (
              <p className="text-xs text-gray-500 pt-4">
                Loading chart…
              </p>
            ) : revenueByDate.length === 0 ? (
              <p className="text-xs text-gray-500 pt-4">
                No enough order data to display revenue over time.
              </p>
            ) : (
              <div className="flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueByDate}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      stroke="#6b7280"
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="#6b7280"
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 11,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#111827"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top products */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col gap-3 min-h-[260px]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                  Drops
                </p>
                <h2 className="text-sm font-semibold text-gray-900">
                  Top products by revenue
                </h2>
              </div>
            </div>
            {loadingData ? (
              <p className="text-xs text-gray-500 pt-4">
                Loading chart…
              </p>
            ) : topProducts.length === 0 ? (
              <p className="text-xs text-gray-500 pt-4">
                Not enough order item data to calculate top products.
              </p>
            ) : (
              <div className="flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e7eb"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      stroke="#6b7280"
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="#6b7280"
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 11,
                      }}
                    />
                    <Bar dataKey="revenue" fill="#111827" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        {/* FOOTNOTE */}
        <p className="text-[11px] text-gray-400 pt-1">
          All analytics are computed on the client from orders & order
          items retrieved via the Node / Express / Neon backend.
        </p>
      </div>
    </SiteLayout>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../../components/SiteLayout";
import { useAuth } from "../../../context/AuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

export default function AdminAnalyticsPage() {
  const { user, loadingUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [message, setMessage] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    async function loadOrders() {
      setLoadingOrders(true);
      setMessage("");

      try {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;

        if (!token) {
          setOrders([]);
          setLoadingOrders(false);
          return;
        }

        const res = await fetch(`${apiBase}/orders`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setMessage(data.message || "Failed to load orders.");
          setOrders([]);
        } else {
          const data = await res.json();
          setOrders(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Admin analytics load orders error:", err);
        setMessage("Failed to load orders.");
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    }

    if (!loadingUser && user && user.roleId === 1) {
      loadOrders();
    } else if (!loadingUser) {
      setLoadingOrders(false);
    }
  }, [apiBase, loadingUser, user]);

  // Aggregate: orders by status
  const ordersByStatus = useMemo(() => {
    const counts = new Map();
    for (const o of orders) {
      const key = o.status || "unknown";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([status, count]) => ({
      status,
      count,
    }));
  }, [orders]);

  // Aggregate: revenue by day (YYYY-MM-DD)
  const revenueByDay = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      if (!o.createdAt) continue;
      const d = new Date(o.createdAt);
      const day = d.toISOString().slice(0, 10); // YYYY-MM-DD
      const amount = Number(o.total || 0);
      map.set(day, (map.get(day) || 0) + amount);
    }
    // sort by date
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, total]) => ({
        date,
        total: Number(total.toFixed(2)),
      }));
  }, [orders]);

  // Auth loading
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
        <div className="space-y-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Admin · Analytics
          </h1>
          <p className="text-sm text-gray-600">
            You need to be logged in as an admin to view this page.
          </p>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-900 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium text-gray-800 hover:bg-gray-100 transition-colors"
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
          <h1 className="text-xl font-semibold tracking-tight">
            Admin · Analytics
          </h1>
          <p className="text-sm text-gray-600">
            Your account does not have admin permissions.
          </p>
        </div>
      </SiteLayout>
    );
  }

  // Admin view
  return (
    <SiteLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Admin · Analytics
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Simple charts based on current orders.
            </p>
          </div>
          <div className="flex gap-3 text-[11px]">
            <Link
              href="/admin"
              className="text-gray-700 underline underline-offset-4"
            >
              Admin dashboard
            </Link>
            <Link
              href="/admin/products"
              className="text-gray-700 underline underline-offset-4"
            >
              Manage products
            </Link>
          </div>
        </div>

        {message && (
          <p className="text-xs text-gray-700">{message}</p>
        )}

        {loadingOrders ? (
          <p className="text-sm text-gray-500">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-gray-500">
            No orders yet. Charts will appear once you have some data.
          </p>
        ) : (
          <div className="space-y-6">
            {/* Orders by status */}
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">
                  Orders by status
                </h2>
                <p className="text-[11px] text-gray-500">
                  Total orders: {orders.length}
                </p>
              </div>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ordersByStatus}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Revenue by day */}
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">
                  Revenue by day
                </h2>
                <p className="text-[11px] text-gray-500">
                  Total revenue: $
                  {orders
                    .reduce(
                      (sum, o) => sum + Number(o.total || 0),
                      0
                    )
                    .toFixed(2)}
                </p>
              </div>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="total"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

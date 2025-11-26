"use client";

import { useEffect, useState } from "react";
import SiteLayout from "../../components/SiteLayout";
import { useAuth } from "../../context/AuthContext";
import Link from "next/link";

const STATUS_OPTIONS = ["pending", "paid", "shipped", "delivered", "cancelled"];

export default function AdminPage() {
  const { user, loadingUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [savingStatusId, setSavingStatusId] = useState(null);
  const [message, setMessage] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

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
      console.error("Admin load orders error:", err);
      setMessage("Failed to load orders.");
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }

  useEffect(() => {
    if (!loadingUser && user && user.roleId === 1) {
      loadOrders();
    } else if (!loadingUser) {
      setLoadingOrders(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingUser, user]);

  async function handleStatusChange(orderId, newStatus) {
    try {
      setSavingStatusId(orderId);
      setMessage("");

      const token = localStorage.getItem("token");
      if (!token) {
        setMessage("Please login as admin.");
        return;
      }

      const res = await fetch(`${apiBase}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Failed to update order status.");
      } else {
        setMessage(`Order #${orderId} status updated to "${newStatus}".`);
        await loadOrders();
      }
    } catch (err) {
      console.error("Update order status error:", err);
      setMessage("Failed to update order status.");
    } finally {
      setSavingStatusId(null);
    }
  }

  // Loading auth
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
            Admin Dashboard
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
            Admin Dashboard
          </h1>
          <p className="text-sm text-gray-600">
            Your account does not have admin permissions.
          </p>
          <p className="text-xs text-gray-500">
            This page is only accessible to users with roleId = 1 (admin).
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
              Admin Dashboard
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Manage orders and update their status.
            </p>
          </div>
          <Link
            href="/products"
            className="text-[11px] text-gray-700 underline underline-offset-4"
          >
            View store
          </Link>
        </div>

        {message && (
          <p className="text-xs text-gray-700">{message}</p>
        )}

        {loadingOrders ? (
          <p className="text-sm text-gray-500">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-gray-500">
            No orders yet.
          </p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const date = order.createdAt
                ? new Date(order.createdAt)
                : null;

              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-900">
                      Order #{order.id}
                    </p>
                    <p className="text-xs text-gray-500">
                      User ID: {order.userId}
                    </p>
                    <p className="text-xs text-gray-500">
                      {date ? date.toLocaleString() : "Unknown date"}
                    </p>
                    <p className="text-xs font-semibold text-gray-900">
                      Total: ${Number(order.total || 0).toFixed(2)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2 min-w-[160px]">
                    <span className="text-[11px] text-gray-500 uppercase tracking-[0.18em]">
                      Status
                    </span>
                    <select
                      value={order.status}
                      onChange={(e) =>
                        handleStatusChange(order.id, e.target.value)
                      }
                      disabled={savingStatusId === order.id}
                      className="w-full border border-gray-300 rounded-full px-3 py-1.5 text-[11px] text-gray-800 bg-white focus:outline-none focus:ring focus:ring-gray-300"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

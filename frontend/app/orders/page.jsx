"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../components/SiteLayout";
import { useAuth } from "../../context/AuthContext";

export default function OrdersPage() {
  const { user, loadingUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
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
          setItems([]);
          setLoadingOrders(false);
          return;
        }

        const res = await fetch(`${apiBase}/orders/my`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (Array.isArray(data)) {
          // case when backend returns [] if no orders
          setOrders([]);
          setItems([]);
        } else {
          setOrders(Array.isArray(data.orders) ? data.orders : []);
          setItems(Array.isArray(data.items) ? data.items : []);
        }
      } catch (err) {
        console.error("Failed to load orders:", err);
        setMessage("Failed to load orders.");
        setOrders([]);
        setItems([]);
      } finally {
        setLoadingOrders(false);
      }
    }

    if (!loadingUser && user) {
      loadOrders();
    } else if (!loadingUser && !user) {
      setLoadingOrders(false);
    }
  }, [apiBase, loadingUser, user]);

  const itemsByOrderId = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      const arr = map.get(item.orderId) || [];
      arr.push(item);
      map.set(item.orderId, arr);
    }
    return map;
  }, [items]);

  async function handleDownloadInvoice(orderId) {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please login to download invoices.");
        return;
      }

      const res = await fetch(`${apiBase}/invoice/${orderId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "Failed to download invoice.");
        return;
      }

      // Convert response to Blob
      const blob = await res.blob();

      // Create a local download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice_${orderId}.pdf`;
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Invoice download error:", err);
      alert("Failed to download invoice.");
    }
  }

  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-500">Checking login status…</p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Your Orders
          </h1>
          <p className="text-sm text-gray-600">
            You need to be logged in to view your orders.
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

  return (
    <SiteLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Your Orders
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            View your previous orders and download invoices.
          </p>
        </div>

        {message && (
          <p className="text-xs text-red-600">{message}</p>
        )}

        {loadingOrders ? (
          <p className="text-sm text-gray-500">Loading orders…</p>
        ) : orders.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              You don&apos;t have any orders yet.
            </p>
            <Link
              href="/products"
              className="inline-flex text-xs text-gray-800 underline underline-offset-4"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const orderItems = itemsByOrderId.get(order.id) || [];
              const date = order.createdAt
                ? new Date(order.createdAt)
                : null;

              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-900">
                        Order #{order.id}
                      </p>
                      <p className="text-xs text-gray-500">
                        {date
                          ? date.toLocaleString()
                          : "Unknown date"}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <span className="inline-flex items-center rounded-full border border-gray-300 px-3 py-1 text-[11px] font-medium text-gray-800 capitalize">
                        {order.status}
                      </span>
                      <p className="text-sm font-semibold text-gray-900">
                        ${Number(order.total || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {orderItems.length > 0 && (
                    <div className="border-t border-gray-100 pt-3 space-y-1">
                      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-[0.18em]">
                        Items
                      </p>
                      <ul className="space-y-1">
                        {orderItems.map((item) => (
                          <li
                            key={item.id}
                            className="flex justify-between text-xs text-gray-700"
                          >
                            <span>
                              Product #{item.productId} × {item.quantity}
                            </span>
                            <span>
                              ${Number(item.unitPrice || 0).toFixed(2)} each
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 mt-2">
                    <Link
                      href="/products"
                      className="text-[11px] text-gray-700 underline underline-offset-4"
                    >
                      Continue shopping
                    </Link>

                    <button
                      onClick={() => handleDownloadInvoice(order.id)}
                      className="inline-flex items-center px-3 py-1.5 rounded-full bg-black text-white text-[11px] font-medium hover:bg-gray-900 transition-colors"
                    >
                      Download invoice
                    </button>
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

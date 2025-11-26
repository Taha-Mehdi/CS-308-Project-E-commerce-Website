"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../../components/SiteLayout";
import { useAuth } from "../../../context/AuthContext";

export default function AdminOrdersPage() {
  const { user, loadingUser } = useAuth();

  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
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
          setMessage("Please login as admin.");
          setLoading(false);
          return;
        }

        // Admin orders
        const res = await fetch(`${apiBase}/orders`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          setOrders([]);
          setItems([]);
          setMessage(data.message || "Failed to load orders.");
        } else {
          // handle both shapes: array OR { orders, items }
          if (Array.isArray(data)) {
            setOrders(data);
            setItems([]);
          } else {
            setOrders(Array.isArray(data.orders) ? data.orders : []);
            setItems(Array.isArray(data.items) ? data.items : []);
          }
        }

        // Products for names/images
        const prodRes = await fetch(`${apiBase}/products`);
        const prodData = await prodRes.json();
        setProducts(Array.isArray(prodData) ? prodData : []);
      } catch (err) {
        console.error("Admin orders load error:", err);
        setOrders([]);
        setItems([]);
        setProducts([]);
        setMessage("Failed to load orders.");
      } finally {
        setLoading(false);
      }
    }

    if (!loadingUser && user && user.roleId === 1) {
      loadAll();
    } else if (!loadingUser) {
      setLoading(false);
    }
  }, [apiBase, loadingUser, user]);

  const productsMap = useMemo(() => {
    const m = new Map();
    for (const p of products) {
      m.set(p.id, p);
    }
    return m;
  }, [products]);

  const itemsByOrderId = useMemo(() => {
    const byOrder = new Map();
    for (const item of items) {
      const arr = byOrder.get(item.orderId) || [];
      arr.push(item);
      byOrder.set(item.orderId, arr);
    }
    return byOrder;
  }, [items]);

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
        <div className="space-y-3">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Admin · Orders
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

  if (user.roleId !== 1) {
    return (
      <SiteLayout>
        <div className="space-y-3">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Admin · Orders
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Admin · Orders
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              All orders across the store.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-[11px] text-gray-700 underline underline-offset-4"
          >
            Back to admin dashboard
          </Link>
        </div>

        {message && (
          <p className="text-xs text-gray-700">{message}</p>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-gray-500">No orders found.</p>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const orderItems = itemsByOrderId.get(order.id) || [];

              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900">
                        Order #{order.id}
                      </p>
                      <p className="text-xs text-gray-500">
                        User ID:{" "}
                        <span className="font-medium text-gray-800">
                          {order.userId}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Status:{" "}
                        <span className="font-medium text-gray-800">
                          {order.status}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Total: ${Number(order.total || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">
                        Created:{" "}
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* Items (if we have them) */}
                  {orderItems.length > 0 && (
                    <div className="space-y-2">
                      {orderItems.map((item) => {
                        const p = productsMap.get(item.productId);
                        const unitPrice = Number(item.unitPrice || 0);
                        const lineTotal = unitPrice * item.quantity;

                        const imageSrc =
                          p && p.imageUrl
                            ? `${apiBase}${p.imageUrl}`
                            : null;

                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                          >
                            <div className="w-14 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                              {imageSrc ? (
                                <img
                                  src={imageSrc}
                                  alt={
                                    p?.name || `Product #${item.productId}`
                                  }
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[9px] tracking-wide text-gray-500 uppercase">
                                  Img
                                </span>
                              )}
                            </div>
                            <div className="flex-1 space-y-0.5">
                              <p className="text-xs font-medium text-gray-900">
                                {p ? p.name : `Product #${item.productId}`}
                              </p>
                              <p className="text-[11px] text-gray-500">
                                Qty: {item.quantity} · $
                                {unitPrice.toFixed(2)} each
                              </p>
                            </div>
                            <div className="text-xs font-semibold text-gray-900">
                              ${lineTotal.toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

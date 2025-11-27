"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteLayout from "../../components/SiteLayout";
import { useAuth } from "../../context/AuthContext";

export default function OrdersPage() {
  const { user, loadingUser } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [message, setMessage] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  // Load orders + items + products
  useEffect(() => {
    async function loadAll() {
      if (!user) return;

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

        // 1) Orders for this user
        const ordersRes = await fetch(`${apiBase}/orders/my`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (ordersRes.ok) {
          const ct = ordersRes.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            let odata = null;
            try {
              odata = await ordersRes.json();
            } catch {
              odata = null;
            }
            if (odata && typeof odata === "object") {
              setOrders(Array.isArray(odata.orders) ? odata.orders : []);
              setItems(Array.isArray(odata.items) ? odata.items : []);
            } else if (Array.isArray(odata)) {
              // fallback shape
              setOrders(odata);
              setItems([]);
            }
          } else {
            setOrders([]);
            setItems([]);
          }
        } else {
          setOrders([]);
          setItems([]);
          try {
            const ct = ordersRes.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              const errData = await ordersRes.json();
              setMessage(errData.message || "Failed to load orders.");
            } else {
              setMessage("Failed to load orders.");
            }
          } catch {
            setMessage("Failed to load orders.");
          }
        }

        // 2) Products for names/images
        try {
          const prodRes = await fetch(`${apiBase}/products`);
          if (prodRes.ok) {
            const ct2 = prodRes.headers.get("content-type") || "";
            if (ct2.includes("application/json")) {
              const pdata = await prodRes.json();
              setProducts(Array.isArray(pdata) ? pdata : []);
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
        console.error("Orders load error:", err);
        setOrders([]);
        setItems([]);
        setProducts([]);
        setMessage("Failed to load orders.");
      } finally {
        setLoadingData(false);
      }
    }

    if (!loadingUser && user) {
      loadAll();
    }
  }, [apiBase, loadingUser, user]);

  // Build maps for quick lookup
  const productsMap = useMemo(() => {
    const m = new Map();
    for (const p of products) {
      m.set(p.id, p);
    }
    return m;
  }, [products]);

  const itemsByOrderId = useMemo(() => {
    const m = new Map();
    for (const item of items) {
      const arr = m.get(item.orderId) || [];
      arr.push(item);
      m.set(item.orderId, arr);
    }
    return m;
  }, [items]);

  // Download invoice
  async function handleDownloadInvoice(orderId) {
    setMessage("");
    setDownloadingId(orderId);

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token")
        : null;

    if (!token) {
      router.push("/login?next=/orders");
      setDownloadingId(null);
      return;
    }

    try {
      const res = await fetch(`${apiBase}/orders/${orderId}/invoice`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        try {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const errData = await res.json();
            setMessage(errData.message || "Failed to download invoice.");
          } else {
            setMessage("Failed to download invoice.");
          }
        } catch {
          setMessage("Failed to download invoice.");
        }
        setDownloadingId(null);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `order-${orderId}-invoice.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Invoice download error:", err);
      setMessage("Failed to download invoice.");
    } finally {
      setDownloadingId(null);
    }
  }

  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-500">
          Checking your session…
        </p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-4">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
            Orders
          </h1>
          <p className="text-sm text-gray-600">
            You need to be logged in to view your orders.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login?next=/orders"
              className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium uppercase tracking-[0.18em] text-gray-800 hover:bg-gray-100 transition-colors"
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
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
              SNEAKS-UP
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
              Order history
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              View your previous drops, totals, and invoices.
            </p>
          </div>
          <Link
            href="/products"
            className="text-[11px] text-gray-700 underline underline-offset-4 hover:text-black"
          >
            Back to drops
          </Link>
        </header>

        {message && (
          <p className="text-xs text-gray-700">{message}</p>
        )}

        {/* Orders list */}
        {loadingData ? (
          <p className="text-sm text-gray-500">Loading orders…</p>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center space-y-2">
            <p className="text-sm font-medium text-gray-800">
              No orders yet.
            </p>
            <p className="text-xs text-gray-500">
              When you check out from your bag, your orders will appear
              here.
            </p>
            <Link
              href="/products"
              className="inline-flex mt-2 px-4 py-2 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-colors"
            >
              Browse drops
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const orderItems = itemsByOrderId.get(order.id) || [];
              const created =
                order.createdAt || order.created_at || null;
              const total =
                typeof order.total === "string"
                  ? order.total
                  : order.total?.toString() ?? "0.00";

              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm space-y-3"
                >
                  {/* Order header */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900">
                        Order #{order.id}
                      </p>
                      <p className="text-xs text-gray-500">
                        Total:{" "}
                        <span className="font-medium text-gray-900">
                          ${Number(total || 0).toFixed(2)}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400">
                        Placed:{" "}
                        {created
                          ? new Date(created).toLocaleString()
                          : "Unknown"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${
                          order.status === "completed"
                            ? "bg-emerald-100 text-emerald-700"
                            : order.status === "cancelled"
                            ? "bg-red-100 text-red-600"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {order.status || "pending"}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadInvoice(order.id)
                        }
                        disabled={downloadingId === order.id}
                        className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1.5 text-[11px] font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                      >
                        {downloadingId === order.id
                          ? "Preparing invoice…"
                          : "Download invoice"}
                      </button>
                    </div>
                  </div>

                  {/* Items list */}
                  {orderItems.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      {orderItems.map((item) => {
                        const p = productsMap.get(item.productId);
                        const name =
                          p?.name ||
                          item.productName ||
                          `Product #${item.productId}`;
                        const unitPrice = Number(
                          item.unitPrice ??
                            item.price ??
                            p?.price ??
                            0
                        );
                        const lineTotal =
                          unitPrice * (item.quantity || 0);
                        const imageUrl =
                          p?.imageUrl || item.productImageUrl || null;
                        const imageSrc = imageUrl
                          ? `${process.env.NEXT_PUBLIC_API_BASE_URL}${imageUrl}`
                          : null;

                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                          >
                            <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
                              {imageSrc ? (
                                <img
                                  src={imageSrc}
                                  alt={name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[9px] tracking-[0.2em] text-gray-500 uppercase">
                                  Sneaks
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <p className="text-xs font-medium text-gray-900 truncate">
                                {name}
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

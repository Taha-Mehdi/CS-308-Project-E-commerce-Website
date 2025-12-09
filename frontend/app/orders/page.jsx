"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../components/SiteLayout";
import ActionButton from "../../components/ActionButton";
import { useAuth } from "../../context/AuthContext";

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

function statusBadgeClasses(status) {
  switch (status) {
    case "processing":
      return "bg-amber-50 text-amber-700 border border-amber-200";
    case "in_transit":
      return "bg-blue-50 text-blue-700 border border-blue-200";
    case "delivered":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "cancelled":
      return "bg-red-50 text-red-700 border border-red-200";
    // legacy / unknown statuses
    case "paid":
    case "shipped":
    case "pending":
    default:
      return "bg-gray-50 text-gray-700 border border-gray-200";
  }
}

function formatStatusLabel(status) {
  switch (status) {
    case "processing":
      return "Processing";
    case "in_transit":
      return "In transit";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    case "paid":
      return "Paid";
    case "shipped":
      return "Shipped";
    case "pending":
      return "Pending";
    default:
      return status || "Unknown";
  }
}

export default function OrdersPage() {
  const { user, loadingUser } = useAuth();

  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);

  const isBrowser = typeof window !== "undefined";

  // Load user orders + items + products
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setMessage("");

      try {
        const token = isBrowser ? window.localStorage.getItem("token") : null;

        if (!token) {
          setOrders([]);
          setItems([]);
          setProducts([]);
          setLoading(false);
          return;
        }

        // 1) User's own orders
        const res = await fetch(`${apiBase}/orders/my`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          let msg = "Failed to load your orders.";
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            try {
              const errJson = await res.json();
              if (errJson && errJson.message) msg = errJson.message;
            } catch {
              // ignore
            }
          }
          setMessage(msg);
          setOrders([]);
          setItems([]);
        } else {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            try {
              const data = await res.json();
              if (Array.isArray(data)) {
                // older shape, just orders
                setOrders(data);
                setItems([]);
              } else {
                setOrders(Array.isArray(data.orders) ? data.orders : []);
                setItems(Array.isArray(data.items) ? data.items : []);
              }
            } catch {
              setOrders([]);
              setItems([]);
              setMessage("Could not decode orders response.");
            }
          } else {
            setOrders([]);
            setItems([]);
            setMessage("Unexpected response while loading orders.");
          }
        }

        // 2) Products (for name + image)
        const prodRes = await fetch(`${apiBase}/products`);
        if (prodRes.ok) {
          const ct = prodRes.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            try {
              const prodData = await prodRes.json();
              setProducts(Array.isArray(prodData) ? prodData : []);
            } catch {
              setProducts([]);
            }
          } else {
            setProducts([]);
          }
        } else {
          setProducts([]);
        }
      } catch (err) {
        console.error("Orders page load error:", err);
        setOrders([]);
        setItems([]);
        setProducts([]);
        setMessage("Failed to load orders.");
      } finally {
        setLoading(false);
      }
    }

    if (!loadingUser && user) {
      loadAll();
    } else if (!loadingUser) {
      setLoading(false);
    }
  }, [loadingUser, user, isBrowser]);

  const productsMap = useMemo(() => {
    const m = new Map();
    for (const p of products) {
      m.set(p.id, p);
    }
    return m;
  }, [products]);

  const itemsByOrderId = useMemo(() => {
    const grouped = new Map();
    for (const item of items) {
      const arr = grouped.get(item.orderId) || [];
      arr.push(item);
      grouped.set(item.orderId, arr);
    }
    return grouped;
  }, [items]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
  }, [orders]);

  async function handleDownloadInvoice(orderId) {
    try {
      const token = isBrowser ? window.localStorage.getItem("token") : null;

      if (!token) {
        const msg = "Please login again to download invoices.";
        setMessage(msg);
        if (isBrowser) window.alert(msg);
        return;
      }

      setInvoiceLoadingId(orderId);
      setMessage("");

      const res = await fetch(`${apiBase}/invoice/${orderId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const ct = res.headers.get("content-type") || "";

      if (!res.ok) {
        let msg = "Invoice download failed.";
        if (ct.includes("application/json")) {
          try {
            const errJson = await res.json();
            if (errJson && errJson.message) msg = errJson.message;
          } catch {
            // ignore
          }
        }
        console.error("Invoice download failed:", res.status);
        setMessage(msg);
        if (isBrowser) window.alert(msg);
        return;
      }

      if (!ct.includes("application/pdf")) {
        const msg = "Unexpected response when downloading invoice.";
        setMessage(msg);
        if (isBrowser)
          window.alert("Unexpected response from server for invoice.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice_${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Invoice download error:", err);
      const msg = "Invoice download failed. Please try again.";
      setMessage(msg);
      if (isBrowser) window.alert(msg);
    } finally {
      setInvoiceLoadingId(null);
    }
  }

  // AUTH gates
  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-500">Checking your account…</p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-500">
              Sneaks-up
            </p>
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
              Your orders
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Login to see your sneaker history, statuses, and invoices.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-semibold uppercase tracking-[0.18em] text-gray-800 hover:bg-gray-100 transition-colors"
            >
              Create account
            </Link>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // Logged-in UI
  return (
    <SiteLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-500">
              Sneaks-up
            </p>
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
              Your orders
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Every drop you&apos;ve locked in with{" "}
              <span className="font-medium text-gray-900">
                {user.email}
              </span>
              .
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              Status flow:{" "}
              <span className="font-semibold text-gray-800">
                Processing
              </span>{" "}
              →{" "}
              <span className="font-semibold text-gray-800">
                In transit
              </span>{" "}
              →{" "}
              <span className="font-semibold text-gray-800">
                Delivered
              </span>
              .
            </p>
          </div>
          <Link
            href="/products"
            className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-colors"
          >
            Back to drops
          </Link>
        </div>

        {message && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700">
            {message}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Loading your orders…</p>
        ) : sortedOrders.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              You haven&apos;t placed any orders yet.
            </p>
            <Link
              href="/products"
              className="inline-flex px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-colors"
            >
              Browse drops
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedOrders.map((order) => {
              const badgeClass = statusBadgeClasses(order.status);
              const orderItems = itemsByOrderId.get(order.id) || [];

              return (
                <div
                  key={order.id}
                  className="rounded-3xl border border-gray-200 bg-white px-4 py-4 sm:px-5 sm:py-5 shadow-sm space-y-4"
                >
                  {/* Order summary */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          Order #{order.id}
                        </p>
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.16em] ${badgeClass}`}
                        >
                          {formatStatusLabel(order.status)}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Placed:{" "}
                        <span className="font-medium text-gray-800">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleString()
                            : "N/A"}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <p className="text-sm font-semibold text-gray-900">
                        Total: ${Number(order.total || 0).toFixed(2)}
                      </p>
                      <ActionButton
                        type="button"
                        onClick={() => handleDownloadInvoice(order.id)}
                        disabled={invoiceLoadingId === order.id}
                      >
                        {invoiceLoadingId === order.id
                          ? "Preparing…"
                          : "Download invoice"}
                      </ActionButton>
                    </div>
                  </div>

                  {/* Items */}
                  {orderItems.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      No item details available for this order.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {orderItems.map((item) => {
                        const p = productsMap.get(item.productId);
                        const unitPrice = Number(item.unitPrice || 0);
                        const lineTotal =
                          unitPrice * (item.quantity || 0);

                        let imageUrl = p?.imageUrl || null;
                        if (imageUrl && !imageUrl.startsWith("http")) {
                          imageUrl = `${apiBase}${imageUrl}`;
                        }

                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                          >
                            {/* Image */}
                            <div className="w-20 sm:w-24 aspect-square rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={
                                    p?.name ||
                                    `Product #${item.productId}`
                                  }
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[9px] uppercase tracking-[0.18em] text-gray-400 text-center px-2">
                                  Sneaks-up drop
                                </span>
                              )}
                            </div>

                            <div className="flex-1 space-y-0.5">
                              <p className="text-xs font-semibold text-gray-900">
                                {p
                                  ? p.name
                                  : `Product #${item.productId}`}
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
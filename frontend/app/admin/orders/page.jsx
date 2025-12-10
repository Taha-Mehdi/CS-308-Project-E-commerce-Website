"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../../components/SiteLayout";
import ActionButton from "../../../components/ActionButton";
import { useAuth } from "../../../context/AuthContext";

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

const STATUS_OPTIONS = ["processing", "in_transit", "delivered", "cancelled"];

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
    // Legacy/other statuses
    case "pending":
    case "paid":
    case "shipped":
    default:
      return "bg-gray-50 text-gray-700 border border-gray-200";
  }
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
    default:
      return status || "unknown";
  }
}

const STATUS_VARIANTS = {
  processing: "muted",
  in_transit: "info",
  delivered: "accent",
  cancelled: "danger",
  // legacy
  pending: "muted",
  paid: "success",
  shipped: "info",
};

export function statusActionVariant(status) {
  return STATUS_VARIANTS[status] || "muted";
}

export default function AdminOrdersPage() {
  const { user, loadingUser } = useAuth();

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [detailsById, setDetailsById] = useState({});
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);

  const isBrowser = typeof window !== "undefined";

  // Load all orders (admin) + products for names/images
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setMessage("");

      try {
        const token = isBrowser ? window.localStorage.getItem("token") : null;

        if (!token) {
          setOrders([]);
          setProducts([]);
          setMessage("Please login as admin.");
          setLoading(false);
          return;
        }

        // Fetch orders (admin)
        const ordersRes = await fetch(`${apiBase}/orders`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        let ordersData = [];
        if (ordersRes.ok) {
          const ct = ordersRes.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            try {
              const json = await ordersRes.json();
              if (Array.isArray(json)) {
                ordersData = json;
              }
            } catch {
              ordersData = [];
            }
          }
        } else {
          let errMsg = "Failed to load orders.";
          try {
            const ct = ordersRes.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              const errJson = await ordersRes.json();
              if (errJson && errJson.message) {
                errMsg = errJson.message;
              }
            }
          } catch {
            // ignore
          }
          setMessage(errMsg);
        }

        // Fetch products for mapping
        const productsRes = await fetch(`${apiBase}/products`);
        let productsData = [];
        if (productsRes.ok) {
          const ct = productsRes.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            try {
              const json = await productsRes.json();
              if (Array.isArray(json)) {
                productsData = json;
              }
            } catch {
              productsData = [];
            }
          }
        }

        setOrders(ordersData);
        setProducts(productsData);
      } catch (err) {
        console.error("Admin orders load error:", err);
        setOrders([]);
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
  }, [loadingUser, user, isBrowser]);

  const productsMap = useMemo(() => {
    const m = new Map();
    for (const p of products) {
      m.set(p.id, p);
    }
    return m;
  }, [products]);

  const stats = useMemo(() => {
    const total = orders.length;
    const processing = orders.filter((o) => o.status === "processing").length;
    const inTransit = orders.filter((o) => o.status === "in_transit").length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;

    return { total, processing, inTransit, delivered, cancelled };
  }, [orders]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da; // newest first
    });
  }, [orders]);

  function ensureAdmin() {
    if (!user || user.roleId !== 1) {
      setMessage("You do not have admin permissions.");
      return false;
    }
    return true;
  }

  // Fetch details (items) for one order when expanded
  async function handleToggleExpand(orderId) {
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(orderId);

    // If already loaded, just expand
    if (detailsById[orderId]) return;

    try {
      const token = isBrowser ? window.localStorage.getItem("token") : null;

      if (!token) {
        setMessage("Please login as admin.");
        return;
      }

      const res = await fetch(`${apiBase}/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        let msg = "Failed to load order details.";
        try {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const json = await res.json();
            if (json && json.message) msg = json.message;
          }
        } catch {
          // ignore
        }
        setMessage(msg);
        return;
      }

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        setMessage("Unexpected response while loading order details.");
        return;
      }

      let data;
      try {
        data = await res.json();
      } catch {
        setMessage("Could not decode order details.");
        return;
      }

      if (!data || !Array.isArray(data.items)) {
        setMessage("Order details format is invalid.");
        return;
      }

      setDetailsById((prev) => ({
        ...prev,
        [orderId]: data,
      }));
    } catch (err) {
      console.error("Admin load order details error:", err);
      setMessage("Failed to load order details.");
    }
  }

  // Update status
  async function handleChangeStatus(orderId, newStatus) {
    if (!ensureAdmin()) return;

    try {
      const token = isBrowser ? window.localStorage.getItem("token") : null;

      if (!token) {
        setMessage("Please login as admin.");
        return;
      }

      setStatusUpdatingId(orderId);
      setMessage("");

      const res = await fetch(`${apiBase}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const ct = res.headers.get("content-type") || "";
      let data = null;
      if (ct.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        console.error("Status update failed:", res.status, data);
        const msg =
          (data && data.message) ||
          "Failed to update order status. Please try again.";
        setMessage(msg);
        if (isBrowser) window.alert(msg);
        return;
      }

      // Update local state
      const updatedOrder = data && data.order ? data.order : null;

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: updatedOrder?.status || newStatus }
            : o
        )
      );

      // Also update expanded details if present
      setDetailsById((prev) => {
        const current = prev[orderId];
        if (!current) return prev;
        return {
          ...prev,
          [orderId]: {
            ...current,
            order: {
              ...(current.order || {}),
              status: updatedOrder?.status || newStatus,
            },
          },
        };
      });

      setMessage("Order status updated.");
    } catch (err) {
      console.error("Status update error:", err);
      const msg = "Something went wrong while updating order status.";
      setMessage(msg);
      if (isBrowser) window.alert(msg);
    } finally {
      setStatusUpdatingId(null);
    }
  }

  // Download invoice
  async function handleDownloadInvoice(orderId) {
    if (!ensureAdmin()) return;

    try {
      const token = isBrowser ? window.localStorage.getItem("token") : null;

      if (!token) {
        setMessage("Please login as admin.");
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
            const json = await res.json();
            if (json && json.message) msg = json.message;
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
        const msg = "Unexpected invoice response.";
        setMessage(msg);
        if (isBrowser)
          window.alert("Unexpected invoice response from server.");
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
        <p className="text-sm text-gray-500">Checking admin access…</p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-4">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
            Admin · Orders
          </h1>
          <p className="text-sm text-gray-600 max-w-sm">
            You need to be logged in as an admin to manage orders.
          </p>
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
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
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
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-500">
              Sneaks-up · Admin
            </p>
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
              Orders overview
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Track every pair leaving the SNEAKS-UP vault. Update status and
              export invoices in one place.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-[11px] text-gray-700 underline underline-offset-4 hover:text-black"
          >
            Back to admin dashboard
          </Link>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-5">
          <div className="rounded-2xl border border-gray-200 bg-white/95 px-4 py-4 shadow-sm">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-500">
              Total
            </p>
            <p className="mt-2 text-xl font-semibold text-gray-900">
              {stats.total}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">All orders</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white/95 px-4 py-4 shadow-sm">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-500">
              Processing
            </p>
            <p className="mt-2 text-xl font-semibold text-amber-700">
              {stats.processing}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">In warehouse</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white/95 px-4 py-4 shadow-sm">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-500">
              In-transit
            </p>
            <p className="mt-2 text-xl font-semibold text-blue-700">
              {stats.inTransit}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">On the way</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white/95 px-4 py-4 shadow-sm">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-500">
              Delivered
            </p>
            <p className="mt-2 text-xl font-semibold text-emerald-700">
              {stats.delivered}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">On feet</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white/95 px-4 py-4 shadow-sm">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-500">
              Cancelled
            </p>
            <p className="mt-2 text-xl font-semibold text-red-700">
              {stats.cancelled}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">Stopped</p>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700">
            {message}
          </div>
        )}

        {/* List of orders */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-900">
              All store orders
            </p>
            <p className="text-[11px] text-gray-500">
              {orders.length} record{orders.length === 1 ? "" : "s"}
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading orders…</p>
          ) : sortedOrders.length === 0 ? (
            <p className="text-sm text-gray-500">
              No orders yet. Once customers check out, they will show up here.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedOrders.map((order) => {
                const isExpanded = expandedId === order.id;
                const statusClass = statusBadgeClasses(order.status);
                const orderDetails = detailsById[order.id];
                const items = orderDetails?.items || [];

                return (
                  <div
                    key={order.id}
                    className="rounded-3xl border border-gray-200 bg-white px-4 py-4 sm:px-5 sm:py-5 shadow-sm"
                  >
                    {/* Top row: summary */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            Order #{order.id}
                          </p>
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.16em] ${statusClass}`}
                          >
                            {formatStatusLabel(order.status)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          User ID:{" "}
                          <span className="font-medium text-gray-800">
                            {order.userId}
                          </span>
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Created:{" "}
                          <span className="font-medium text-gray-800">
                            {order.createdAt
                              ? new Date(order.createdAt).toLocaleString()
                              : "N/A"}
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          ${Number(order.total || 0).toFixed(2)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {/* STATUS DROPDOWN */}
                          <div className="relative">
                            <select
                              value={order.status}
                              disabled={statusUpdatingId === order.id}
                              onChange={(e) =>
                                handleChangeStatus(order.id, e.target.value)
                              }
                              className="appearance-none rounded-full border border-gray-300 bg-white px-3 pr-8 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-800 hover:border-black/60 focus:outline-none focus:ring-2 focus:ring-black/15"
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {formatStatusLabel(status)}
                                </option>
                              ))}
                            </select>
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">
                              ▾
                            </span>
                          </div>

                          <ActionButton
                            type="button"
                            onClick={() => handleDownloadInvoice(order.id)}
                            disabled={invoiceLoadingId === order.id}
                          >
                            {invoiceLoadingId === order.id
                              ? "Preparing…"
                              : "Invoice"}
                          </ActionButton>

                          <ActionButton
                            type="button"
                            variant="outline"
                            onClick={() => handleToggleExpand(order.id)}
                          >
                            {isExpanded ? "Hide items" : "View items"}
                          </ActionButton>
                        </div>
                      </div>
                    </div>

                    {/* Expanded items */}
                    {isExpanded && (
                      <div className="mt-4 border-t border-gray-100 pt-3">
                        {orderDetails == null ? (
                          <p className="text-xs text-gray-500">
                            Loading items…
                          </p>
                        ) : items.length === 0 ? (
                          <p className="text-xs text-gray-500">
                            No items found for this order.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {items.map((item) => {
                              const p = productsMap.get(item.productId);
                              const unitPrice = Number(
                                item.unitPrice || 0
                              );
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
                                  <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
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
                                      <span className="text-[9px] uppercase tracking-[0.18em] text-gray-400">
                                        Sneaks
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}

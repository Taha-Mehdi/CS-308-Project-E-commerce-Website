"use client";

import { useEffect, useMemo, useState } from "react";
import SiteLayout from "../../../components/SiteLayout";
import DripLink from "../../../components/DripLink";
import ActionButton from "../../../components/ActionButton";
import { useAuth } from "../../../context/AuthContext";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

const STATUS_OPTIONS = ["processing", "in_transit", "delivered", "cancelled"];

// Dark drip-style status pill
function statusPill(status) {
  const base =
    "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border";

  switch (status) {
    case "processing":
      return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
    case "in_transit":
      return `${base} border-sky-500/25 bg-sky-500/10 text-sky-200`;
    case "delivered":
      return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
    case "cancelled":
      return `${base} border-red-500/25 bg-red-500/10 text-red-200`;
    // legacy/other
    case "pending":
    case "paid":
    case "shipped":
    default:
      return `${base} border-white/10 bg-white/5 text-gray-200/80`;
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

  async function safeJson(res) {
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

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
          headers: { Authorization: `Bearer ${token}` },
        });

        let ordersData = [];
        if (ordersRes.ok) {
          const json = await safeJson(ordersRes);
          if (Array.isArray(json)) ordersData = json;
        } else {
          const errJson = await safeJson(ordersRes);
          setMessage(errJson?.message || "Failed to load orders.");
        }

        // Fetch products for mapping
        const productsRes = await fetch(`${apiBase}/products`);
        let productsData = [];
        if (productsRes.ok) {
          const json = await safeJson(productsRes);
          if (Array.isArray(json)) productsData = json;
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
    for (const p of products) m.set(p.id, p);
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
      return db - da;
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
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const json = await safeJson(res);
        setMessage(json?.message || "Failed to load order details.");
        return;
      }

      const data = await safeJson(res);
      if (!data || !Array.isArray(data.items)) {
        setMessage("Order details format is invalid.");
        return;
      }

      setDetailsById((prev) => ({ ...prev, [orderId]: data }));
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

      const data = await safeJson(res);

      if (!res.ok) {
        const msg =
          (data && data.message) ||
          "Failed to update order status. Please try again.";
        setMessage(msg);
        if (isBrowser) window.alert(msg);
        return;
      }

      const updatedOrder = data && data.order ? data.order : null;

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: updatedOrder?.status || newStatus }
            : o
        )
      );

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
        headers: { Authorization: `Bearer ${token}` },
      });

      const ct = res.headers.get("content-type") || "";

      if (!res.ok) {
        let msg = "Invoice download failed.";
        if (ct.includes("application/json")) {
          const json = await safeJson(res);
          if (json?.message) msg = json.message;
        }
        setMessage(msg);
        if (isBrowser) window.alert(msg);
        return;
      }

      if (!ct.includes("application/pdf")) {
        const msg = "Unexpected invoice response.";
        setMessage(msg);
        if (isBrowser) window.alert("Unexpected invoice response from server.");
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
              Orders overview
            </h1>
            <p className="text-sm text-gray-300/70 max-w-md">
              You need to be logged in as an admin to manage orders.
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
              href="/register"
              className="
                h-10 px-5 inline-flex items-center justify-center rounded-full
                border border-border bg-white/5 text-[11px] font-semibold uppercase tracking-[0.18em]
                text-gray-100 hover:bg-white/10 transition active:scale-[0.98]
              "
            >
              Sign up
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
              Orders overview
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

  return (
    <SiteLayout>
      <div className="space-y-6 py-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Sneaks-up · Admin
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Orders overview
            </h1>
            <p className="text-sm text-gray-300/70 max-w-2xl">
              Track every pair leaving the vault. Update status and export invoices.
            </p>

            <div className="pt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border border-white/10 bg-white/5 text-gray-200/80">
                {orders.length} total
              </span>
              <span className={statusPill("processing")}>{stats.processing} processing</span>
              <span className={statusPill("in_transit")}>{stats.inTransit} in-transit</span>
              <span className={statusPill("delivered")}>{stats.delivered} delivered</span>
              <span className={statusPill("cancelled")}>{stats.cancelled} cancelled</span>
            </div>
          </div>

          <DripLink
            href="/admin"
            className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
          >
            Back to admin dashboard
          </DripLink>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className={metricCard("neutral")}>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Total
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.total}</p>
            <p className="mt-1 text-[11px] text-gray-300/55">All orders</p>
          </div>

          <div className={metricCard("amber")}>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Processing
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.processing}</p>
            <p className="mt-1 text-[11px] text-gray-300/55">In warehouse</p>
          </div>

          <div className={metricCard("blue")}>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              In-transit
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.inTransit}</p>
            <p className="mt-1 text-[11px] text-gray-300/55">On the way</p>
          </div>

          <div className={metricCard("green")}>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Delivered
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.delivered}</p>
            <p className="mt-1 text-[11px] text-gray-300/55">On feet</p>
          </div>

          <div className={metricCard("red")}>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Cancelled
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.cancelled}</p>
            <p className="mt-1 text-[11px] text-gray-300/55">Stopped</p>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-gray-200/80">
            {message}
          </div>
        )}

        {/* Orders list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Store orders
            </p>
            <p className="text-[11px] text-gray-300/55">
              {orders.length} record{orders.length === 1 ? "" : "s"}
            </p>
          </div>

          {loading ? (
            <div className={panelClass()}>
              <p className="text-sm text-gray-300/70">Loading orders…</p>
            </div>
          ) : sortedOrders.length === 0 ? (
            <div className={panelClass()}>
              <p className="text-sm text-gray-300/70">
                No orders yet. Once customers check out, they will show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedOrders.map((order) => {
                const isExpanded = expandedId === order.id;
                const orderDetails = detailsById[order.id];
                const items = orderDetails?.items || [];

                return (
                  <div key={order.id} className={panelClass()}>
                    {/* Summary */}
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">
                            Order #{order.id}
                          </p>
                          <span className={statusPill(order.status)}>
                            {formatStatusLabel(order.status)}
                          </span>
                        </div>

                        <p className="text-[11px] text-gray-300/60">
                          User ID:{" "}
                          <span className="font-medium text-gray-100/90">
                            {order.userId}
                          </span>
                        </p>
                        <p className="text-[11px] text-gray-300/60">
                          Created:{" "}
                          <span className="font-medium text-gray-100/90">
                            {order.createdAt
                              ? new Date(order.createdAt).toLocaleString()
                              : "N/A"}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-col items-start lg:items-end gap-2">
                        <p className="text-sm font-semibold text-white">
                          ${Number(order.total || 0).toFixed(2)}
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Status dropdown */}
                          <div className="relative">
                            <select
                              value={order.status}
                              disabled={statusUpdatingId === order.id}
                              onChange={(e) =>
                                handleChangeStatus(order.id, e.target.value)
                              }
                              className="
                                appearance-none h-10 rounded-full border border-white/10 bg-white/5
                                px-4 pr-9 text-[11px] font-semibold uppercase tracking-[0.18em]
                                text-gray-100 hover:bg-white/10 transition
                                focus:outline-none focus:ring-2 focus:ring-white/15
                                disabled:opacity-60 disabled:cursor-not-allowed
                              "
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {formatStatusLabel(status)}
                                </option>
                              ))}
                            </select>
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-300/70">
                              ▾
                            </span>
                          </div>

                          <ActionButton
                            type="button"
                            onClick={() => handleDownloadInvoice(order.id)}
                            disabled={invoiceLoadingId === order.id}
                          >
                            {invoiceLoadingId === order.id ? "Preparing…" : "Invoice"}
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
                      <div className="mt-4 border-t border-white/10 pt-4">
                        {orderDetails == null ? (
                          <p className="text-sm text-gray-300/70">
                            Loading items…
                          </p>
                        ) : items.length === 0 ? (
                          <p className="text-sm text-gray-300/70">
                            No items found for this order.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {items.map((item) => {
                              const p = productsMap.get(item.productId);
                              const unitPrice = Number(item.unitPrice || 0);
                              const lineTotal = unitPrice * (item.quantity || 0);

                              let imageUrl = p?.imageUrl || null;
                              if (imageUrl && !imageUrl.startsWith("http")) {
                                imageUrl = `${apiBase}${imageUrl}`;
                              }

                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-3 py-3"
                                >
                                  <div className="w-14 h-14 rounded-2xl bg-black/30 border border-white/10 overflow-hidden flex items-center justify-center">
                                    {imageUrl ? (
                                      <img
                                        src={imageUrl}
                                        alt={p?.name || `Product #${item.productId}`}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <span className="text-[9px] uppercase tracking-[0.18em] text-gray-300/50">
                                        Sneaks
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white truncate">
                                      {p ? p.name : `Product #${item.productId}`}
                                    </p>
                                    <p className="text-[11px] text-gray-300/60">
                                      Qty: {item.quantity} · ${unitPrice.toFixed(2)} each
                                    </p>
                                  </div>

                                  <div className="text-sm font-semibold text-white">
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

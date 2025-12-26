"use client";

import { useEffect, useMemo, useState } from "react";
import DripLink from "../../../components/DripLink";
import {
  apiRequest,
  clearStoredTokens,
  downloadInvoicePdfBlob,
  getProductsApi,
} from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

/* Lighter admin glass surface (no navbar wrapper) */
function panelClass() {
  return "rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5 shadow-[0_16px_60px_rgba(0,0,0,0.35)]";
}

function chipBase() {
  return "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border whitespace-nowrap";
}
function chip(tone = "muted") {
  const base = chipBase();
  if (tone === "warn")
    return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
  if (tone === "ok")
    return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
  return `${base} border-white/10 bg-white/5 text-gray-200/80`;
}

function isAdminPanelRole(user) {
  const rn = user?.roleName || user?.role || user?.role_name || "";
  return rn === "admin" || rn === "product_manager";
}

function handleAuthRedirect(err, nextPath) {
  const status = err?.status;
  if (status === 401) {
    clearStoredTokens();
    window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
    return true;
  }
  if (status === 403) {
    window.location.href = "/";
    return true;
  }
  return false;
}

/* Unified compact button + select sizing */
const actionBtn =
    "h-9 px-4 rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-100 hover:bg-white/10 transition active:scale-[0.98]";

const primaryBtn =
    "h-9 px-4 rounded-full bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] text-black text-[10px] font-semibold uppercase tracking-[0.18em] hover:opacity-95 transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";

const selectStyle =
    "h-9 rounded-full border border-white/10 bg-white/5 px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_35%,transparent)] disabled:opacity-60 disabled:cursor-not-allowed";

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

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setMessage("");

      try {
        const ordersData = await apiRequest("/orders", {
          method: "GET",
          auth: true,
        });
        setOrders(Array.isArray(ordersData) ? ordersData : []);

        const productsData = await getProductsApi();
        setProducts(Array.isArray(productsData) ? productsData : []);
      } catch (err) {
        console.error("Admin orders load error:", err);
        if (handleAuthRedirect(err, "/admin/orders")) return;
        setOrders([]);
        setProducts([]);
        setMessage(err?.message || "Failed to load orders.");
      } finally {
        setLoading(false);
      }
    }

    if (!loadingUser && user && isAdminPanelRole(user)) loadAll();
    else if (!loadingUser) setLoading(false);
  }, [loadingUser, user]);

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

  async function handleToggleExpand(orderId) {
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(orderId);

    if (detailsById[orderId]) return;

    try {
      const data = await apiRequest(`/orders/${orderId}`, {
        method: "GET",
        auth: true,
      });

      if (!data || !Array.isArray(data.items)) {
        setMessage("Order details format is invalid.");
        return;
      }

      setDetailsById((prev) => ({ ...prev, [orderId]: data.items }));
    } catch (err) {
      console.error("Order details load error:", err);
      if (handleAuthRedirect(err, "/admin/orders")) return;
      setMessage(err?.message || "Failed to load order details.");
    }
  }

  async function handleUpdateStatus(orderId, status) {
    setStatusUpdatingId(orderId);
    setMessage("");

    try {
      const updated = await apiRequest(`/orders/${orderId}/status`, {
        method: "PATCH",
        auth: true,
        body: { status },
      });

      setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o))
      );
      setMessage("Status updated.");
    } catch (err) {
      console.error("Status update error:", err);
      if (handleAuthRedirect(err, "/admin/orders")) return;
      setMessage(err?.message || "Failed to update status.");
    } finally {
      setStatusUpdatingId(null);
    }
  }

  async function handleDownloadInvoice(orderId) {
    setInvoiceLoadingId(orderId);
    setMessage("");

    try {
      const blob = await downloadInvoicePdfBlob(orderId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Invoice download error:", err);
      if (handleAuthRedirect(err, "/admin/orders")) return;
      setMessage(err?.message || "Failed to download invoice PDF.");
    } finally {
      setInvoiceLoadingId(null);
    }
  }

  /* ------- UI wrappers ------- */
  const PageShell = ({ children }) => (
      <div className="min-h-screen text-white">
        <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
      </div>
  );

  if (loadingUser) {
    return (
        <PageShell>
          <p className="text-sm text-gray-300/70">Checking access…</p>
        </PageShell>
    );
  }

  if (!user || !isAdminPanelRole(user)) {
    return (
        <PageShell>
          <div className="space-y-4">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Admin
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Access denied
            </h1>
            <p className="text-sm text-gray-300/70">
              You need admin or product manager permissions to manage orders.
            </p>
            <DripLink
                href="/"
                className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
            >
              Back to homepage
            </DripLink>
          </div>
        </PageShell>
    );
  }

  return (
      <PageShell>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
                Sneaks-up · Admin
              </p>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                Delivery Management
              </h1>

              <div className="flex flex-wrap gap-2 pt-2">
                <span className={chip("muted")}>{stats.total} total</span>
                <span className={chip("muted")}>{stats.processing} processing</span>
                <span className={chip("muted")}>{stats.inTransit} in-transit</span>
                <span className={chip("muted")}>{stats.delivered} delivered</span>
                <span className={chip(stats.cancelled ? "warn" : "muted")}>
                {stats.cancelled} cancelled
              </span>
              </div>
            </div>

            <DripLink
                href="/admin"
                className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
            >
              Back to dashboard
            </DripLink>
          </div>

          {message && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur px-4 py-3 text-[11px] text-gray-200/80">
                {message}
              </div>
          )}

          {loading ? (
              <div className={panelClass()}>
                <p className="text-sm text-gray-300/70">Loading deliveries…</p>
              </div>
          ) : sortedOrders.length === 0 ? (
              <div className={panelClass()}>
                <p className="text-sm text-gray-300/70">No orders found.</p>
              </div>
          ) : (
              <div className="space-y-4">
                {sortedOrders.map((o) => {
                  const orderId = o.id;
                  const expanded = expandedId === orderId;
                  const items = detailsById[orderId] || [];

                  return (
                      <div key={orderId} className={panelClass()}>
                        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                          {/* LEFT: Delivery Info */}
                          <div className="space-y-3 flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300/70">
                                Delivery #{orderId}
                              </p>
                              <span className={chip(o.status === "delivered" ? "ok" : "warn")}>
                          {o.status}
                        </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-[12px] text-gray-400">
                              <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-wider opacity-60">Customer ID</span>
                                <span className="text-white font-mono">{o.userId}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-wider opacity-60">Total Amount</span>
                                <span className="text-white font-medium">${Number(o.total || 0).toFixed(2)}</span>
                              </div>
                              <div className="flex flex-col sm:col-span-2 mt-1">
                                <span className="text-[10px] uppercase tracking-wider opacity-60">Delivery Address</span>
                                <span className="text-white leading-relaxed">
                              {o.shippingAddress || o.address || "No address provided"}
                            </span>
                              </div>
                            </div>
                          </div>

                          {/* RIGHT: Actions */}
                          <div className="flex flex-col items-end gap-3 shrink-0">
                            <select
                                disabled={statusUpdatingId === orderId}
                                value={o.status || "processing"}
                                onChange={(e) => handleUpdateStatus(orderId, e.target.value)}
                                className={selectStyle + " w-full md:w-40"}
                            >
                              <option value="processing">Processing</option>
                              <option value="in_transit">In Transit</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>

                            <div className="flex gap-2">
                              <button
                                  type="button"
                                  disabled={invoiceLoadingId === orderId}
                                  onClick={() => handleDownloadInvoice(orderId)}
                                  className={actionBtn}
                              >
                                {invoiceLoadingId === orderId ? "..." : "Invoice PDF"}
                              </button>
                              <button
                                  type="button"
                                  onClick={() => handleToggleExpand(orderId)}
                                  className={primaryBtn}
                              >
                                {expanded ? "Hide" : "View Details"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* EXPANDED: Product List */}
                        {expanded && (
                            <div className="mt-6 border-t border-white/10 pt-5 space-y-4">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60">
                                  Products to Deliver
                                </p>
                                <p className="text-[11px] text-gray-400">
                                  Created: {o.createdAt ? new Date(o.createdAt).toLocaleString() : "—"}
                                </p>
                              </div>

                              {items.length === 0 ? (
                                  <p className="text-sm text-gray-300/70">Loading items details…</p>
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
                                              className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-black/20 px-4 py-3"
                                          >
                                            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 overflow-hidden flex items-center justify-center shrink-0">
                                              {imageUrl ? (
                                                  <img
                                                      src={imageUrl}
                                                      alt={p?.name || `Product`}
                                                      className="w-full h-full object-cover"
                                                  />
                                              ) : (
                                                  <span className="text-[8px] uppercase tracking-widest text-gray-500">
                                      IMG
                                    </span>
                                              )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-semibold text-white truncate">
                                                {p ? p.name : "Unknown Product"}
                                                <span className="ml-2 text-[10px] font-normal text-gray-500 font-mono">
                                      (Prod ID: {item.productId})
                                    </span>
                                              </p>
                                              <p className="text-[11px] text-gray-400 mt-0.5">
                                                <span className="text-white">Qty: {item.quantity}</span>
                                                <span className="mx-2 opacity-30">|</span>
                                                Price: ${unitPrice.toFixed(2)}
                                              </p>
                                            </div>

                                            <div className="text-sm font-mono font-medium text-white/90">
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
      </PageShell>
  );
}
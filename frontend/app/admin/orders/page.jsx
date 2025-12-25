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
  return "rounded-[28px] border border-border bg-white/[0.04] backdrop-blur-xl p-5 shadow-[0_16px_60px_rgba(0,0,0,0.35)]";
}

function chipBase() {
  return "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border";
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
  "h-9 px-4 rounded-full border border-border bg-white/5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-100 hover:bg-white/10 transition active:scale-[0.98]";

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
        method: "PUT",
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

  /* ------- UI wrappers (navbar removed) ------- */
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
              Orders
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
            <p className="text-sm text-gray-300/70">Loading orders…</p>
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
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300/70">
                        Order #{orderId}
                      </p>
                      <p className="text-[11px] text-gray-300/60">
                        Created:{" "}
                        {o.createdAt ? new Date(o.createdAt).toLocaleString() : "—"}
                      </p>
                      <p className="text-[11px] text-gray-300/60">
                        Status: {o.status || "—"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleExpand(orderId)}
                        className={actionBtn}
                      >
                        {expanded ? "Hide items" : "View items"}
                      </button>

                      <button
                        type="button"
                        disabled={invoiceLoadingId === orderId}
                        onClick={() => handleDownloadInvoice(orderId)}
                        className={primaryBtn}
                      >
                        {invoiceLoadingId === orderId ? "Saving…" : "Invoice PDF"}
                      </button>

                      <select
                        disabled={statusUpdatingId === orderId}
                        value={o.status || "processing"}
                        onChange={(e) => handleUpdateStatus(orderId, e.target.value)}
                        className={selectStyle}
                      >
                        <option value="processing">processing</option>
                        <option value="in_transit">in-transit</option>
                        <option value="delivered">delivered</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-5 border-t border-white/10 pt-4 space-y-3">
                      <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60">
                        Items
                      </p>

                      {items.length === 0 ? (
                        <p className="text-sm text-gray-300/70">Loading items…</p>
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
                                <div className="w-14 h-14 rounded-2xl bg-black/20 border border-white/10 overflow-hidden flex items-center justify-center">
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
    </PageShell>
  );
}

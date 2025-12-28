"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

/* Stacked actions (same size) */
const actionStackBtn =
  "h-10 w-full rounded-2xl border border-white/10 bg-white/5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-100 hover:bg-white/10 transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";

const actionPrimaryStackBtn =
  "h-10 w-full rounded-2xl bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] text-black text-[10px] font-semibold uppercase tracking-[0.18em] hover:opacity-95 transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";

/* Prettier dropdown button */
const dropdownBtn =
  "h-10 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-white hover:bg-white/10 transition disabled:opacity-60 disabled:cursor-not-allowed";

/**
 * FIXED dropdown:
 * - Uses a Portal to render in document.body (so it stays on top of EVERYTHING)
 * - Uses position: fixed with anchor rect (so it doesn't get covered/clipped)
 * - Options show only once (no repeated chips)
 * - Has max-height with scrolling so menu is always fully visible
 */
function StatusDropdown({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef(null);

  const options = [
    { value: "processing", label: "Processing", dot: "bg-white/60" },
    { value: "in_transit", label: "In Transit", dot: "bg-amber-400/80" },
    { value: "delivered", label: "Delivered", dot: "bg-emerald-400/80" },
    { value: "cancelled", label: "Cancelled", dot: "bg-rose-400/80" },
  ];

  const current = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  function computePosition() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8;

    // Default below button
    let top = r.bottom + gap;
    let left = r.left;
    let width = r.width;

    // Keep within viewport horizontally
    const padding = 10;
    const maxLeft = window.innerWidth - width - padding;
    if (left > maxLeft) left = Math.max(padding, maxLeft);
    if (left < padding) left = padding;

    // If would go off-screen vertically, flip above
    const estimatedMenuHeight = 240; // safe estimate
    if (top + estimatedMenuHeight > window.innerHeight - padding) {
      top = Math.max(padding, r.top - gap - estimatedMenuHeight);
    }

    setPos({ top, left, width });
  }

  useEffect(() => {
    if (!open) return;
    computePosition();

    function onDocMouseDown(e) {
      const btn = btnRef.current;
      if (!btn) return;

      // If click inside button, let toggle handle
      if (btn.contains(e.target)) return;

      // If click inside portal menu, ignore
      const menu = document.getElementById("status-dropdown-portal");
      if (menu && menu.contains(e.target)) return;

      setOpen(false);
    }

    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }

    function onScrollOrResize() {
      computePosition();
    }

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const menu = open ? (
    <div
      id="status-dropdown-portal"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: 999999, // on top of everything
      }}
      className="rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-[0_22px_90px_rgba(0,0,0,0.75)] overflow-hidden"
      role="listbox"
    >
      <div className="p-2 max-h-64 overflow-auto">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setOpen(false);
                onChange(opt.value);
              }}
              className={[
                "w-full rounded-xl px-3 py-3 text-left transition flex items-center justify-between gap-3",
                active ? "bg-white/10" : "hover:bg-white/10",
              ].join(" ")}
              role="option"
              aria-selected={active}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`h-2.5 w-2.5 rounded-full ${opt.dot}`} />
                <span className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                  {opt.label}
                </span>
              </div>
              {active && (
                <span className="text-[11px] text-white/80 font-semibold">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((s) => !s)}
        className={dropdownBtn}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="truncate">{current.label}</span>
          <span className="text-white/70">▾</span>
        </div>
      </button>

      {mounted && open && typeof document !== "undefined"
        ? createPortal(menu, document.body)
        : null}
    </>
  );
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

    if (detailsById[String(orderId)]) return;

    try {
      const data = await apiRequest(`/orders/${orderId}`, {
        method: "GET",
        auth: true,
      });

      if (!data || !Array.isArray(data.items)) {
        setMessage("Order details format is invalid.");
        return;
      }

      setDetailsById((prev) => ({ ...prev, [String(orderId)]: data.items }));
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
              const items = detailsById[String(orderId)] || [];

              const itemsSubtotal = items.reduce((sum, it) => {
                const unit = Number(it.unitPrice || 0);
                const qty = Number(it.quantity || 0);
                return sum + unit * qty;
              }, 0);

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
                          <span className="text-[10px] uppercase tracking-wider opacity-60">
                            Customer ID
                          </span>
                          <span className="text-white font-mono">{o.userId}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-wider opacity-60">
                            Total Amount
                          </span>
                          <span className="text-white font-medium">
                            ${Number(o.total || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex flex-col sm:col-span-2 mt-1">
                          <span className="text-[10px] uppercase tracking-wider opacity-60">
                            Delivery Address
                          </span>
                          <span className="text-white leading-relaxed">
                            {o.shippingAddress || o.address || "No address provided"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: Actions (STACKED + SAME SIZE) */}
                    <div className="w-full md:w-52 shrink-0">
                      <div className="flex flex-col gap-2">
                        <StatusDropdown
                          value={o.status || "processing"}
                          disabled={statusUpdatingId === orderId}
                          onChange={(status) => handleUpdateStatus(orderId, status)}
                        />

                        <button
                          type="button"
                          disabled={invoiceLoadingId === orderId}
                          onClick={() => handleDownloadInvoice(orderId)}
                          className={actionStackBtn}
                        >
                          {invoiceLoadingId === orderId ? "Loading…" : "Invoice PDF"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleExpand(orderId)}
                          className={actionPrimaryStackBtn}
                        >
                          {expanded ? "Hide Details" : "View Details"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* EXPANDED: Larger Details */}
                  {expanded && (
                    <div className="mt-7 border-t border-white/10 pt-6 space-y-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-[12px] font-semibold tracking-[0.28em] uppercase text-gray-300/70">
                            Products to Deliver
                          </p>
                          <p className="text-[13px] text-gray-300/80">
                            Created:{" "}
                            <span className="text-white">
                              {o.createdAt ? new Date(o.createdAt).toLocaleString() : "—"}
                            </span>
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-gray-300/70">
                            Items subtotal
                          </p>
                          <p className="text-lg font-semibold text-white">
                            ${Number(itemsSubtotal || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {items.length === 0 ? (
                        <p className="text-base text-gray-300/70">Loading items details…</p>
                      ) : (
                        <div className="space-y-3">
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
                                className="flex flex-col sm:flex-row sm:items-center gap-5 rounded-[26px] border border-white/10 bg-black/25 px-5 py-5"
                              >
                                <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                                  {imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt={p?.name || "Product"}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-[10px] uppercase tracking-widest text-gray-500">
                                      IMG
                                    </span>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <p className="text-base font-semibold text-white truncate">
                                    {p ? p.name : "Unknown Product"}
                                  </p>

                                  <p className="text-[12px] text-gray-300/80 mt-1">
                                    <span className="font-mono text-white/90">
                                      Prod ID: {item.productId}
                                    </span>
                                  </p>

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-200/90">
                                      Qty:{" "}
                                      <span className="ml-2 font-semibold text-white">
                                        {item.quantity}
                                      </span>
                                    </span>
                                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-200/90">
                                      Unit:{" "}
                                      <span className="ml-2 font-semibold text-white">
                                        ${unitPrice.toFixed(2)}
                                      </span>
                                    </span>
                                  </div>
                                </div>

                                <div className="sm:text-right">
                                  <p className="text-[10px] uppercase tracking-[0.22em] text-gray-300/70">
                                    Line total
                                  </p>
                                  <p className="text-xl font-semibold text-white">
                                    ${lineTotal.toFixed(2)}
                                  </p>
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

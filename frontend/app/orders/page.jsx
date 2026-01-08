"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SiteLayout from "../../components/SiteLayout";
import ActionButton from "../../components/ActionButton";
import DripLink from "../../components/DripLink";
import { useAuth } from "../../context/AuthContext";
import {
  cancelOrderApi,
  requestReturnForItemApi,
  getMyReturnRequestsApi,
} from "../../lib/api";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

/* ================== STATUS HELPERS ================== */
function statusBadgeClasses(statusRaw) {
  const status = String(statusRaw || "").toLowerCase();
  const base =
    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border";

  switch (status) {
    case "processing":
      return `${base} bg-amber-500/10 text-amber-200 border-amber-500/25`;
    case "in_transit":
      return `${base} bg-sky-500/10 text-sky-200 border-sky-500/25`;
    case "delivered":
      return `${base} bg-emerald-500/10 text-emerald-200 border-emerald-500/25`;
    case "cancelled":
      return `${base} bg-rose-500/10 text-rose-200 border-rose-500/25`;
    case "refunded":
      return `${base} bg-violet-500/10 text-violet-200 border-violet-500/25`;
    default:
      return `${base} bg-white/5 text-gray-200/80 border-white/10`;
  }
}

function formatStatusLabel(status) {
  return status
    ? String(status)
        .replaceAll("_", " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Unknown";
}

function safeDateLabel(iso) {
  try {
    return iso ? new Date(iso).toLocaleString() : "—";
  } catch {
    return "—";
  }
}

/* Return request status chip */
function returnStatusChip(statusRaw) {
  const status = String(statusRaw || "").toLowerCase();
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border";

  if (status === "requested")
    return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
  if (status === "approved")
    return `${base} border-sky-500/25 bg-sky-500/10 text-sky-200`;
  if (status === "rejected")
    return `${base} border-rose-500/25 bg-rose-500/10 text-rose-200`;
  if (status === "refunded")
    return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
  return `${base} border-white/10 bg-white/5 text-gray-200/80`;
}

function daysSince(dateIso) {
  try {
    if (!dateIso) return Infinity;
    const d = new Date(dateIso);
    const ms = Date.now() - d.getTime();
    return ms / (1000 * 60 * 60 * 24);
  } catch {
    return Infinity;
  }
}

function normalizeImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (String(imageUrl).startsWith("http")) return imageUrl;
  return `${apiBase}${imageUrl}`;
}

function formatPaymentMethodLabel(pmRaw) {
  const pm = String(pmRaw || "credit_card").toLowerCase();
  return pm === "account" ? "Account balance" : "Credit card";
}

/* ================== PAGE ================== */
export default function OrdersPage() {
  const { user, loadingUser } = useAuth();

  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [returnRequests, setReturnRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null); // cancel loading
  const [itemActionLoadingId, setItemActionLoadingId] = useState(null); // per-item return loading

  const isBrowser = typeof window !== "undefined";

  /* ================== LOAD DATA ================== */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const token = isBrowser ? localStorage.getItem("token") : null;
      if (!token) {
        setOrders([]);
        setItems([]);
        setProducts([]);
        setReturnRequests([]);
        setLoading(false);
        return;
      }

      // Orders
      const res = await fetch(`${apiBase}/orders/my`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        setOrders(
          Array.isArray(data?.orders) ? data.orders : Array.isArray(data) ? data : []
        );
        setItems(Array.isArray(data?.items) ? data.items : []);
      } else {
        setOrders([]);
        setItems([]);
      }

      // Return requests (customer)
      try {
        const rr = await getMyReturnRequestsApi();
        setReturnRequests(Array.isArray(rr) ? rr : []);
      } catch {
        setReturnRequests([]);
      }

      // Products (for names/images)
      const prodRes = await fetch(`${apiBase}/products`, { cache: "no-store" });
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(Array.isArray(prodData) ? prodData : []);
      } else {
        setProducts([]);
      }
    } catch {
      setMessage("Failed to load orders.");
      setOrders([]);
      setItems([]);
      setProducts([]);
      setReturnRequests([]);
    } finally {
      setLoading(false);
    }
  }, [isBrowser]);

  useEffect(() => {
    if (!loadingUser && user) loadAll();
    if (!loadingUser && !user) setLoading(false);
  }, [loadingUser, user, loadAll]);

  /* ================== MAPS ================== */
  const productsMap = useMemo(() => {
    const m = new Map();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const itemsByOrderId = useMemo(() => {
    const m = new Map();
    items.forEach((i) => {
      const arr = m.get(i.orderId) || [];
      arr.push(i);
      m.set(i.orderId, arr);
    });
    return m;
  }, [items]);

  const returnByItemId = useMemo(() => {
    const m = new Map();
    (returnRequests || []).forEach((r) => {
      if (r?.orderItemId != null) m.set(r.orderItemId, r);
    });
    return m;
  }, [returnRequests]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
  }, [orders]);

  const sortedReturns = useMemo(() => {
    return [...(returnRequests || [])].sort((a, b) => {
      const da = a?.requestedAt ? new Date(a.requestedAt).getTime() : 0;
      const db = b?.requestedAt ? new Date(b.requestedAt).getTime() : 0;
      return db - da;
    });
  }, [returnRequests]);

  /* ================== INVOICE ================== */
  async function handleDownloadInvoice(orderId) {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      setInvoiceLoadingId(orderId);

      const res = await fetch(`${apiBase}/invoice/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice_${orderId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setInvoiceLoadingId(null);
    }
  }

  /* ================== CANCEL ================== */
  async function handleCancel(order) {
    const status = String(order?.status || "").toLowerCase();
    if (status !== "processing") {
      setMessage('This order can only be cancelled while it is in "processing" status.');
      return;
    }

    const ok = window.confirm(`Cancel Order #${order.id}?`);
    if (!ok) return;

    setActionLoadingId(order.id);
    setMessage("");

    try {
      await cancelOrderApi(order.id);
      setMessage("Order cancelled.");
      await loadAll();
    } catch (err) {
      setMessage(err?.message || "Could not cancel the order.");
    } finally {
      setActionLoadingId(null);
    }
  }

  /* ================== SELECTIVE RETURN (per item) ================== */
  async function handleRequestReturn(order, item) {
    const status = String(order?.status || "").toLowerCase();
    if (status !== "delivered") {
      setMessage('Returns can only be requested when the order is "delivered".');
      return;
    }

    const ageDays = daysSince(order.createdAt);
    if (!(ageDays <= 30)) {
      setMessage("Returns can only be requested within 30 days of purchase.");
      return;
    }

    const existing = returnByItemId.get(item.id);
    if (existing) {
      setMessage("A return request already exists for this item.");
      return;
    }

    const reason = window.prompt("Reason for return (optional):", "") || "";
    const ok = window.confirm(
      `Request return for item #${item.id} in Order #${order.id}?`
    );
    if (!ok) return;

    setItemActionLoadingId(item.id);
    setMessage("");

    try {
      await requestReturnForItemApi(order.id, item.id, reason.trim() || undefined);
      setMessage("Return request submitted. A sales manager will review it.");
      await loadAll();
    } catch (err) {
      setMessage(err?.message || "Could not submit return request.");
    } finally {
      setItemActionLoadingId(null);
    }
  }

  /* ================== AUTH GATES ================== */
  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-300/70">Checking your account…</p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-6 py-6">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Orders
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Your order history
            </h1>
            <p className="text-sm text-gray-300/70">
              Sign in to view your past drops and invoices.
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
              Register
            </DripLink>
          </div>
        </div>
      </SiteLayout>
    );
  }

  /* ================== UI ================== */
  return (
    <SiteLayout>
      <div className="space-y-8 py-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Sneaks-up
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Your Orders
            </h1>
            <p className="text-sm text-gray-300/70">
              Track every drop you’ve locked in. Delivered items can be returned within 30 days.
            </p>
          </div>

          <DripLink
            href="/products"
            className="
              h-10 px-5 inline-flex items-center justify-center rounded-full
              border border-border bg-white/5 text-[11px] font-semibold uppercase tracking-[0.18em]
              text-gray-100 hover:bg-white/10 transition active:scale-[0.98]
            "
          >
            Browse drops
          </DripLink>
        </div>

        {message && (
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-gray-200/80">
            {message}
          </div>
        )}

        {loading && (
          <div className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-5 text-[11px] text-gray-300/70">
            Loading your orders…
          </div>
        )}

        {!loading && sortedOrders.length === 0 && (
          <div className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-6 text-center shadow-[0_16px_60px_rgba(0,0,0,0.40)]">
            <p className="text-sm text-gray-300/70">You haven’t placed any orders yet.</p>
            <DripLink
              href="/products"
              className="
                inline-flex mt-4 h-10 px-5 items-center justify-center rounded-full
                bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                text-black text-[11px] font-semibold uppercase tracking-[0.18em]
                hover:opacity-95 transition active:scale-[0.98]
              "
            >
              Browse drops
            </DripLink>
          </div>
        )}

        {/* ✅ RETURN REQUESTS LIST (visible proof requirement) */}
        {!loading && (
          <div className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-5 shadow-[0_16px_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-300/70">
                My Return Requests
              </p>
              <span className="text-[11px] text-gray-300/60">
                {sortedReturns.length} request{sortedReturns.length !== 1 ? "s" : ""}
              </span>
            </div>

            {sortedReturns.length === 0 ? (
              <p className="mt-3 text-[11px] text-gray-300/60">
                No return requests yet.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {sortedReturns.slice(0, 6).map((rr) => (
                  <div
                    key={rr.id}
                    className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-white truncate">
                        Order #{rr.orderId} • Item #{rr.orderItemId}
                      </p>
                      <p className="text-[11px] text-gray-300/60">
                        {rr.refundAmount ? `Refund: $${Number(rr.refundAmount).toFixed(2)} • ` : ""}
                        {rr.refundMethod ? `To: ${formatPaymentMethodLabel(rr.refundMethod)}` : ""}
                      </p>
                    </div>

                    <span className={returnStatusChip(rr.status)}>
                      {String(rr.status || "").toUpperCase()}
                    </span>
                  </div>
                ))}
                {sortedReturns.length > 6 && (
                  <p className="text-[10px] text-gray-300/45 uppercase tracking-[0.18em] pt-1">
                    Showing latest 6 requests.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ORDERS LIST */}
        <div className="space-y-6">
          {sortedOrders.map((order) => {
            const orderItems = itemsByOrderId.get(order.id) || [];
            const status = String(order?.status || "").toLowerCase();

            const canCancel = status === "processing";
            const busyOrder = actionLoadingId === order.id;

            const deliveredAndInWindow =
              status === "delivered" && daysSince(order.createdAt) <= 30;

            return (
              <div
                key={order.id}
                className="
                  rounded-[32px] border border-border bg-black/20 backdrop-blur
                  p-5 sm:p-6 shadow-[0_16px_60px_rgba(0,0,0,0.45)]
                  space-y-5
                "
              >
                {/* TOP BAR */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-white">Order #{order.id}</p>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-gray-300/60">
                      {safeDateLabel(order.createdAt)}
                    </p>
                    <p className="text-[11px] text-gray-300/60">
                      Paid via{" "}
                      <span className="text-gray-100 font-semibold">
                        {formatPaymentMethodLabel(order.paymentMethod)}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
                    <span className={statusBadgeClasses(order.status)}>
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--drip-accent)]" />
                      {formatStatusLabel(order.status)}
                    </span>

                    {/* Cancel (processing only) */}
                    <ActionButton
                      onClick={() => handleCancel(order)}
                      disabled={!canCancel || busyOrder}
                    >
                      {busyOrder && canCancel ? "Cancelling…" : "Cancel"}
                    </ActionButton>
                  </div>
                </div>

                {/* ITEMS GRID */}
                <div className="grid gap-4 md:grid-cols-2">
                  {orderItems.map((item) => {
                    const p = productsMap.get(item.productId);
                    const img = normalizeImageUrl(p?.imageUrl);

                    const rr = returnByItemId.get(item.id);
                    const busyItem = itemActionLoadingId === item.id;

                    const canRequestReturn = deliveredAndInWindow && !rr;

                    return (
                      <div
                        key={item.id}
                        className="
                          rounded-[26px] border border-white/10 bg-black/25
                          p-4 flex gap-4
                        "
                      >
                        <div className="w-28 sm:w-32 aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                          {img ? (
                            <img
                              src={img}
                              alt={p?.name || "Product"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] uppercase tracking-[0.2em] text-gray-300/50">
                              No image
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-semibold text-white truncate">
                                {p?.name || `Product #${item.productId}`}
                              </p>

                              {rr ? (
                                <span className={returnStatusChip(rr.status)}>
                                  {String(rr.status).toUpperCase()}
                                </span>
                              ) : null}
                            </div>

                            <p className="text-[11px] text-gray-300/60 line-clamp-2">
                              Qty {item.quantity} · ${Number(item.unitPrice).toFixed(2)} each
                            </p>

                            {rr && String(rr.status) === "refunded" && rr.refundAmount != null ? (
                              <p className="text-[11px] text-emerald-200/90">
                                Refunded: ${Number(rr.refundAmount).toFixed(2)}{" "}
                                {rr.refundMethod ? `to ${formatPaymentMethodLabel(rr.refundMethod)}` : ""}
                              </p>
                            ) : null}
                          </div>

                          <div className="pt-3 flex items-center justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-gray-300/60">
                                Line total
                              </p>
                              <p className="text-sm font-semibold text-white">
                                ${(item.quantity * item.unitPrice).toFixed(2)}
                              </p>
                            </div>

                            {/* ✅ Selective return button */}
                            <ActionButton
                              onClick={() => handleRequestReturn(order, item)}
                              disabled={!canRequestReturn || busyItem}
                            >
                              {busyItem
                                ? "Requesting…"
                                : rr
                                ? "Return requested"
                                : "Request return"}
                            </ActionButton>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* FOOTER */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between sm:justify-start gap-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-gray-300/60">
                      Total
                    </p>
                    <p className="text-lg font-semibold text-white">
                      ${Number(order.total || 0).toFixed(2)}
                    </p>
                  </div>

                  <ActionButton
                    onClick={() => handleDownloadInvoice(order.id)}
                    disabled={invoiceLoadingId === order.id}
                  >
                    {invoiceLoadingId === order.id ? "Preparing…" : "Invoice"}
                  </ActionButton>
                </div>

                {/* rule hint */}
                <div className="text-[10px] text-gray-300/45 uppercase tracking-[0.18em] pt-1">
                  {canCancel
                    ? 'You can cancel while status is "processing".'
                    : status === "delivered"
                    ? deliveredAndInWindow
                      ? "You can request returns per item within 30 days of purchase."
                      : "Return window closed (more than 30 days since purchase)."
                    : 'Return eligible only after status is "delivered".'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SiteLayout>
  );
}

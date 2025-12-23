"use client";

import { useEffect, useMemo, useState } from "react";
import SiteLayout from "../../components/SiteLayout";
import ActionButton from "../../components/ActionButton";
import DripLink from "../../components/DripLink";
import { useAuth } from "../../context/AuthContext";

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

/* ================== STATUS HELPERS ================== */
function statusBadgeClasses(status) {
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
      return `${base} bg-red-500/10 text-red-200 border-red-500/25`;
    default:
      return `${base} bg-white/5 text-gray-200/80 border-white/10`;
  }
}

function formatStatusLabel(status) {
  return status
    ? status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Unknown";
}

function safeDateLabel(iso) {
  try {
    return iso ? new Date(iso).toLocaleString() : "—";
  } catch {
    return "—";
  }
}

/* ================== PAGE ================== */
export default function OrdersPage() {
  const { user, loadingUser } = useAuth();

  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);

  const isBrowser = typeof window !== "undefined";

  /* ================== LOAD DATA ================== */
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setMessage("");

      try {
        const token = isBrowser ? localStorage.getItem("token") : null;
        if (!token) {
          setOrders([]);
          setItems([]);
          setProducts([]);
          setLoading(false);
          return;
        }

        const res = await fetch(`${apiBase}/orders/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || data || []);
          setItems(data.items || []);
        } else {
          setOrders([]);
          setItems([]);
        }

        const prodRes = await fetch(`${apiBase}/products`);
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          setProducts(Array.isArray(prodData) ? prodData : []);
        } else {
          setProducts([]);
        }
      } catch {
        setMessage("Failed to load orders.");
      } finally {
        setLoading(false);
      }
    }

    if (!loadingUser && user) loadAll();
    if (!loadingUser && !user) setLoading(false);
  }, [loadingUser, user, isBrowser]);

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

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
  }, [orders]);

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
              Track every drop you’ve locked in.
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
            <p className="text-sm text-gray-300/70">
              You haven’t placed any orders yet.
            </p>
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

        {/* ORDERS LIST */}
        <div className="space-y-6">
          {sortedOrders.map((order) => {
            const orderItems = itemsByOrderId.get(order.id) || [];

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
                    <p className="text-base font-semibold text-white">
                      Order #{order.id}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-gray-300/60">
                      {safeDateLabel(order.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={statusBadgeClasses(order.status)}>
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--drip-accent)]" />
                      {formatStatusLabel(order.status)}
                    </span>
                  </div>
                </div>

                {/* ITEMS GRID (BIGGER CARDS) */}
                <div className="grid gap-4 md:grid-cols-2">
                  {orderItems.map((item) => {
                    const p = productsMap.get(item.productId);
                    const img = p?.imageUrl ? `${apiBase}${p.imageUrl}` : null;

                    return (
                      <div
                        key={item.id}
                        className="
                          rounded-[26px] border border-white/10 bg-black/25
                          p-4 flex gap-4
                        "
                      >
                        {/* image */}
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

                        {/* text */}
                        <div className="min-w-0 flex-1 flex flex-col justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-white truncate">
                              {p?.name || `Product #${item.productId}`}
                            </p>
                            <p className="text-[11px] text-gray-300/60 line-clamp-2">
                              Qty {item.quantity} · ${Number(item.unitPrice).toFixed(2)} each
                            </p>
                          </div>

                          <div className="pt-3 flex items-center justify-between gap-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-gray-300/60">
                              Line total
                            </p>
                            <p className="text-sm font-semibold text-white">
                              ${(item.quantity * item.unitPrice).toFixed(2)}
                            </p>
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
              </div>
            );
          })}
        </div>
      </div>
    </SiteLayout>
  );
}

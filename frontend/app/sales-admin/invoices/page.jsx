"use client";

import { useMemo, useState } from "react";
import DripLink from "../../../components/DripLink";
import {
  clearStoredTokens,
  downloadInvoicePdfBlob,
  getInvoicesRangeApi,
} from "../../../lib/api";

function panelClass() {
  return "rounded-[28px] border border-border bg-black/25 backdrop-blur p-5 shadow-[0_16px_60px_rgba(0,0,0,0.45)]";
}

function fmtDate(dt) {
  if (!dt) return "—";
  try {
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return String(dt);
    return d.toLocaleString();
  } catch {
    return String(dt);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "invoice.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

export default function SalesInvoicesPage() {
  const [from, setFrom] = useState(""); // yyyy-mm-dd
  const [to, setTo] = useState(""); // yyyy-mm-dd
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [message, setMessage] = useState("");
  const [invoices, setInvoices] = useState([]);

  const canSearch = useMemo(() => Boolean(from && to), [from, to]);

  async function handleSearch() {
    setMessage("");

    if (!from || !to) {
      setMessage("Pick both From and To dates.");
      return;
    }
    if (new Date(from) > new Date(to)) {
      setMessage("From date must be before To date.");
      return;
    }

    setLoading(true);
    try {
      const data = await getInvoicesRangeApi(from, to);

      const list =
        (Array.isArray(data) && data) ||
        (Array.isArray(data?.invoices) && data.invoices) ||
        (Array.isArray(data?.orders) && data.orders) ||
        [];

      setInvoices(list);
      if (list.length === 0) setMessage("No invoices found for this range.");
    } catch (err) {
      console.error("Invoices fetch error:", err);
      if (handleAuthRedirect(err, "/sales-admin/invoices")) return;
      setInvoices([]);
      setMessage(err?.message || "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePdf(orderId) {
    setMessage("");
    setDownloadingId(orderId);

    try {
      const blob = await downloadInvoicePdfBlob(orderId);
      downloadBlob(blob, `invoice-${orderId}.pdf`);
      setMessage(`Saved invoice-${orderId}.pdf`);
    } catch (err) {
      console.error("Invoice download error:", err);
      if (handleAuthRedirect(err, "/sales-admin/invoices")) return;
      setMessage(err?.message || "Failed to download invoice PDF.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handlePrint(orderId) {
    setMessage("");
    setDownloadingId(orderId);

    try {
      const blob = await downloadInvoicePdfBlob(orderId);
      const url = URL.createObjectURL(blob);

      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        setMessage("Popup blocked. Allow popups to print.");
        URL.revokeObjectURL(url);
        return;
      }

      w.addEventListener("load", () => {
        try {
          w.focus();
          w.print();
        } catch {}
      });

      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("Invoice print error:", err);
      if (handleAuthRedirect(err, "/sales-admin/invoices")) return;
      setMessage(err?.message || "Failed to open invoice for printing.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
            Sneaks-up · Sales
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Invoices
          </h1>
          <p className="text-sm text-gray-300/70">
            View invoices in a date range, print, or save as PDF.
          </p>
        </div>

        <DripLink
          href="/sales-admin"
          className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
        >
          Back to sales panel →
        </DripLink>
      </div>

      {message && (
        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-gray-200/80">
          {message}
        </div>
      )}

      <div className={panelClass()}>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300/70">
              From
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 w-full rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/15"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300/70">
              To
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 w-full rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/15"
            />
          </div>

          <button
            type="button"
            disabled={!canSearch || loading}
            onClick={handleSearch}
            className="
              h-10 px-5 rounded-full
              bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
              text-black text-[11px] font-semibold uppercase tracking-[0.18em]
              hover:opacity-95 transition active:scale-[0.98]
              disabled:opacity-60 disabled:cursor-not-allowed
            "
          >
            {loading ? "Loading…" : "Search"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {invoices.map((inv) => {
          const orderId = inv.id ?? inv.orderId ?? inv.order_id;
          const total = Number(inv.total ?? inv.amount ?? inv.totalAmount ?? 0);

          return (
            <div key={orderId} className={panelClass()}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300/70">
                    Invoice #{orderId}
                  </p>
                  <p className="text-sm text-white font-semibold">
                    ${Number.isNaN(total) ? "0.00" : total.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-gray-300/60">
                    Created: {fmtDate(inv.createdAt ?? inv.created_at ?? inv.date)}
                  </p>
                  <p className="text-[11px] text-gray-300/60">
                    Status: {inv.status || "—"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={downloadingId === orderId}
                    onClick={() => handlePrint(orderId)}
                    className="
                      h-10 px-5 rounded-full border border-border bg-white/5
                      text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100
                      hover:bg-white/10 transition active:scale-[0.98]
                      disabled:opacity-60 disabled:cursor-not-allowed
                    "
                  >
                    {downloadingId === orderId ? "Opening…" : "Print"}
                  </button>

                  <button
                    type="button"
                    disabled={downloadingId === orderId}
                    onClick={() => handleSavePdf(orderId)}
                    className="
                      h-10 px-5 rounded-full
                      bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                      text-black text-[11px] font-semibold uppercase tracking-[0.18em]
                      hover:opacity-95 transition active:scale-[0.98]
                      disabled:opacity-60 disabled:cursor-not-allowed
                    "
                  >
                    {downloadingId === orderId ? "Saving…" : "Save PDF"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && invoices.length === 0 && (
          <div className={panelClass()}>
            <p className="text-sm text-gray-300/70">
              Pick a date range and click Search.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

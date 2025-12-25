"use client";

import { useMemo, useState } from "react";
import DripLink from "../../../components/DripLink";
import ActionButton from "../../../components/ActionButton";
import { getInvoicesRangeApi, downloadInvoicePdfBlob } from "../../../lib/api";

function panelClass() {
  return "rounded-[28px] border border-border bg-black/25 backdrop-blur p-5 shadow-[0_16px_60px_rgba(0,0,0,0.45)]";
}

function chip(tone = "muted") {
  const base =
    "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border";
  if (tone === "live")
    return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
  if (tone === "warn")
    return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
  return `${base} border-white/10 bg-white/5 text-gray-200/80`;
}

function formatDateTime(v) {
  try {
    return v ? new Date(v).toLocaleString() : "—";
  } catch {
    return "—";
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

async function printPdfBlob(blob) {
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener,noreferrer");

  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error("Popup blocked. Allow popups to print.");
  }

  // Print after load
  w.addEventListener("load", () => {
    try {
      w.focus();
      w.print();
    } catch {}
  });

  // Cleanup after a minute
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function AdminInvoicesPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [invoices, setInvoices] = useState([]);

  const [busyId, setBusyId] = useState(null); // for print/download

  const totalSum = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
  }, [invoices]);

  async function loadInvoices() {
    setMessage("");
    setInvoices([]);

    if (!from || !to) {
      setMessage("Please select both From and To dates.");
      return;
    }
    if (new Date(from) > new Date(to)) {
      setMessage("From date must be before To date.");
      return;
    }

    setLoading(true);
    try {
      const data = await getInvoicesRangeApi(from, to);

      // Accept different shapes just in case
      const list =
        (Array.isArray(data?.invoices) && data.invoices) ||
        (Array.isArray(data?.orders) && data.orders) ||
        (Array.isArray(data) && data) ||
        [];

      setInvoices(list);
      setMessage(`Loaded ${list.length} invoice(s).`);
    } catch (err) {
      console.error("Load invoices error:", err);
      setMessage(err?.message || "Failed to load invoices.");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(orderId) {
    setMessage("");
    setBusyId(orderId);
    try {
      const blob = await downloadInvoicePdfBlob(orderId);
      downloadBlob(blob, `invoice_${orderId}.pdf`);
      setMessage(`Saved invoice_${orderId}.pdf`);
    } catch (err) {
      console.error("Download invoice error:", err);
      setMessage(err?.message || "Invoice download failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePrint(orderId) {
    setMessage("");
    setBusyId(orderId);
    try {
      const blob = await downloadInvoicePdfBlob(orderId);
      await printPdfBlob(blob);
      setMessage("Opened invoice for printing.");
    } catch (err) {
      console.error("Print invoice error:", err);
      setMessage(err?.message || "Failed to open invoice for printing.");
    } finally {
      setBusyId(null);
    }
  }

  // NOTE:
  // Access control + shell handled by app/admin/layout.jsx
  // This page renders content only.

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
            Sneaks-up · Admin
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Invoices
          </h1>
          <p className="text-sm text-gray-300/70">
            View invoices in a date range. Print or save as PDF.
          </p>

          <div className="pt-2 flex flex-wrap gap-2">
            <span className={chip("live")}>Live</span>
            <span className={chip("muted")}>{invoices.length} invoices</span>
            <span className={chip("muted")}>${totalSum.toFixed(2)} total</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DripLink
            href="/admin"
            className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
          >
            Back to dashboard
          </DripLink>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-gray-200/80">
          {message}
        </div>
      )}

      {/* Filter */}
      <div className={panelClass()}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60">
              Date range
            </p>
            <p className="text-sm text-gray-200/80">Choose dates and load invoices.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-[0.2em] text-gray-300/70">
                From
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 w-full sm:w-44 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/15"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-[0.2em] text-gray-300/70">
                To
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 w-full sm:w-44 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/15"
              />
            </div>

            <ActionButton type="button" onClick={loadInvoices} disabled={loading}>
              {loading ? "Loading…" : "Load invoices"}
            </ActionButton>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className={panelClass()}>
          <p className="text-sm text-gray-300/70">Loading…</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className={panelClass()}>
          <p className="text-sm text-gray-300/70">
            No invoices loaded yet (or none in this range).
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const orderId = inv.orderId ?? inv.id ?? inv.order_id;
            const isBusy = busyId === orderId;

            return (
              <div key={orderId} className={panelClass()}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">
                        Invoice / Order #{orderId}
                      </p>
                      <span className={chip("muted")}>{inv.status || "—"}</span>
                    </div>

                    <p className="text-[11px] text-gray-300/60">
                      Date:{" "}
                      <span className="text-gray-100/90">
                        {formatDateTime(inv.createdAt ?? inv.created_at ?? inv.date)}
                      </span>
                    </p>

                    <p className="text-[11px] text-gray-300/60">
                      Customer:{" "}
                      <span className="text-gray-100/90">
                        {inv.customer?.fullName || inv.customer?.name || "—"}
                      </span>{" "}
                      ·{" "}
                      <span className="text-gray-100/90">
                        {inv.customer?.email || "—"}
                      </span>
                    </p>

                    <p className="text-[11px] text-gray-300/60">
                      Ship to:{" "}
                      <span className="text-gray-100/90">
                        {inv.shippingAddress || "—"}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-2">
                    <p className="text-lg font-semibold text-white">
                      ${Number(inv.total || 0).toFixed(2)}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <ActionButton
                        type="button"
                        onClick={() => handlePrint(orderId)}
                        disabled={isBusy}
                      >
                        {isBusy ? "Opening…" : "Print"}
                      </ActionButton>

                      <ActionButton
                        type="button"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => handleDownload(orderId)}
                      >
                        {isBusy ? "Saving…" : "Download PDF"}
                      </ActionButton>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

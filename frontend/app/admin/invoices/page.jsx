"use client";

import { useMemo, useState } from "react";
import SiteLayout from "../../../components/SiteLayout";
import DripLink from "../../../components/DripLink";
import ActionButton from "../../../components/ActionButton";
import { useAuth } from "../../../context/AuthContext";
import { getInvoicesRangeApi, downloadInvoicePdfBlob } from "../../../lib/api";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

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

export default function AdminInvoicesPage() {
  const { user, loadingUser } = useAuth();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [invoices, setInvoices] = useState([]);

  const [downloadBusyId, setDownloadBusyId] = useState(null);

  function hasInvoiceAccess() {
    // Best effort:
    // - admin is roleId===1 in your UI logic
    // - sales_manager expected via roleName (if your /auth/me includes it)
    if (!user) return false;
    if (user.roleId === 1) return true;
    if (user.roleName === "sales_manager") return true;
    return false;
  }

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

    setLoading(true);
    try {
      const data = await getInvoicesRangeApi(from, to);
      const list = Array.isArray(data?.invoices) ? data.invoices : [];
      setInvoices(list);
      setMessage(`Loaded ${list.length} invoice(s).`);
    } catch (err) {
      console.error("Load invoices error:", err);
      setMessage(err?.message || "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }

  function openInvoicePdf(orderId) {
    // Open inline PDF viewer; user can Print or Save as PDF from browser
    const url = `${apiBase}/invoice/${orderId}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function downloadInvoicePdf(orderId) {
    setMessage("");
    setDownloadBusyId(orderId);

    try {
      const blob = await downloadInvoicePdfBlob(orderId);
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice_${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download invoice error:", err);
      setMessage(err?.message || "Invoice download failed.");
    } finally {
      setDownloadBusyId(null);
    }
  }

  // AUTH gates
  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-300/70">Checking access…</p>
      </SiteLayout>
    );
  }

  if (!user || !hasInvoiceAccess()) {
    return (
      <SiteLayout>
        <div className="space-y-4 py-6">
          <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
            Admin
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Invoices
          </h1>
          <p className="text-sm text-gray-300/70">
            You need admin or sales manager permissions to view invoices.
          </p>
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
              Invoices
            </h1>
            <p className="text-sm text-gray-300/70">
              View all invoices in a date range. Open to print or save as PDF.
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
              <p className="text-sm text-gray-200/80">
                Choose dates and load invoices.
              </p>
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
            {invoices.map((inv) => (
              <div key={inv.orderId} className={panelClass()}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">
                        Invoice / Order #{inv.orderId}
                      </p>
                      <span className={chip("muted")}>{inv.status}</span>
                    </div>
                    <p className="text-[11px] text-gray-300/60">
                      Date:{" "}
                      <span className="text-gray-100/90">
                        {formatDateTime(inv.createdAt)}
                      </span>
                    </p>
                    <p className="text-[11px] text-gray-300/60">
                      Customer:{" "}
                      <span className="text-gray-100/90">
                        {inv.customer?.fullName || "—"}
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
                        onClick={() => openInvoicePdf(inv.orderId)}
                      >
                        Open / Print
                      </ActionButton>

                      <ActionButton
                        type="button"
                        variant="outline"
                        disabled={downloadBusyId === inv.orderId}
                        onClick={() => downloadInvoicePdf(inv.orderId)}
                      >
                        {downloadBusyId === inv.orderId ? "Downloading…" : "Download PDF"}
                      </ActionButton>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

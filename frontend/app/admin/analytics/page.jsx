"use client";

import { useEffect, useMemo, useState } from "react";
import SiteLayout from "../../../components/SiteLayout";
import DripLink from "../../../components/DripLink";
import ActionButton from "../../../components/ActionButton";
import { useAuth } from "../../../context/AuthContext";
import { getAnalyticsSummaryApi, getInvoicesRangeApi, downloadInvoicePdfBlob } from "../../../lib/api";

// Recharts
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";

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

// YYYY-MM-DD
function fmtDateInput(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdminAnalyticsPage() {
  const { user, loadingUser } = useAuth();

  // Default: last 30 days
  const defaultTo = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }, []);

  const [from, setFrom] = useState(fmtDateInput(defaultFrom));
  const [to, setTo] = useState(fmtDateInput(defaultTo));

  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
  const [message, setMessage] = useState("");

  async function loadAll() {
    setLoading(true);
    setMessage("");

    try {
      const s = await getAnalyticsSummaryApi(from, to);
      setSummary(s);

      const inv = await getInvoicesRangeApi(from, to);
      setInvoices(inv?.invoices || []);
    } catch (err) {
      console.error("Analytics load error:", err);
      setSummary(null);
      setInvoices([]);

      if (err?.status === 401) setMessage("Please login to view analytics.");
      else if (err?.status === 403)
        setMessage("Only sales managers and admins can view analytics/invoices.");
      else setMessage(err?.message || "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!loadingUser && user) loadAll();
    else if (!loadingUser && !user) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingUser, user]);

  const series = summary?.series || [];

  // Charts
  const revenueCostChartData = useMemo(() => {
    return series.map((p) => ({
      date: p.date,
      revenue: Number(p.revenue || 0),
      cost: Number(p.cost || 0),
    }));
  }, [series]);

  const profitChartData = useMemo(() => {
    return series.map((p) => ({
      date: p.date,
      profit: Number(p.profit || 0),
    }));
  }, [series]);

  async function handleOpenInvoice(orderId) {
    try {
      setInvoiceLoadingId(orderId);
      setMessage("");

      const blob = await downloadInvoicePdfBlob(orderId);
      const url = URL.createObjectURL(blob);

      // Open in new tab (print/save from browser PDF viewer)
      window.open(url, "_blank", "noopener,noreferrer");

      // We revoke later; browser may still need it, so delay a bit
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("Open invoice error:", err);
      setMessage(err?.message || "Failed to open invoice PDF.");
      window.alert(err?.message || "Failed to open invoice PDF.");
    } finally {
      setInvoiceLoadingId(null);
    }
  }

  async function handleDownloadInvoice(orderId) {
    try {
      setInvoiceLoadingId(orderId);
      setMessage("");

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
      setMessage(err?.message || "Failed to download invoice PDF.");
      window.alert(err?.message || "Failed to download invoice PDF.");
    } finally {
      setInvoiceLoadingId(null);
    }
  }

  // -------- AUTH GATES --------
  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-300/70">Checking access…</p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-6 py-6">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Management
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Analytics & invoices
            </h1>
            <p className="text-sm text-gray-300/70 max-w-md">
              Please login to view analytics and invoices.
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
              href="/"
              className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white self-center"
            >
              Back to homepage
            </DripLink>
          </div>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="space-y-6 py-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Sneaks-up · Management
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Analytics & invoices
            </h1>
            <p className="text-sm text-gray-300/70 max-w-2xl">
              Select a date range to view invoices, revenue, cost, and profit/loss charts.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <DripLink
              href="/admin"
              className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
            >
              Back to dashboard
            </DripLink>
          </div>
        </div>

        {/* RANGE CONTROLS */}
        <div className={panelClass()}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
                  From
                </span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="
                    h-10 w-full rounded-full border border-white/10 bg-white/5
                    px-4 text-[12px] text-gray-100
                    focus:outline-none focus:ring-2 focus:ring-white/15
                  "
                />
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
                  To
                </span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="
                    h-10 w-full rounded-full border border-white/10 bg-white/5
                    px-4 text-[12px] text-gray-100
                    focus:outline-none focus:ring-2 focus:ring-white/15
                  "
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionButton type="button" onClick={loadAll} disabled={loading}>
                {loading ? "Loading…" : "Apply range"}
              </ActionButton>
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-gray-200/80">
              {message}
            </div>
          )}
        </div>

        {/* METRICS */}
        <div className="grid gap-3 sm:grid-cols-4">
          <div className={metricCard("green")}>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Revenue
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              ${Number(summary?.revenue || 0).toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-gray-300/55">Non-cancelled</p>
          </div>

          <div className={metricCard("amber")}>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Cost
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              ${Number(summary?.cost || 0).toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-gray-300/55">
              Uses product cost, fallback 50%
            </p>
          </div>

          <div className={metricCard(Number(summary?.profit || 0) >= 0 ? "blue" : "red")}>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Profit / Loss
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              ${Number(summary?.profit || 0).toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-gray-300/55">Revenue − Cost</p>
          </div>

          <div className={metricCard("neutral")}>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Orders
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {Number(summary?.orderCount || 0)}
            </p>
            <p className="mt-1 text-[11px] text-gray-300/55">In range</p>
          </div>
        </div>

        {/* CHARTS */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* PROFIT LINE */}
          <div className={`${panelClass()} lg:col-span-2`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Profit over time</h2>
                <p className="text-[11px] text-gray-300/55">Daily profit (Revenue − Cost)</p>
              </div>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border border-white/10 bg-white/5 text-gray-200/80">
                {profitChartData.length} points
              </span>
            </div>

            <div className="mt-4 h-72">
              {loading ? (
                <div className="flex items-center justify-center h-full text-xs text-gray-300/60">
                  Loading chart…
                </div>
              ) : profitChartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-gray-300/60">
                  Not enough data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={profitChartData}>
                    <CartesianGrid strokeDasharray="4 4" opacity={0.12} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickMargin={8} />
                    <YAxis tick={{ fontSize: 10 }} tickMargin={4} width={52} />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        background: "rgba(0,0,0,0.9)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 12,
                        color: "white",
                      }}
                      formatter={(val) => [`$${Number(val).toFixed(2)}`, "Profit"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="rgba(255,255,255,0.95)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* REVENUE vs COST BAR */}
          <div className={panelClass()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Revenue vs cost</h2>
                <p className="text-[11px] text-gray-300/55">Daily totals</p>
              </div>
            </div>

            <div className="mt-4 h-72">
              {loading ? (
                <div className="flex items-center justify-center h-full text-xs text-gray-300/60">
                  Loading chart…
                </div>
              ) : revenueCostChartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-gray-300/60">
                  Not enough data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueCostChartData}>
                    <CartesianGrid strokeDasharray="4 4" opacity={0.12} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickMargin={10} />
                    <YAxis tick={{ fontSize: 10 }} tickMargin={4} width={52} />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        background: "rgba(0,0,0,0.9)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 12,
                        color: "white",
                      }}
                      formatter={(val, name) => [`$${Number(val).toFixed(2)}`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, color: "white" }} />
                    <Bar dataKey="revenue" fill="rgba(255,255,255,0.9)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="cost" fill="rgba(255,255,255,0.45)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* INVOICES LIST */}
        <div className={panelClass()}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Invoices in range</h2>
              <p className="text-[11px] text-gray-300/55">
                Open to print, or download to save as PDF.
              </p>
            </div>

            <span className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border border-white/10 bg-white/5 text-gray-200/80">
              {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {loading ? (
              <p className="text-sm text-gray-300/70">Loading invoices…</p>
            ) : invoices.length === 0 ? (
              <p className="text-sm text-gray-300/70">
                No invoices found in this date range.
              </p>
            ) : (
              invoices.map((inv) => (
                <div
                  key={inv.orderId}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-[22px] border border-white/10 bg-white/5 px-4 py-4"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">Invoice / Order #{inv.orderId}</p>
                    <p className="text-[11px] text-gray-300/60">
                      {inv.createdAt ? new Date(inv.createdAt).toLocaleString() : "—"} ·{" "}
                      ${Number(inv.total || 0).toFixed(2)}
                    </p>
                    <p className="text-[11px] text-gray-300/60">
                      Customer:{" "}
                      <span className="text-gray-100/90">
                        {inv.customer?.fullName || `User #${inv.customer?.id || "?"}`}
                      </span>
                      {inv.customer?.email ? (
                        <span className="text-gray-300/60"> · {inv.customer.email}</span>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      type="button"
                      onClick={() => handleOpenInvoice(inv.orderId)}
                      disabled={invoiceLoadingId === inv.orderId}
                    >
                      {invoiceLoadingId === inv.orderId ? "Preparing…" : "Open / Print"}
                    </ActionButton>

                    <ActionButton
                      type="button"
                      variant="outline"
                      onClick={() => handleDownloadInvoice(inv.orderId)}
                      disabled={invoiceLoadingId === inv.orderId}
                    >
                      Download
                    </ActionButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* FOOTNOTE */}
        <div className="text-[11px] text-gray-300/55">
          Data sources:{" "}
          <code className="px-1 py-0.5 bg-white/5 border border-white/10 rounded text-[10px]">
            /analytics/summary
          </code>{" "}
          and{" "}
          <code className="px-1 py-0.5 bg-white/5 border border-white/10 rounded text-[10px]">
            /invoice?from&to
          </code>
          .
        </div>
      </div>
    </SiteLayout>
  );
}

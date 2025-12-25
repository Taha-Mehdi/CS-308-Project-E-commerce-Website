// frontend/app/admin/analytics/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import DripLink from "../../../components/DripLink";
import ActionButton from "../../../components/ActionButton";
import {
  getAnalyticsSummaryApi,
  getInvoicesRangeApi,
  downloadInvoicePdfBlob,
} from "../../../lib/api";

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

/* ---------------- UI helpers ---------------- */

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

function fmtDateInput(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ---------------- Page ---------------- */

export default function AdminAnalyticsPage() {
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
  const [busyInvoiceId, setBusyInvoiceId] = useState(null);
  const [message, setMessage] = useState("");

  async function loadAll() {
    setLoading(true);
    setMessage("");

    try {
      const s = await getAnalyticsSummaryApi(from, to);
      setSummary(s);

      const inv = await getInvoicesRangeApi(from, to);
      setInvoices(inv?.invoices || inv || []);
    } catch (err) {
      console.error("Analytics load error:", err);
      setSummary(null);
      setInvoices([]);
      setMessage(err?.message || "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const series = summary?.series || [];

  const revenueCostChartData = useMemo(
    () =>
      series.map((p) => ({
        date: p.date,
        revenue: Number(p.revenue || 0),
        cost: Number(p.cost || 0),
      })),
    [series]
  );

  const profitChartData = useMemo(
    () =>
      series.map((p) => ({
        date: p.date,
        profit: Number(p.profit || 0),
      })),
    [series]
  );

  async function handleDownloadInvoice(orderId) {
    try {
      setBusyInvoiceId(orderId);
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
      console.error(err);
      alert(err?.message || "Failed to download invoice.");
    } finally {
      setBusyInvoiceId(null);
    }
  }

  /* ---------------- Render ---------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
            Sneaks-up · Admin
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Analytics & profit
          </h1>
          <p className="text-sm text-gray-300/70 max-w-2xl">
            Revenue, cost, and profit/loss across a date range.
          </p>
        </div>

        <DripLink
          href="/admin"
          className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
        >
          Back to dashboard
        </DripLink>
      </div>

      {/* Range controls */}
      <div className={panelClass()}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[11px] uppercase tracking-[0.22em] text-gray-300/60">
                From
              </span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white"
              />
            </label>

            <label className="space-y-2">
              <span className="text-[11px] uppercase tracking-[0.22em] text-gray-300/60">
                To
              </span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white"
              />
            </label>
          </div>

          <ActionButton type="button" onClick={loadAll} disabled={loading}>
            {loading ? "Loading…" : "Apply range"}
          </ActionButton>
        </div>

        {message && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-gray-200/80">
            {message}
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className={metricCard("green")}>
          <p className="text-[11px] uppercase tracking-[0.22em] text-gray-300/60">
            Revenue
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            ${Number(summary?.revenue || 0).toFixed(2)}
          </p>
        </div>

        <div className={metricCard("amber")}>
          <p className="text-[11px] uppercase tracking-[0.22em] text-gray-300/60">
            Cost
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            ${Number(summary?.cost || 0).toFixed(2)}
          </p>
        </div>

        <div
          className={metricCard(
            Number(summary?.profit || 0) >= 0 ? "blue" : "red"
          )}
        >
          <p className="text-[11px] uppercase tracking-[0.22em] text-gray-300/60">
            Profit / Loss
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            ${Number(summary?.profit || 0).toFixed(2)}
          </p>
        </div>

        <div className={metricCard()}>
          <p className="text-[11px] uppercase tracking-[0.22em] text-gray-300/60">
            Orders
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {Number(summary?.orderCount || 0)}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${panelClass()} lg:col-span-2`}>
          <h2 className="text-sm font-semibold text-white mb-2">
            Profit over time
          </h2>

          <div className="h-72">
            {profitChartData.length === 0 ? (
              <p className="text-xs text-gray-300/60">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={profitChartData}>
                  <CartesianGrid strokeDasharray="4 4" opacity={0.12} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={52} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={panelClass()}>
          <h2 className="text-sm font-semibold text-white mb-2">
            Revenue vs cost
          </h2>

          <div className="h-72">
            {revenueCostChartData.length === 0 ? (
              <p className="text-xs text-gray-300/60">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueCostChartData}>
                  <CartesianGrid strokeDasharray="4 4" opacity={0.12} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={52} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="rgba(255,255,255,0.9)" />
                  <Bar dataKey="cost" fill="rgba(255,255,255,0.45)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Invoices */}
      <div className={panelClass()}>
        <h2 className="text-sm font-semibold text-white mb-3">
          Invoices in range
        </h2>

        {invoices.length === 0 ? (
          <p className="text-sm text-gray-300/70">No invoices in this range.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div
                key={inv.orderId}
                className="flex items-center justify-between rounded-[22px] border border-white/10 bg-white/5 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    Order #{inv.orderId}
                  </p>
                  <p className="text-[11px] text-gray-300/60">
                    ${Number(inv.total || 0).toFixed(2)}
                  </p>
                </div>

                <ActionButton
                  type="button"
                  variant="outline"
                  disabled={busyInvoiceId === inv.orderId}
                  onClick={() => handleDownloadInvoice(inv.orderId)}
                >
                  {busyInvoiceId === inv.orderId
                    ? "Saving…"
                    : "Download PDF"}
                </ActionButton>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

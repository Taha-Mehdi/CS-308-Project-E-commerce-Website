"use client";

import { useMemo, useState } from "react";
import DripLink from "../../../components/DripLink";
import { getAnalyticsSummaryApi } from "../../../lib/api";

function panelClass() {
  return "rounded-[28px] border border-border bg-black/25 backdrop-blur p-5 shadow-[0_16px_60px_rgba(0,0,0,0.45)]";
}

function money(n) {
  const x = Number(n || 0);
  if (Number.isNaN(x)) return "$0.00";
  return `$${x.toFixed(2)}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// Try to normalize various backend shapes into { totals, series[] }
function normalizeAnalytics(data) {
  // Common shapes we might see:
  // A) { revenue, cost, profit, series: [{date, revenue, cost, profit}] }
  // B) { summary: {...}, points: [...] }
  // C) { orders: [...] } where each order has total and createdAt
  // D) { daily: [...] } etc.

  const seriesRaw =
    (Array.isArray(data?.series) && data.series) ||
    (Array.isArray(data?.points) && data.points) ||
    (Array.isArray(data?.daily) && data.daily) ||
    null;

  // If backend already provides a series, map it
  if (seriesRaw) {
    const series = seriesRaw
      .map((p) => {
        const date = p.date || p.day || p.createdAt || p.created_at;
        const revenue = Number(p.revenue ?? p.totalRevenue ?? p.sales ?? p.total ?? 0) || 0;
        const cost = Number(p.cost ?? p.totalCost ?? 0);
        const profit = Number(p.profit ?? p.lossProfit ?? p.net ?? (Number.isNaN(cost) ? 0 : revenue - cost));
        return {
          date: date ? String(date) : "",
          revenue,
          cost: Number.isNaN(cost) ? null : cost,
          profit: Number.isNaN(profit) ? 0 : profit,
        };
      })
      .filter((p) => p.date);

    const totals = {
      revenue:
        Number(data?.revenue ?? data?.totalRevenue ?? data?.summary?.revenue ?? data?.summary?.totalRevenue ?? 0) ||
        series.reduce((s, p) => s + (p.revenue || 0), 0),
      cost:
        Number(data?.cost ?? data?.totalCost ?? data?.summary?.cost ?? data?.summary?.totalCost ?? 0) ||
        series.reduce((s, p) => s + (p.cost || 0), 0),
      profit:
        Number(data?.profit ?? data?.lossProfit ?? data?.summary?.profit ?? data?.summary?.lossProfit ?? 0) ||
        series.reduce((s, p) => s + (p.profit || 0), 0),
    };

    return { totals, series };
  }

  // If backend returns orders list (common)
  const orders =
    (Array.isArray(data) && data) ||
    (Array.isArray(data?.orders) && data.orders) ||
    (Array.isArray(data?.items) && data.items) ||
    [];

  if (orders.length) {
    // group by YYYY-MM-DD
    const map = new Map();
    for (const o of orders) {
      const dt = o.createdAt || o.created_at || o.date;
      const d = new Date(dt);
      const key = Number.isNaN(d.getTime())
        ? String(dt || "unknown")
        : d.toISOString().slice(0, 10);

      const revenue = Number(o.total ?? o.amount ?? 0) || 0;

      // cost may exist per order; if not, default to 50% of sale price (requirement)
      const costVal = Number(o.cost ?? o.totalCost ?? NaN);
      const cost = Number.isNaN(costVal) ? revenue * 0.5 : costVal;
      const profit = revenue - cost;

      const prev = map.get(key) || { date: key, revenue: 0, cost: 0, profit: 0 };
      prev.revenue += revenue;
      prev.cost += cost;
      prev.profit += profit;
      map.set(key, prev);
    }

    const series = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    const totals = {
      revenue: series.reduce((s, p) => s + p.revenue, 0),
      cost: series.reduce((s, p) => s + p.cost, 0),
      profit: series.reduce((s, p) => s + p.profit, 0),
    };
    return { totals, series };
  }

  // Fallback totals-only
  const totals = {
    revenue: Number(data?.revenue ?? data?.totalRevenue ?? 0) || 0,
    cost: Number(data?.cost ?? data?.totalCost ?? 0) || 0,
    profit: Number(data?.profit ?? data?.lossProfit ?? 0) || 0,
  };
  return { totals, series: [] };
}

function SimpleLineChart({ series, height = 180 }) {
  // series: [{date, profit, revenue}]
  if (!series || series.length < 2) {
    return (
      <div className="text-sm text-gray-300/70">
        Not enough data points to draw a chart.
      </div>
    );
  }

  const profits = series.map((p) => Number(p.profit || 0));
  const min = Math.min(...profits);
  const max = Math.max(...profits);

  const pad = 16;
  const w = 900; // viewBox width
  const h = height;

  const xStep = (w - pad * 2) / (series.length - 1 || 1);
  const range = max - min || 1;

  const points = series.map((p, i) => {
    const x = pad + i * xStep;
    const yNorm = (Number(p.profit || 0) - min) / range; // 0..1
    const y = pad + (1 - yNorm) * (h - pad * 2);
    return { x, y };
  });

  const path = points
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
    .join(" ");

  const midY = pad + (h - pad * 2) * (1 - (0 - min) / range);
  const zeroInside = min <= 0 && max >= 0;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto rounded-2xl border border-white/10 bg-white/5"
        role="img"
        aria-label="Profit over time"
      >
        {/* zero line */}
        {zeroInside && (
          <line
            x1={pad}
            x2={w - pad}
            y1={midY}
            y2={midY}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="2"
            strokeDasharray="6 6"
          />
        )}

        {/* path */}
        <path
          d={path}
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* points */}
        {points.map((pt, idx) => (
          <circle
            key={idx}
            cx={pt.x}
            cy={pt.y}
            r="4"
            fill="rgba(255,255,255,0.85)"
          />
        ))}
      </svg>

      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-300/60">
        <span>{series[0].date}</span>
        <span>
          Profit range: {money(min)} → {money(max)}
        </span>
        <span>{series[series.length - 1].date}</span>
      </div>
    </div>
  );
}

export default function SalesAnalyticsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);

  async function handleRun() {
    setMessage("");
    setResult(null);

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
      const data = await getAnalyticsSummaryApi(from, to);
      const normalized = normalizeAnalytics(data);

      // If backend did not provide cost and it looks zero, keep profit from backend,
      // but ensure we have a reasonable cost display.
      const cost = Number(normalized.totals.cost || 0);
      const revenue = Number(normalized.totals.revenue || 0);
      const profit = Number(normalized.totals.profit || 0);

      // If cost not present but revenue present, default cost to 50% (requirement)
      const costFixed =
        cost === 0 && revenue > 0 ? revenue * 0.5 : cost;

      const profitFixed =
        normalized.totals.profit === 0 && revenue > 0 && costFixed > 0
          ? revenue - costFixed
          : profit;

      normalized.totals = {
        revenue,
        cost: costFixed,
        profit: profitFixed,
      };

      // If series exists but costs are missing, backfill costs at 50% revenue
      normalized.series = (normalized.series || []).map((p) => {
        const c = p.cost == null ? (p.revenue || 0) * 0.5 : p.cost;
        const pr =
          typeof p.profit === "number" && !Number.isNaN(p.profit)
            ? p.profit
            : (p.revenue || 0) - (c || 0);
        return { ...p, cost: c, profit: pr };
      });

      setResult(normalized);
      if (!normalized.series.length) {
        setMessage("No chart points returned — showing totals only.");
      }
    } catch (err) {
      console.error("Analytics error:", err);
      setMessage(err?.message || "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }

  const profitTone = useMemo(() => {
    const p = Number(result?.totals?.profit || 0);
    if (p > 0) return "text-emerald-200";
    if (p < 0) return "text-rose-200";
    return "text-gray-200/80";
  }, [result]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
            Sneaks-up · Sales
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Analytics
          </h1>
          <p className="text-sm text-gray-300/70">
            Revenue and profit/loss between dates (cost defaults to 50% if missing).
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
            disabled={!from || !to || loading}
            onClick={handleRun}
            className="
              h-10 px-5 rounded-full
              bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
              text-black text-[11px] font-semibold uppercase tracking-[0.18em]
              hover:opacity-95 transition active:scale-[0.98]
              disabled:opacity-60 disabled:cursor-not-allowed
            "
          >
            {loading ? "Loading…" : "Run"}
          </button>
        </div>
      </div>

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className={panelClass()}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300/70">
                Revenue
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {money(result.totals.revenue)}
              </p>
              <p className="mt-1 text-[11px] text-gray-300/60">
                Total sales in range
              </p>
            </div>

            <div className={panelClass()}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300/70">
                Cost
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {money(result.totals.cost)}
              </p>
              <p className="mt-1 text-[11px] text-gray-300/60">
                Defaults to 50% if missing
              </p>
            </div>

            <div className={panelClass()}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300/70">
                Profit / Loss
              </p>
              <p className={`mt-2 text-2xl font-semibold ${profitTone}`}>
                {money(result.totals.profit)}
              </p>
              <p className="mt-1 text-[11px] text-gray-300/60">
                Revenue − Cost
              </p>
            </div>
          </div>

          <div className={panelClass()}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300/70">
                  Profit chart
                </p>
                <p className="text-sm text-gray-300/70">
                  Profit trend across the selected range
                </p>
              </div>
              <span className="text-[11px] text-gray-300/60">
                Points: {result.series.length}
              </span>
            </div>

            <div className="mt-4">
              <SimpleLineChart series={result.series} />
            </div>
          </div>

          {/* Optional table */}
          {result.series.length > 0 && (
            <div className={panelClass()}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300/70">
                Breakdown
              </p>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-[12px] text-gray-200/80">
                  <thead className="text-[11px] uppercase tracking-[0.18em] text-gray-300/60">
                    <tr>
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Revenue</th>
                      <th className="py-2 pr-4">Cost</th>
                      <th className="py-2">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.series.map((p) => (
                      <tr key={p.date} className="border-t border-white/10">
                        <td className="py-2 pr-4">{p.date}</td>
                        <td className="py-2 pr-4">{money(p.revenue)}</td>
                        <td className="py-2 pr-4">{money(p.cost)}</td>
                        <td className="py-2">{money(p.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!result && !loading && (
        <div className={panelClass()}>
          <p className="text-sm text-gray-300/70">
            Pick a date range and run analytics to see revenue and profit/loss.
          </p>
        </div>
      )}
    </div>
  );
}

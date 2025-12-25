"use client";

import { useState } from "react";
import DripLink from "../../../components/DripLink";
import { clearStoredTokens, getAnalyticsSummaryApi } from "../../../lib/api";

function panelClass() {
  return "rounded-[28px] border border-border bg-black/25 backdrop-blur p-5 shadow-[0_16px_60px_rgba(0,0,0,0.45)]";
}

function money(n) {
  const v = Number(n || 0);
  return `$${v.toFixed(2)}`;
}

function normalizeAnalytics(data) {
  // Accept many backend shapes safely
  const totals = {
    revenue: Number(data?.revenue ?? data?.totalRevenue ?? data?.totals?.revenue ?? 0) || 0,
    cost: Number(data?.cost ?? data?.totalCost ?? data?.totals?.cost ?? 0) || 0,
    profit: Number(data?.profit ?? data?.lossProfit ?? data?.totals?.profit ?? 0) || 0,
  };

  // series formats supported:
  // 1) data.series = [{date, revenue, cost, profit}, ...]
  // 2) data.points = [...]
  // 3) no series
  const series =
    (Array.isArray(data?.series) && data.series) ||
    (Array.isArray(data?.points) && data.points) ||
    [];

  return { totals, series };
}

function SimpleLineChart({ series, height = 180 }) {
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
  const w = 900;
  const h = height;

  const xStep = (w - pad * 2) / (series.length - 1 || 1);
  const range = max - min || 1;

  const points = series.map((p, i) => {
    const x = pad + i * xStep;
    const yNorm = (Number(p.profit || 0) - min) / range;
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

        <path
          d={path}
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

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

      const cost = Number(normalized.totals.cost || 0);
      const revenue = Number(normalized.totals.revenue || 0);
      const profit = Number(normalized.totals.profit || 0);

      // Default cost to 50% revenue if not provided (requirement)
      const costFixed = cost === 0 && revenue > 0 ? revenue * 0.5 : cost;
      const profitFixed =
        normalized.totals.profit === 0 && revenue > 0 && costFixed > 0
          ? revenue - costFixed
          : profit;

      normalized.totals = { revenue, cost: costFixed, profit: profitFixed };

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
      if (handleAuthRedirect(err, "/sales-admin/analytics")) return;
      setMessage(err?.message || "Failed to load analytics.");
    } finally {
      setLoading(false);
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
            Analytics
          </h1>
          <p className="text-sm text-gray-300/70">
            Revenue and profit between dates.
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
            {loading ? "Running…" : "Run"}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          <div className={panelClass()}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-gray-300/60">
                  Revenue
                </p>
                <p className="text-lg font-semibold text-white">
                  {money(result.totals.revenue)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-gray-300/60">
                  Cost
                </p>
                <p className="text-lg font-semibold text-white">
                  {money(result.totals.cost)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-gray-300/60">
                  Profit
                </p>
                <p className="text-lg font-semibold text-white">
                  {money(result.totals.profit)}
                </p>
              </div>
            </div>
          </div>

          <div className={panelClass()}>
            <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60 mb-3">
              Profit chart
            </p>
            <SimpleLineChart series={result.series} />
          </div>
        </div>
      )}
    </div>
  );
}

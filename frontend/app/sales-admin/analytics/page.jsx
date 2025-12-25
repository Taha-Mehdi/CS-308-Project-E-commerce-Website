"use client";

import { useMemo, useState } from "react";
import DripLink from "../../../components/DripLink";
import { clearStoredTokens, getAnalyticsSummaryApi } from "../../../lib/api";

function panelClass() {
  return "rounded-[28px] border border-border bg-black/25 backdrop-blur p-5 shadow-[0_16px_60px_rgba(0,0,0,0.45)]";
}

function money(n) {
  const v = Number(n ?? 0);
  return `$${v.toFixed(2)}`;
}

function isNil(v) {
  return v === null || v === undefined;
}

function normalizeAnalytics(data) {
  // totals: do NOT treat 0 as "missing"
  const revenue = Number(data?.revenue ?? data?.totalRevenue ?? data?.totals?.revenue ?? 0) || 0;

  const costRaw = data?.cost ?? data?.totalCost ?? data?.totals?.cost;
  const profitRaw = data?.profit ?? data?.lossProfit ?? data?.totals?.profit;

  const seriesRaw =
    (Array.isArray(data?.series) && data.series) ||
    (Array.isArray(data?.points) && data.points) ||
    [];

  const series = seriesRaw.map((p) => ({
    date: p?.date ?? p?.day ?? p?.label ?? "",
    revenue: Number(p?.revenue ?? p?.totalRevenue ?? 0) || 0,
    cost: isNil(p?.cost) ? null : Number(p.cost) || 0,
    profit: isNil(p?.profit) ? null : Number(p.profit) || 0,
  }));

  return {
    totals: {
      revenue,
      cost: isNil(costRaw) ? null : Number(costRaw) || 0,
      profit: isNil(profitRaw) ? null : Number(profitRaw) || 0,
    },
    series,
  };
}

// Requirement: default cost to 50% of revenue when cost is NOT provided (null/undefined)
function applyDefaults(normalized) {
  const revenue = Number(normalized?.totals?.revenue ?? 0) || 0;

  const cost =
    isNil(normalized?.totals?.cost) && revenue > 0
      ? revenue * 0.5
      : Number(normalized?.totals?.cost ?? 0) || 0;

  const profit = isNil(normalized?.totals?.profit)
    ? revenue - cost
    : Number(normalized?.totals?.profit ?? 0) || 0;

  const series = (normalized?.series || []).map((p) => {
    const r = Number(p?.revenue ?? 0) || 0;
    const c = isNil(p?.cost) ? r * 0.5 : Number(p?.cost ?? 0) || 0;
    const pr = isNil(p?.profit) ? r - c : Number(p?.profit ?? 0) || 0;
    return { ...p, revenue: r, cost: c, profit: pr };
  });

  return { totals: { revenue, cost, profit }, series };
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

function MetricToggle({ value, onChange }) {
  const options = [
    { key: "profit", label: "Profit" },
    { key: "revenue", label: "Revenue" },
    { key: "cost", label: "Cost" },
  ];

  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={[
              "h-8 px-3 rounded-full text-[11px] font-semibold uppercase tracking-[0.18em] transition",
              active ? "bg-white/15 text-white" : "text-gray-200/70 hover:text-white",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function DetailedLineChart({ series, metric = "profit", height = 380 }) {
  const safeSeries = useMemo(
    () => (Array.isArray(series) ? series.filter((p) => p?.date) : []),
    [series]
  );

  const [hoverIdx, setHoverIdx] = useState(null);

  const metricLabel =
    metric === "profit" ? "Profit" : metric === "revenue" ? "Revenue" : "Cost";

  const values = useMemo(
    () => safeSeries.map((p) => Number(p?.[metric] ?? 0) || 0),
    [safeSeries, metric]
  );

  if (!safeSeries.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-gray-200/80">No chart data returned.</p>
        <p className="mt-1 text-[11px] text-gray-300/60">
          Try a wider date range, or ensure the backend returns daily points.
        </p>
      </div>
    );
  }

  if (safeSeries.length < 2) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-gray-200/80">Not enough data points to draw a chart.</p>
        <p className="mt-1 text-[11px] text-gray-300/60">Need at least 2 points.</p>
      </div>
    );
  }

  // SVG geometry (bigger, cleaner)
  const w = 1100;
  const h = height;

  const padL = 70; // y-axis labels space
  const padR = 22;
  const padT = 22;
  const padB = 44;

  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  // expand min/max a bit for breathing room
  let min = Math.min(...values);
  let max = Math.max(...values);
  const span = max - min || 1;
  const extra = span * 0.12;
  min -= extra;
  max += extra;

  const xStep = innerW / (safeSeries.length - 1);

  const yFor = (v) => {
    const t = (v - min) / (max - min || 1);
    return padT + (1 - t) * innerH;
  };

  const points = safeSeries.map((p, i) => {
    const x = padL + i * xStep;
    const y = yFor(Number(p?.[metric] ?? 0) || 0);
    return { x, y };
  });

  const linePath = points
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
    .join(" ");

  // Area fill for subtle depth
  const areaPath = `${linePath} L ${(padL + innerW).toFixed(2)} ${(padT + innerH).toFixed(
    2
  )} L ${padL.toFixed(2)} ${(padT + innerH).toFixed(2)} Z`;

  // ticks/grid
  const ticks = 5;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => min + (i * (max - min)) / ticks);
  const tickYs = tickVals.map((v) => ({ v, y: yFor(v) }));

  const zeroInside = min <= 0 && max >= 0;
  const zeroY = yFor(0);

  const clampedIdx =
    hoverIdx == null ? null : Math.max(0, Math.min(safeSeries.length - 1, hoverIdx));

  const hoverPoint = clampedIdx == null ? null : points[clampedIdx];
  const hoverData = clampedIdx == null ? null : safeSeries[clampedIdx];

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    const rel = Math.max(0, Math.min(innerW, x - padL));
    const i = Math.round(rel / xStep);
    setHoverIdx(i);
  }

  function onLeave() {
    setHoverIdx(null);
  }

  const rangeLabel = `${money(Math.min(...values))} → ${money(Math.max(...values))}`;

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60">
            {metricLabel} trend
          </p>
          <p className="mt-1 text-sm text-gray-200/80">
            {safeSeries[0].date} → {safeSeries[safeSeries.length - 1].date}
          </p>
        </div>

        <div className="text-[11px] text-gray-300/60">
          Range: <span className="text-gray-200/80">{rangeLabel}</span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full h-auto rounded-3xl border border-white/10 bg-white/5"
          role="img"
          aria-label={`${metricLabel} over time`}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
        >
          <defs>
            {/* subtle area gradient */}
            <linearGradient id="areaFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.00)" />
            </linearGradient>

            {/* glow */}
            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* grid + y labels */}
          {tickYs.map((t, i) => (
            <g key={i}>
              <line
                x1={padL}
                x2={w - padR}
                y1={t.y}
                y2={t.y}
                stroke="rgba(255,255,255,0.10)"
                strokeWidth="1"
              />
              <text
                x={padL - 12}
                y={t.y + 4}
                textAnchor="end"
                fontSize="11"
                fill="rgba(255,255,255,0.55)"
              >
                {money(t.v)}
              </text>
            </g>
          ))}

          {/* zero line */}
          {zeroInside && (
            <line
              x1={padL}
              x2={w - padR}
              y1={zeroY}
              y2={zeroY}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="2"
              strokeDasharray="6 6"
            />
          )}

          {/* plot frame */}
          <rect
            x={padL}
            y={padT}
            width={innerW}
            height={innerH}
            fill="none"
            stroke="rgba(255,255,255,0.10)"
          />

          {/* area */}
          <path d={areaPath} fill="url(#areaFade)" />

          {/* line */}
          <path
            d={linePath}
            fill="none"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#softGlow)"
          />

          {/* points */}
          {points.map((pt, i) => {
            const active = clampedIdx === i;
            return (
              <g key={i}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={active ? 6 : 4}
                  fill="rgba(255,255,255,0.92)"
                  opacity={clampedIdx == null || active ? 1 : 0.55}
                />
                {active && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="12"
                    fill="rgba(255,255,255,0.10)"
                  />
                )}
              </g>
            );
          })}

          {/* x labels (start, mid, end) */}
          {(() => {
            const mid = Math.floor((safeSeries.length - 1) / 2);
            const labels = [
              { i: 0, anchor: "start" },
              { i: mid, anchor: "middle" },
              { i: safeSeries.length - 1, anchor: "end" },
            ];

            return labels.map(({ i, anchor }) => {
              const x = padL + i * xStep;
              return (
                <text
                  key={i}
                  x={x}
                  y={padT + innerH + 28}
                  textAnchor={anchor}
                  fontSize="11"
                  fill="rgba(255,255,255,0.55)"
                >
                  {safeSeries[i]?.date}
                </text>
              );
            });
          })()}

          {/* hover crosshair */}
          {hoverPoint && (
            <line
              x1={hoverPoint.x}
              x2={hoverPoint.x}
              y1={padT}
              y2={padT + innerH}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="2"
            />
          )}
        </svg>

        {/* tooltip */}
        {hoverPoint && hoverData && (
          <div
            className="pointer-events-none absolute top-4"
            style={{
              left: `${(hoverPoint.x / w) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="rounded-3xl border border-white/10 bg-black/70 backdrop-blur px-4 py-3 shadow-[0_16px_60px_rgba(0,0,0,0.45)]">
              <div className="text-[11px] uppercase tracking-[0.22em] text-gray-300/70">
                {hoverData.date}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] text-gray-100">
                <div className="text-gray-300/70">Revenue</div>
                <div className="text-right font-semibold">{money(hoverData.revenue)}</div>
                <div className="text-gray-300/70">Cost</div>
                <div className="text-right font-semibold">{money(hoverData.cost)}</div>
                <div className="text-gray-300/70">Profit</div>
                <div className="text-right font-semibold">{money(hoverData.profit)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-300/60">
        Tip: hover the chart for details. Use the toggle to switch between metrics.
      </p>
    </div>
  );
}

export default function SalesAnalyticsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [metric, setMetric] = useState("profit");

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
      const fixed = applyDefaults(normalized);

      setResult(fixed);
      if (!fixed.series.length) {
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

  const margin = useMemo(() => {
    const revenue = Number(result?.totals?.revenue ?? 0);
    const profit = Number(result?.totals?.profit ?? 0);
    return revenue > 0 ? (profit / revenue) * 100 : 0;
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
            Revenue, cost, and profit between dates.
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
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300/70">
              From
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-11 w-full rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/15"
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
              className="h-11 w-full rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/15"
            />
          </div>

          <button
            type="button"
            disabled={!from || !to || loading}
            onClick={handleRun}
            className="
              h-11 px-6 rounded-full
              bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
              text-black text-[11px] font-semibold uppercase tracking-[0.18em]
              hover:opacity-95 transition active:scale-[0.98]
              disabled:opacity-60 disabled:cursor-not-allowed
            "
          >
            {loading ? "Running…" : "Run"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-gray-300/60">
            Tip: choose a range, then hover the chart for exact values.
          </p>
          <MetricToggle value={metric} onChange={setMetric} />
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          <div className={panelClass()}>
            <div className="grid gap-4 sm:grid-cols-4">
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
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-gray-300/60">
                  Margin
                </p>
                <p className="text-lg font-semibold text-white">
                  {margin.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className={panelClass()}>
            <DetailedLineChart series={result.series} metric={metric} height={420} />
          </div>
        </div>
      )}
    </div>
  );
}

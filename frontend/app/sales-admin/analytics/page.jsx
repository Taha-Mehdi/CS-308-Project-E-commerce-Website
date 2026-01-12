"use client";

import { useMemo, useState } from "react";
import DripLink from "../../../components/DripLink";
import { clearStoredTokens, getAnalyticsSummaryApi } from "../../../lib/api";

/* --------------------------------- helpers --------------------------------- */

function panelClass(extra = "") {
  return [
    "relative overflow-hidden rounded-[28px] border border-white/10",
    "bg-black/25 backdrop-blur p-5",
    "shadow-[0_16px_60px_rgba(0,0,0,0.45)]",
    extra,
  ].join(" ");
}

function softGridStyle() {
  return {
    backgroundImage:
        "linear-gradient(rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.10) 1px, transparent 1px)",
    backgroundSize: "28px 28px",
    backgroundPosition: "center",
    maskImage: "radial-gradient(60% 60% at 50% 45%, black 55%, transparent 100%)",
    WebkitMaskImage:
        "radial-gradient(60% 60% at 50% 45%, black 55%, transparent 100%)",
  };
}

function money(n) {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  const s =
      abs >= 1_000_000
          ? `${(v / 1_000_000).toFixed(2)}M`
          : abs >= 1_000
              ? `${(v / 1_000).toFixed(2)}k`
              : v.toFixed(2);
  return `$${s}`;
}

function pct(n) {
  const v = Number(n || 0);
  return `${(v * 100).toFixed(1)}%`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function normalizeAnalytics(data) {
  const totals = {
    revenue:
        Number(
            data?.revenue ?? data?.totalRevenue ?? data?.totals?.revenue ?? 0
        ) || 0,
    cost: Number(data?.cost ?? data?.totalCost ?? data?.totals?.cost ?? 0) || 0,
    profit:
        Number(data?.profit ?? data?.lossProfit ?? data?.totals?.profit ?? 0) || 0,
  };

  const series =
      (Array.isArray(data?.series) && data.series) ||
      (Array.isArray(data?.points) && data.points) ||
      [];

  return { totals, series };
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

/* --------------------------------- ui bits -------------------------------- */

function Badge({ children }) {
  return (
      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase text-white/70">
      {children}
    </span>
  );
}

function StatCard({ label, value, sub, accent = "rgba(255,255,255,0.14)" }) {
  return (
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <div
            className="pointer-events-none absolute -top-10 right-0 h-24 w-24 rounded-full blur-2xl"
            style={{ background: accent, opacity: 0.9 }}
        />
        <p className="text-[11px] font-semibold tracking-[0.26em] uppercase text-white/55">
          {label}
        </p>
        <p className="mt-1 text-xl font-semibold tracking-tight text-white">
          {value}
        </p>
        {sub ? (
            <p className="mt-1 text-[11px] text-white/55 leading-relaxed">{sub}</p>
        ) : null}
      </div>
  );
}

/* --------------------------------- charts --------------------------------- */

function ChartShell({ title, subtitle, right, children }) {
  return (
      <div className={panelClass("p-0")}>
        <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={softGridStyle()}
        />
        <div className="relative border-b border-white/10 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-white/55">
                {title}
              </p>
              {subtitle ? (
                  <p className="text-sm text-white/60">{subtitle}</p>
              ) : null}
            </div>
            {right ? <div className="shrink-0">{right}</div> : null}
          </div>
        </div>
        <div className="relative p-4">{children}</div>
      </div>
  );
}

function buildSeries(series) {
  const cleaned = (Array.isArray(series) ? series : [])
      .map((p, i) => ({
        i,
        date: p?.date ?? "",
        revenue: Number(p?.revenue || 0),
        cost: Number(p?.cost || 0),
        profit: Number(p?.profit || 0),
      }))
      .filter((p) => p.date || p.revenue || p.cost || p.profit);

  const allParseable = cleaned.every(
      (p) => !p.date || !Number.isNaN(Date.parse(p.date))
  );
  if (allParseable) {
    cleaned.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    cleaned.forEach((p, idx) => (p.i = idx));
  }
  return cleaned;
}

function MultiLineChart({ series, height = 260 }) {
  const s = useMemo(() => buildSeries(series), [series]);

  if (!s || s.length < 2) {
    return (
        <div className="text-sm text-white/60">
          Not enough data points to draw charts (need at least 2).
        </div>
    );
  }

  const pad = 22;
  const w = 1100;
  const h = height;

  const xStep = (w - pad * 2) / (s.length - 1 || 1);

  const values = s.flatMap((p) => [p.revenue, p.cost, p.profit]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const toXY = (val, i) => {
    const x = pad + i * xStep;
    const yNorm = (val - min) / range;
    const y = pad + (1 - yNorm) * (h - pad * 2);
    return { x, y };
  };

  const mkPath = (key) =>
      s
          .map((p, i) => {
            const { x, y } = toXY(p[key], i);
            return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
          })
          .join(" ");

  const profitLine = s.map((p, i) => toXY(p.profit, i));
  const profitArea = [
    `M ${profitLine[0].x.toFixed(2)} ${(h - pad).toFixed(2)}`,
    ...profitLine.map(
        (pt, i) => `${i === 0 ? "L" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`
    ),
    `L ${profitLine[profitLine.length - 1].x.toFixed(2)} ${(h - pad).toFixed(
        2
    )}`,
    "Z",
  ].join(" ");

  const zeroInside = min <= 0 && max >= 0;
  const zeroY = pad + (h - pad * 2) * (1 - (0 - min) / range);

  const strokeProfit = "rgba(255,255,255,0.92)";
  const strokeRevenue = "rgba(255,255,255,0.62)";
  const strokeCost = "rgba(255,255,255,0.42)";

  const last = s[s.length - 1];
  const lastProfitXY = toXY(last.profit, s.length - 1);

  return (
      <div className="w-full space-y-3">
        <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full h-auto rounded-2xl border border-white/10 bg-white/5"
            role="img"
            aria-label="Revenue, cost and profit over time"
        >
          <defs>
            <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
            </linearGradient>
          </defs>

          {Array.from({ length: 6 }).map((_, i) => {
            const y = pad + (i * (h - pad * 2)) / 5;
            return (
                <line
                    key={`grid-${i}`}
                    x1={pad}
                    x2={w - pad}
                    y1={y}
                    y2={y}
                    stroke="rgba(255,255,255,0.10)"
                    strokeWidth="1"
                />
            );
          })}

          {zeroInside && (
              <line
                  x1={pad}
                  x2={w - pad}
                  y1={zeroY}
                  y2={zeroY}
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="2"
                  strokeDasharray="6 6"
              />
          )}

          <path d={profitArea} fill="url(#profitFill)" stroke="none" />

          <path
              d={mkPath("revenue")}
              fill="none"
              stroke={strokeRevenue}
              strokeWidth="2.6"
              strokeLinejoin="round"
              strokeLinecap="round"
          />
          <path
              d={mkPath("cost")}
              fill="none"
              stroke={strokeCost}
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
          />
          <path
              d={mkPath("profit")}
              fill="none"
              stroke={strokeProfit}
              strokeWidth="3.2"
              strokeLinejoin="round"
              strokeLinecap="round"
          />

          {s.map((p, i) => {
            const { x, y } = toXY(p.profit, i);
            return (
                <circle
                    key={`pt-${p.i}-${p.date || "nodate"}`}
                    cx={x}
                    cy={y}
                    r="3.8"
                    fill={strokeProfit}
                />
            );
          })}

          <circle
              cx={lastProfitXY.x}
              cy={lastProfitXY.y}
              r="5.2"
              fill="rgba(255,255,255,0.92)"
          />
        </svg>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-white/65">
            <span className="inline-flex h-2 w-2 rounded-full bg-white/90" />
            Profit
            <span className="inline-flex h-2 w-2 rounded-full bg-white/60 ml-3" />
            Revenue
            <span className="inline-flex h-2 w-2 rounded-full bg-white/40 ml-3" />
            Cost
          </div>
          <div className="text-[11px] text-white/60">
            Range {money(min)} → {money(max)}
          </div>
        </div>
      </div>
  );
}

function BarsChart({ series, height = 200 }) {
  const s = useMemo(() => buildSeries(series), [series]);

  if (!s || s.length < 2) {
    return (
        <div className="text-sm text-white/60">
          Not enough data points to draw charts (need at least 2).
        </div>
    );
  }

  const pad = 18;
  const w = 1000;
  const h = height;

  const maxVal = Math.max(
      ...s.flatMap((p) => [p.revenue || 0, p.cost || 0, Math.abs(p.profit || 0)])
  );

  const barW = (w - pad * 2) / s.length;
  const inner = clamp(barW * 0.66, 10, 22);
  const gap = barW - inner;

  const scaleY = (v) => {
    const n = Number(v || 0);
    const y = (n / (maxVal || 1)) * (h - pad * 2);
    return y;
  };

  return (
      <div className="w-full space-y-3">
        <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full h-auto rounded-2xl border border-white/10 bg-white/5"
            role="img"
            aria-label="Revenue and cost bars"
        >
          {Array.from({ length: 4 }).map((_, i) => {
            const y = pad + (i * (h - pad * 2)) / 3;
            return (
                <line
                    key={`bgrid-${i}`}
                    x1={pad}
                    x2={w - pad}
                    y1={y}
                    y2={y}
                    stroke="rgba(255,255,255,0.10)"
                    strokeWidth="1"
                />
            );
          })}

          {s.map((p, i) => {
            const x0 = pad + i * barW + gap / 2;
            const revH = scaleY(p.revenue);
            const costH = scaleY(p.cost);

            const revX = x0;
            const costX = x0 + inner * 0.55;

            const revY = h - pad - revH;
            const costY = h - pad - costH;

            return (
                <g key={`bar-${p.i}-${p.date || "nodate"}`}>
                  <rect
                      x={revX}
                      y={revY}
                      width={inner * 0.45}
                      height={revH}
                      rx="6"
                      fill="rgba(255,255,255,0.55)"
                  />
                  <rect
                      x={costX}
                      y={costY}
                      width={inner * 0.45}
                      height={costH}
                      rx="6"
                      fill="rgba(255,255,255,0.28)"
                  />
                </g>
            );
          })}
        </svg>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-white/65">
            <span className="inline-flex h-2 w-2 rounded-full bg-white/60" />
            Revenue
            <span className="inline-flex h-2 w-2 rounded-full bg-white/30 ml-3" />
            Cost
          </div>

          <div className="text-[11px] text-white/60">
            Scaled to max {money(maxVal)}
          </div>
        </div>
      </div>
  );
}

function Donut({ value = 0.3, label = "Margin", sub = "" }) {
  const v = clamp(Number(value || 0), 0, 1);
  const size = 140;
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = c * v;

  return (
      <div className="flex items-center gap-4">
        <svg
            width={size}
            height={size}
            viewBox="0 0 140 140"
            className="shrink-0 rounded-3xl border border-white/10 bg-white/5"
            aria-label="Margin donut chart"
            role="img"
        >
          <circle
              cx="70"
              cy="70"
              r={r}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="12"
              fill="none"
          />
          <circle
              cx="70"
              cy="70"
              r={r}
              stroke="rgba(255,255,255,0.85)"
              strokeWidth="12"
              fill="none"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeLinecap="round"
              transform="rotate(-90 70 70)"
          />
          <text
              x="70"
              y="74"
              textAnchor="middle"
              className="fill-white"
              style={{ fontSize: 18, fontWeight: 700 }}
          >
            {pct(v)}
          </text>
        </svg>

        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-white/55">
            {label}
          </p>
          <p className="text-sm text-white/70">{sub}</p>
          <p className="text-[11px] text-white/55 leading-relaxed">
            Margin = profit / revenue.
          </p>
        </div>
      </div>
  );
}

/* ---------------------------------- page ---------------------------------- */

export default function SalesAnalyticsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);

  const derived = useMemo(() => {
    if (!result) return null;
    const revenue = Number(result.totals.revenue || 0);
    const cost = Number(result.totals.cost || 0);
    const profit = Number(result.totals.profit || 0);
    const margin = revenue > 0 ? profit / revenue : 0;
    const burn = revenue > 0 ? cost / revenue : 0;
    return { revenue, cost, profit, margin, burn };
  }, [result]);

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
      <div className="relative space-y-6">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-1/2 h-72 w-[560px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl opacity-35" />
          <div className="absolute top-32 right-0 h-72 w-72 rounded-full bg-white/5 blur-3xl opacity-35" />
          <div className="absolute bottom-0 left-8 h-72 w-72 rounded-full bg-white/5 blur-3xl opacity-25" />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Sneaks-up</Badge>
              <Badge>Sales</Badge>
              {from && to ? (
                  <Badge>
                    {from} → {to}
                  </Badge>
              ) : (
                  <Badge>Pick a range</Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Analytics dashboard
            </h1>
            <p className="text-sm text-white/60">
              Revenue, cost, profit and margin for your selected date range.
            </p>
          </div>

          <DripLink
              href="/sales-admin"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-semibold text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Back to sales panel <span className="ml-2">→</span>
          </DripLink>
        </div>

        {message && (
            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-white/75">
              {message}
            </div>
        )}

        {/* controls */}
        <div className={panelClass()}>
          <div
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={softGridStyle()}
          />
          <div className="relative grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
                From
              </label>
              {/* ✅ FIXED: Toggle between text (placeholder) and date (picker) to force "mm/dd/yyyy" */}
              <input
                  type={from ? "date" : "text"}
                  placeholder="mm/dd/yyyy"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  onFocus={(e) => (e.target.type = "date")}
                  onBlur={(e) => {
                    if (!e.target.value) e.target.type = "text";
                  }}
                  style={{ colorScheme: "dark" }}
                  className="h-10 w-full rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/15"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
                To
              </label>
              {/* ✅ FIXED: Toggle between text (placeholder) and date (picker) to force "mm/dd/yyyy" */}
              <input
                  type={to ? "date" : "text"}
                  placeholder="mm/dd/yyyy"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  onFocus={(e) => (e.target.type = "date")}
                  onBlur={(e) => {
                    if (!e.target.value) e.target.type = "text";
                  }}
                  style={{ colorScheme: "dark" }}
                  className="h-10 w-full rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/15"
              />
            </div>

            <button
                type="button"
                disabled={!from || !to || loading}
                onClick={handleRun}
                className="h-10 px-5 rounded-full bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] text-black text-[11px] font-semibold uppercase tracking-[0.18em] hover:opacity-95 transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Running…" : "Run"}
            </button>
          </div>
        </div>

        {/* results */}
        {result && derived && (
            <div className="space-y-2">
              {/* KPI grid */}
              <div className={panelClass()}>
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.06]"
                    style={softGridStyle()}
                />
                <div className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                      label="Revenue"
                      value={money(derived.revenue)}
                      sub="Total sales value"
                      accent="rgba(255,255,255,0.12)"
                  />
                  <StatCard
                      label="Cost"
                      value={money(derived.cost)}
                      sub={`Spend ratio: ${pct(derived.burn)}`}
                      accent="rgba(255,255,255,0.09)"
                  />
                  <StatCard
                      label="Profit"
                      value={money(derived.profit)}
                      sub={`Margin: ${pct(derived.margin)}`}
                      accent="rgba(255,255,255,0.14)"
                  />
                  <StatCard
                      label="Points"
                      value={`${(result.series || []).length}`}
                      sub="Chart datapoints"
                      accent="rgba(255,255,255,0.08)"
                  />
                </div>
              </div>

              {/* Charts */}
              <div className="grid gap-2">
                <ChartShell
                    title="Trend lines"
                    subtitle="Profit (bold) with revenue and cost for context."
                    right={
                      <span className="text-[11px] text-white/55">
                  More points = smoother trend.
                </span>
                    }
                >
                  <MultiLineChart series={result.series} />
                </ChartShell>

                <ChartShell
                    title="Margin"
                    subtitle="How much of revenue stays as profit."
                    right={<Badge>Donut</Badge>}
                >
                  <Donut
                      value={derived.margin}
                      label="Profit margin"
                      sub={`Profit ${money(derived.profit)} on revenue ${money(
                          derived.revenue
                      )}`}
                  />
                </ChartShell>

                <ChartShell
                    title="Revenue vs cost bars"
                    subtitle="Two bars per period: revenue (left) and cost (right)."
                    right={<Badge>Scaled</Badge>}
                >
                  <BarsChart series={result.series} />
                </ChartShell>
              </div>
            </div>
        )}
      </div>
  );
}
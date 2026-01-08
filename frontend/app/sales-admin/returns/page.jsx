"use client";

import { useEffect, useMemo, useState } from "react";
import ActionButton from "../../../components/ActionButton";
import {
  listReturnRequestsApi,
  decideReturnRequestApi,
  markReturnReceivedApi,
} from "../../../lib/api";

/* ---------- helpers ---------- */
function statusMeta(statusRaw) {
  const status = String(statusRaw || "").toLowerCase();

  if (status === "requested") {
    return {
      label: "Requested",
      chip:
        "border-amber-500/25 bg-amber-500/10 text-amber-200 shadow-[0_0_0_1px_rgba(245,158,11,0.10)]",
      dot: "bg-amber-400",
    };
  }
  if (status === "approved") {
    return {
      label: "Approved",
      chip:
        "border-sky-500/25 bg-sky-500/10 text-sky-200 shadow-[0_0_0_1px_rgba(14,165,233,0.10)]",
      dot: "bg-sky-400",
    };
  }
  if (status === "rejected") {
    return {
      label: "Rejected",
      chip:
        "border-rose-500/25 bg-rose-500/10 text-rose-200 shadow-[0_0_0_1px_rgba(244,63,94,0.10)]",
      dot: "bg-rose-400",
    };
  }
  if (status === "refunded") {
    return {
      label: "Refunded",
      chip:
        "border-emerald-500/25 bg-emerald-500/10 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.10)]",
      dot: "bg-emerald-400",
    };
  }

  return {
    label: status ? status : "Unknown",
    chip: "border-white/10 bg-white/5 text-gray-200/80",
    dot: "bg-white/40",
  };
}

function safeDateLabel(iso) {
  try {
    if (!iso) return "—";
    // Stable output (avoids hydration mismatch)
    const d = new Date(iso);
    const yyyy = String(d.getUTCFullYear());
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mi = String(d.getUTCMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
  } catch {
    return "—";
  }
}

function safeMoney(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

/* ---------- UI atoms ---------- */
function ChipButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        // ✅ same size pills
        "h-10 min-w-[140px] px-4",
        "inline-flex items-center justify-center",
        "rounded-full text-[11px] font-semibold uppercase tracking-[0.18em] transition",
        "border backdrop-blur",
        active
          ? "border-white/18 bg-white/10 text-white shadow-[0_16px_55px_rgba(0,0,0,0.30)]"
          : "border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/[0.08] hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function GlassCard({ children, className = "" }) {
  return (
    <div
      className={classNames(
        "rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur",
        "shadow-[0_18px_70px_rgba(0,0,0,0.38)]",
        className
      )}
    >
      {children}
    </div>
  );
}

function SkeletonRow() {
  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-64 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-44 rounded bg-white/10 animate-pulse" />
        </div>
        <div className="h-6 w-24 rounded-full bg-white/10 animate-pulse" />
      </div>
      <div className="mt-4 h-16 rounded-2xl bg-white/10 animate-pulse" />
      <div className="mt-4 flex gap-2">
        <div className="h-9 w-28 rounded-full bg-white/10 animate-pulse" />
        <div className="h-9 w-28 rounded-full bg-white/10 animate-pulse" />
      </div>
    </GlassCard>
  );
}

/* ---------- page ---------- */
export default function SalesReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);

  // UI controls
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const data = await listReturnRequestsApi();
      setReturns(Array.isArray(data) ? data : []);
    } catch (err) {
      setReturns([]);
      setMessage(err?.message || "Failed to load return requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id, decision) {
    setBusyId(id);
    try {
      await decideReturnRequestApi(id, decision);
      await load();
    } catch (err) {
      window.alert(err?.message || "Failed to save decision.");
    } finally {
      setBusyId(null);
    }
  }

  async function markReceived(id) {
    setBusyId(id);
    try {
      // Performs refund + restock + email
      await markReturnReceivedApi(id);
      await load();
    } catch (err) {
      window.alert(err?.message || "Failed to process return.");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (returns || [])
      .slice()
      .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))
      .filter((r) => {
        const st = String(r?.status || "").toLowerCase();
        if (statusFilter !== "all" && st !== statusFilter) return false;

        if (!q) return true;
        const hay = [
          r?.id,
          r?.orderId,
          r?.orderItemId,
          r?.reason,
          r?.status,
          r?.requestedAt,
        ]
          .map((x) => String(x ?? ""))
          .join(" ")
          .toLowerCase();

        return hay.includes(q);
      });
  }, [returns, statusFilter, search]);

  const counts = useMemo(() => {
    const c = { all: 0, requested: 0, approved: 0, rejected: 0, refunded: 0 };
    for (const r of returns || []) {
      c.all += 1;
      const st = String(r?.status || "").toLowerCase();
      if (c[st] !== undefined) c[st] += 1;
    }
    return c;
  }, [returns]);

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 pb-16">
        {/* ✅ Rounded purple hue header card */}
        <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.03] backdrop-blur shadow-[0_18px_70px_rgba(0,0,0,0.38)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_circle_at_12%_18%,rgba(168,85,247,0.22),transparent_58%),radial-gradient(1000px_circle_at_88%_40%,rgba(251,113,133,0.14),transparent_62%)]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30" />

          <div className="relative px-5 sm:px-7 py-7 sm:py-9">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold tracking-[0.34em] uppercase text-gray-300/70">
                  Sales Admin
                </p>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  Return Requests
                </h1>
                <p className="text-sm text-gray-300/70 max-w-2xl">
                  Approve or reject requests. Approved returns are refunded once received.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur">
                <span className="text-[10px] uppercase tracking-[0.26em] text-gray-300/70">
                  {loading ? "Loading…" : `${filtered.length} shown · ${counts.all} total`}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <ChipButton active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
                  ALL ({counts.all})
                </ChipButton>
                <ChipButton
                  active={statusFilter === "requested"}
                  onClick={() => setStatusFilter("requested")}
                >
                  REQUESTED ({counts.requested})
                </ChipButton>
                <ChipButton
                  active={statusFilter === "approved"}
                  onClick={() => setStatusFilter("approved")}
                >
                  APPROVED ({counts.approved})
                </ChipButton>
                <ChipButton
                  active={statusFilter === "rejected"}
                  onClick={() => setStatusFilter("rejected")}
                >
                  REJECTED ({counts.rejected})
                </ChipButton>
                <ChipButton
                  active={statusFilter === "refunded"}
                  onClick={() => setStatusFilter("refunded")}
                >
                  REFUNDED ({counts.refunded})
                </ChipButton>
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by id, order, reason…"
                  className={classNames(
                    "h-10 w-full sm:w-[320px] rounded-full border border-white/10",
                    "bg-white/[0.05] backdrop-blur px-4 text-[12px] text-white",
                    "placeholder:text-gray-300/45",
                    "shadow-[0_12px_45px_rgba(0,0,0,0.25)]",
                    "focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_35%,transparent)]"
                  )}
                />
                <button
                  type="button"
                  onClick={load}
                  className={classNames(
                    "h-10 rounded-full px-4",
                    "border border-white/10 bg-white/[0.05] backdrop-blur",
                    "text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80",
                    "hover:bg-white/[0.10] hover:text-white transition active:scale-[0.98]"
                  )}
                >
                  Refresh
                </button>
              </div>
            </div>

            {message && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[12px] text-gray-200/80">
                {message}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="mt-6">
          {loading ? (
            <div className="grid gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <GlassCard className="p-10 text-center">
              <p className="text-lg font-semibold text-white">
                {counts.all === 0 ? "No return requests yet" : "No matches"}
              </p>
              <p className="mt-2 text-sm text-gray-300/70">
                {counts.all === 0
                  ? "When customers request returns, they will appear here."
                  : "Try changing filters or search terms."}
              </p>
              {counts.all > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setSearch("");
                  }}
                  className="mt-5 inline-flex items-center justify-center rounded-full bg-white text-black px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] hover:bg-gray-100 transition active:scale-[0.98]"
                >
                  Clear filters
                </button>
              )}
            </GlassCard>
          ) : (
            <div className="grid gap-4">
              {filtered.map((r) => {
                const busy = busyId === r.id;
                const st = String(r.status || "").toLowerCase();
                const meta = statusMeta(r.status);

                return (
                  <GlassCard key={r.id} className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                            <span className={classNames("size-2 rounded-full", meta.dot)} />
                            <span className="text-[10px] uppercase tracking-[0.26em] text-white/80">
                              {meta.label}
                            </span>
                          </span>

                          {r.refundAmount != null && (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-white/75">
                              Refund ${safeMoney(r.refundAmount)}
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-base sm:text-[16px] font-semibold text-white truncate">
                          Return #{r.id}{" "}
                          <span className="text-white/30 font-normal">·</span> Order #{r.orderId}{" "}
                          <span className="text-white/30 font-normal">·</span> Item #{r.orderItemId}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.18em] text-gray-300/60">
                          <span>Requested: {safeDateLabel(r.requestedAt)}</span>
                          {r.refundedAt ? <span>Refunded: {safeDateLabel(r.refundedAt)}</span> : null}
                        </div>
                      </div>

                      <span
                        className={classNames(
                          "shrink-0 inline-flex items-center rounded-full px-3 py-1.5",
                          "text-[10px] font-semibold uppercase tracking-[0.18em] border",
                          meta.chip
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>

                    {r.reason && (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-gray-300/60">
                          Reason
                        </p>
                        <p className="mt-1 text-sm text-gray-200/85 leading-relaxed">{r.reason}</p>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {st === "requested" && (
                        <>
                          <ActionButton onClick={() => decide(r.id, "approve")} disabled={busy}>
                            {busy ? "Saving…" : "Approve"}
                          </ActionButton>
                          <ActionButton onClick={() => decide(r.id, "reject")} disabled={busy}>
                            {busy ? "Saving…" : "Reject"}
                          </ActionButton>
                        </>
                      )}

                      {st === "approved" && (
                        <ActionButton onClick={() => markReceived(r.id)} disabled={busy}>
                          {busy ? "Processing…" : "Mark Received & Refund"}
                        </ActionButton>
                      )}

                      {st === "rejected" && (
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] text-gray-200/70">
                          No further action.
                        </span>
                      )}

                      {st === "refunded" && (
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] text-gray-200/70">
                          Completed.
                        </span>
                      )}
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

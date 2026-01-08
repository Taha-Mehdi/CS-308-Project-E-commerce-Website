"use client";

import { useEffect, useState } from "react";
import SiteLayout from "../../../components/SiteLayout";
import ActionButton from "../../../components/ActionButton";
import {
  listReturnRequestsApi,
  decideReturnRequestApi,
  markReturnReceivedApi,
} from "../../../lib/api";

function statusChip(statusRaw) {
  const status = String(statusRaw || "").toLowerCase();
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border";

  if (status === "requested")
    return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
  if (status === "approved")
    return `${base} border-sky-500/25 bg-sky-500/10 text-sky-200`;
  if (status === "rejected")
    return `${base} border-rose-500/25 bg-rose-500/10 text-rose-200`;
  if (status === "refunded")
    return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
  return `${base} border-white/10 bg-white/5 text-gray-200/80`;
}

function safeDateLabel(iso) {
  try {
    return iso ? new Date(iso).toLocaleString() : "—";
  } catch {
    return "—";
  }
}

export default function SalesReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);

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
      alert(err?.message || "Failed to save decision.");
    } finally {
      setBusyId(null);
    }
  }

  async function markReceived(id) {
    setBusyId(id);
    try {
      await markReturnReceivedApi(id);
      await load();
    } catch (err) {
      alert(err?.message || "Failed to mark received/refund.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SiteLayout>
      <div className="space-y-6 py-6">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
            Sales Admin
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Return Requests
          </h1>
          <p className="text-sm text-gray-300/70">
            Review requests, approve/reject, then refund after receiving the product.
          </p>
        </div>

        {message && (
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-gray-200/80">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-5 text-[11px] text-gray-300/70">
            Loading return requests…
          </div>
        ) : returns.length === 0 ? (
          <div className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-6 text-center">
            <p className="text-sm text-gray-300/70">No return requests found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {returns.map((r) => {
              const busy = busyId === r.id;
              const status = String(r.status || "").toLowerCase();

              return (
                <div
                  key={r.id}
                  className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-5 space-y-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">
                        Return #{r.id} · Order #{r.orderId} · Item #{r.orderItemId}
                      </p>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-gray-300/60">
                        Requested: {safeDateLabel(r.requestedAt)}
                      </p>
                    </div>

                    <span className={statusChip(r.status)}>{status}</span>
                  </div>

                  {r.reason ? (
                    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-300/60">
                        Reason
                      </p>
                      <p className="text-sm text-gray-200/80">{r.reason}</p>
                    </div>
                  ) : null}

                  {r.decisionNote ? (
                    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-300/60">
                        Decision Note
                      </p>
                      <p className="text-sm text-gray-200/80">{r.decisionNote}</p>
                    </div>
                  ) : null}

                  {r.refundAmount != null && status === "refunded" ? (
                    <p className="text-[11px] text-emerald-200/90">
                      Refunded: ${Number(r.refundAmount).toFixed(2)} · Refund time:{" "}
                      {safeDateLabel(r.refundedAt)}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {status === "requested" ? (
                      <>
                        <ActionButton
                          onClick={() => decide(r.id, "approve")}
                          disabled={busy}
                        >
                          {busy ? "Saving…" : "Approve"}
                        </ActionButton>
                        <ActionButton
                          onClick={() => decide(r.id, "reject")}
                          disabled={busy}
                        >
                          {busy ? "Saving…" : "Reject"}
                        </ActionButton>
                      </>
                    ) : null}

                    {status === "approved" ? (
                      <ActionButton onClick={() => markReceived(r.id)} disabled={busy}>
                        {busy ? "Processing…" : "Mark Received & Refund"}
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

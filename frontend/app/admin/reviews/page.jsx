"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DripLink from "../../../components/DripLink";
import { useAuth } from "../../../context/AuthContext";
import { apiRequest } from "../../../lib/api";

/* -------------------- helpers -------------------- */
function canModerate(user) {
  const rn = user?.roleName || user?.role || user?.role_name || "";
  return rn === "admin" || rn === "product_manager";
}
function fmtDate(iso) {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}
function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}
function toKeyId(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}
function normalizeStatus(s) {
  const st = String(s || "pending").toLowerCase();
  if (st === "approved" || st === "rejected" || st === "pending") return st;
  return "pending";
}
function statusTone(status) {
  const s = normalizeStatus(status);
  if (s === "approved") return "ok";
  if (s === "rejected") return "bad";
  return "warn";
}

const STATUS_LABEL = {
  all: "All",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

/* -------------------- UI bits -------------------- */
function GlassCard({ children, className = "" }) {
  return (
    <div
      className={cx(
        "rounded-[22px] border border-white/10 bg-white/[0.045] backdrop-blur-xl",
        "shadow-[0_18px_70px_rgba(0,0,0,0.55)]",
        className
      )}
    >
      {children}
    </div>
  );
}

function Toast({ message, isError, onClose }) {
  if (!message) return null;
  return (
    <div className="sticky top-3 z-40">
      <div className="mx-auto max-w-[1100px] px-4">
        <div
          className={cx(
            "rounded-2xl border px-4 py-3 text-[12px] sm:text-[13px] flex items-start justify-between gap-3",
            isError
              ? "border-red-500/25 bg-red-500/10 text-red-200"
              : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
            "animate-[fadeIn_200ms_ease-out]"
          )}
        >
          <div className="leading-relaxed">{message}</div>
          <button
            onClick={onClose}
            className={cx(
              "shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
              "border border-white/10 bg-black/20 hover:bg-black/30 text-white/70 hover:text-white"
            )}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const st = normalizeStatus(status);
  const tone = statusTone(st);
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        "border whitespace-nowrap",
        tone === "ok" && "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
        tone === "bad" && "border-red-400/25 bg-red-400/10 text-red-200",
        tone === "warn" && "border-amber-400/25 bg-amber-400/10 text-amber-200"
      )}
    >
      <span
        className={cx(
          "h-1.5 w-1.5 rounded-full",
          tone === "ok" && "bg-emerald-300",
          tone === "bad" && "bg-red-300",
          tone === "warn" && "bg-amber-300"
        )}
      />
      {st}
    </span>
  );
}

function RatingPill({ rating }) {
  const r = typeof rating === "number" ? rating : Number(rating || 0);
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        "border border-white/10 bg-white/5 text-white/75"
      )}
      title="Rating"
    >
      {r} <span className="mx-1 text-white/25">/</span> 5
    </span>
  );
}

/* Dropdown with popover */
function FancySelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDown(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const current = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={rootRef} className="relative w-full sm:w-[220px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "h-10 w-full rounded-full px-4",
          "flex items-center justify-between gap-3",
          "border border-white/10 bg-black/25 hover:bg-black/35 transition",
          "text-[11px] uppercase tracking-[0.18em] text-white/85"
        )}
      >
        <span className="truncate">{current?.label}</span>
        <span className={cx("text-white/50 transition", open && "rotate-180")}>▾</span>
      </button>

      {open && (
        <div
          className={cx(
            "absolute right-0 mt-2 w-full z-30 overflow-hidden",
            "rounded-2xl border border-white/10 bg-[#0b0b10]/95 backdrop-blur-xl",
            "shadow-[0_18px_70px_rgba(0,0,0,0.7)]"
          )}
        >
          <div className="p-2">
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cx(
                    "w-full text-left rounded-xl px-3 py-2.5 transition",
                    "border border-transparent",
                    active ? "bg-white/10 border-white/10 text-white" : "hover:bg-white/5 text-white/80"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.16em]">
                      {opt.label}
                    </div>
                    {active ? <div className="text-[12px] text-emerald-200">✓</div> : null}
                  </div>
                  {opt.hint ? (
                    <div className="mt-1 text-[12px] text-white/55 normal-case tracking-normal">
                      {opt.hint}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButtons({ pending, busy, onApprove, onReject }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={onApprove}
        disabled={!pending || busy}
        className={cx(
          "h-9 rounded-full px-3 min-w-[92px]",
          "text-[11px] font-bold uppercase tracking-[0.18em] transition whitespace-nowrap",
          pending && !busy
            ? "bg-emerald-500/15 text-emerald-200 border border-emerald-400/20 hover:bg-emerald-500/25"
            : "bg-white/5 text-white/30 border border-white/10 cursor-not-allowed"
        )}
      >
        {busy && pending ? "…" : "Approve"}
      </button>

      <button
        onClick={onReject}
        disabled={!pending || busy}
        className={cx(
          "h-9 rounded-full px-3 min-w-[92px]",
          "text-[11px] font-bold uppercase tracking-[0.18em] transition whitespace-nowrap",
          pending && !busy
            ? "bg-red-500/15 text-red-200 border border-red-400/20 hover:bg-red-500/25"
            : "bg-white/5 text-white/30 border border-white/10 cursor-not-allowed"
        )}
      >
        {busy && pending ? "…" : "Reject"}
      </button>
    </div>
  );
}

/* -------------------- page -------------------- */
export default function AdminReviewsPage() {
  const { user, loadingUser } = useAuth();
  const canAccess = canModerate(user);

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [filter, setFilter] = useState("all"); // dropdown-based
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);

  function setMsg(msg, error = false) {
    setMessage(msg);
    setIsError(error);
    if (!error && msg) setTimeout(() => setMessage(""), 2600);
  }

  async function loadReviews() {
    setLoading(true);
    setMessage("");
    try {
      const data = await apiRequest("/reviews/moderation?status=all", { auth: true });
      if (data === null) return;
      setReviews(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setMsg("Failed to load reviews.", true);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!loadingUser && user && canAccess) loadReviews();
    else if (!loadingUser) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingUser, user]);

  // Optimistic update with rollback
  async function moderate(id, action) {
    const keyId = toKeyId(id);
    const snapshot = reviews;
    const nextStatus = action === "approve" ? "approved" : "rejected";

    setBusyId(keyId);
    setReviews((cur) => cur.map((r) => (toKeyId(r.id) === keyId ? { ...r, status: nextStatus } : r)));

    try {
      await apiRequest(`/reviews/${id}/${action}`, { method: "PUT", auth: true });
      setMsg(action === "approve" ? "Comment approved." : "Comment rejected.");
    } catch (e) {
      console.error(e);
      setReviews(snapshot);
      setMsg(`Failed to ${action} comment.`, true);
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = reviews;

    if (filter !== "all") {
      list = list.filter((r) => normalizeStatus(r.status) === filter);
    }
    if (!q) return list;

    return list.filter((r) => {
      const hay = [
        r.userName,
        r.userEmail,
        r.productName,
        r.comment,
        r.userId != null ? `user #${r.userId}` : "",
        r.productId != null ? `product #${r.productId}` : "",
        String(r.rating ?? ""),
        String(r.status ?? ""),
        fmtDate(r.createdAt),
      ]
        .filter(Boolean)
        .join(" • ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [reviews, filter, query]);

  /* -------------------- guards -------------------- */
  if (loadingUser) {
    return (
      <div className="min-h-screen text-white p-6">
        <p className="text-sm text-gray-300/70">Checking access…</p>
      </div>
    );
  }

  if (!user || !canAccess) {
    return (
      <div className="min-h-screen text-white p-6 space-y-4">
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="text-sm text-gray-300/70">Only admins and product managers can moderate comments.</p>
        <DripLink href="/" className="underline text-sm">
          Back to store
        </DripLink>
      </div>
    );
  }

  /* -------------------- UI -------------------- */
  return (
    <div className="min-h-screen text-white w-full">
      <Toast message={message} isError={isError} onClose={() => setMessage("")} />

      <div className="mx-auto max-w-[1100px] px-4 py-6 space-y-5">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
                Sneaks-up · Admin
              </p>
              <h1 className="text-[22px] sm:text-3xl font-semibold tracking-tight">Comment moderation</h1>
              <p className="text-[13px] text-gray-300/70">
                Use the dropdown to view pending/approved/rejected.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadReviews}
                className={cx(
                  "h-10 rounded-full px-4",
                  "border border-white/10 bg-white/5 hover:bg-white/10 transition",
                  "text-[11px] font-semibold uppercase tracking-[0.18em]"
                )}
              >
                Refresh
              </button>

              <DripLink
                href="/admin"
                className={cx(
                  "h-10 inline-flex items-center rounded-full px-4",
                  "border border-white/10 bg-black/20 hover:bg-black/30 transition",
                  "text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80 hover:text-white"
                )}
              >
                Dashboard
              </DripLink>
            </div>
          </div>

          {/* Controls (NO tabs) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="relative w-full sm:w-[360px]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search user, product, comment, rating…"
                className={cx(
                  "h-10 w-full rounded-full px-4 pr-10",
                  "border border-white/10 bg-black/25 hover:bg-black/35 transition",
                  "text-[13px] text-white/85 placeholder:text-white/35",
                  "focus:outline-none focus:ring-2 focus:ring-white/10"
                )}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35">⌕</span>
            </div>

            <FancySelect
              value={filter}
              onChange={(v) => setFilter(v)}
              options={[
                { value: "all", label: "All", hint: "Show everything" },
                { value: "pending", label: "Pending", hint: "Needs moderation" },
                { value: "approved", label: "Approved", hint: "Visible to customers" },
                { value: "rejected", label: "Rejected", hint: "Hidden from customers" },
              ]}
            />
          </div>
        </div>

        {/* Reviews */}
        <GlassCard className="overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.32em] uppercase text-white/55">Reviews</div>
                <div className="mt-1 text-[13px] text-white/80">
                  Showing <span className="font-semibold text-white">{filtered.length}</span>{" "}
                  {filtered.length === 1 ? "comment" : "comments"}{" "}
                  <span className="text-white/40">({STATUS_LABEL[filter]})</span>
                </div>
              </div>

              <div className="hidden sm:block text-[12px] text-white/40">
                Tip: approve/reject only works on pending.
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-5">
              <p className="text-sm text-white/45 italic">Loading…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-5">
              <p className="text-sm text-white/45 italic">No comments in this view 🎉</p>
            </div>
          ) : (
            <div className="p-4 sm:p-5 grid gap-3">
              {filtered.map((r) => {
                const st = normalizeStatus(r.status);
                const pending = st === "pending";
                const busy = busyId === toKeyId(r.id);

                return (
                  <div
                    key={toKeyId(r.id)}
                    className={cx("rounded-2xl border border-white/10 bg-white/[0.03]", "p-4 space-y-3")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold truncate">
                          {r.userName ? r.userName : `User #${r.userId}`}
                        </div>
                        <div className="text-[12px] text-white/55 truncate">{r.userEmail || ""}</div>
                        <div className="mt-1 text-[11px] text-white/40">Created: {fmtDate(r.createdAt)}</div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <StatusPill status={st} />
                        <RatingPill rating={r.rating} />
                      </div>
                    </div>

                    <div className="text-[12px] text-white/55">
                      <span className="text-white/40">Product:</span>{" "}
                      <span className="font-semibold text-white/85">
                        {r.productName ? r.productName : `Product #${r.productId}`}
                      </span>
                      {r.productId != null ? <span className="text-white/40"> · ID: {r.productId}</span> : null}
                    </div>

                    <div className="text-[13px] text-white/85 leading-relaxed">
                      <span className="text-white/40 mr-2">“</span>
                      {r.comment ? r.comment : <span className="italic text-white/45">No comment</span>}
                      <span className="text-white/40 ml-2">”</span>
                    </div>

                    <div className="pt-1">
                      <ActionButtons
                        pending={pending}
                        busy={busy}
                        onApprove={() => moderate(r.id, "approve")}
                        onReject={() => moderate(r.id, "reject")}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-1">
          <DripLink
            href="/"
            className="text-[12px] text-gray-200/70 underline underline-offset-4 hover:text-white"
          >
            Back to store
          </DripLink>
          <div className="text-[12px] text-white/35">Moderation actions are processed server-side.</div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

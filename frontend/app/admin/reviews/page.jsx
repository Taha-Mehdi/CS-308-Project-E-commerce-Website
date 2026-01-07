"use client";

import { useEffect, useState } from "react";
import DripLink from "../../../components/DripLink";
import { useAuth } from "../../../context/AuthContext";
import { apiRequest } from "../../../lib/api";

/* ---------- UI helpers (copied from admin/products) ---------- */
function panelClass() {
  return [
    "rounded-[34px]",
    "border border-white/10",
    "bg-white/[0.04]",
    "backdrop-blur-xl",
    "p-5 sm:p-6",
    "shadow-[0_18px_70px_rgba(0,0,0,0.45)]",
  ].join(" ");
}

function chipBase() {
  return "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border whitespace-nowrap";
}
function chip(tone = "muted") {
  const base = chipBase();
  if (tone === "warn") return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
  if (tone === "bad") return `${base} border-red-500/25 bg-red-500/10 text-red-200`;
  if (tone === "ok") return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
  return `${base} border-white/10 bg-white/5 text-gray-200/80`;
}

function canModerate(user) {
  const rn = user?.roleName || user?.role || user?.role_name || "";
  return rn === "admin" || rn === "product_manager";
}

/* ------------------------------------------------------------ */

export default function AdminReviewsPage() {
  const { user, loadingUser } = useAuth();
  const canAccess = canModerate(user);

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function setMsg(msg, error = false) {
    setMessage(msg);
    setIsError(error);
    if (!error && msg) setTimeout(() => setMessage(""), 3000);
  }

  async function loadReviews() {
    setLoading(true);
    setMessage("");

    try {
      const data = await apiRequest("/reviews/moderation", { auth: true });
      if (data === null) return; // redirected on forbidden
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

  async function approve(id) {
    try {
      await apiRequest(`/reviews/${id}/approve`, {
        method: "PUT",
        auth: true,
      });
      setReviews((prev) => prev.filter((r) => r.id !== id));
      setMsg("Review approved.");
    } catch {
      setMsg("Failed to approve review.", true);
    }
  }

  async function reject(id) {
    try {
      await apiRequest(`/reviews/${id}/reject`, {
        method: "PUT",
        auth: true,
      });
      setReviews((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "rejected" } : r))
      );
      setMsg("Review rejected (kept for admin).");
    } catch {
      setMsg("Failed to reject review.", true);
    }
  }

  /* ---------- Guards ---------- */
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
        <p className="text-sm text-gray-300/70">
          Only admins and product managers can moderate reviews.
        </p>
        <DripLink href="/" className="underline text-sm">
          Back to store
        </DripLink>
      </div>
    );
  }

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
            Sneaks-up · Admin
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Reviews moderation
          </h1>
          <p className="text-sm text-gray-300/70">
            Pending and rejected reviews awaiting action.
          </p>
        </div>

        {message && (
          <div
            className={`rounded-2xl border px-4 py-3 text-[11px] ${
              isError
                ? "border-red-500/20 bg-red-500/10 text-red-200"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {message}
          </div>
        )}

        <div className={panelClass() + " border-amber-500/20"}>
          <h3 className="text-sm font-bold uppercase tracking-widest text-amber-200/70">
            Reviews ({reviews.length})
          </h3>

          {loading ? (
            <p className="text-xs text-white/40 italic mt-4">Loading…</p>
          ) : reviews.length === 0 ? (
            <p className="text-xs text-white/40 italic mt-4">
              No reviews to moderate 🎉
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {reviews.map((r) => {
                const tone = r.status === "rejected" ? "bad" : "warn";
                return (
                  <div
                    key={r.id}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2"
                  >
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold">
                          User #{r.userId}
                        </p>
                        <p className="text-[11px] text-white/60">
                          Product #{r.productId}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={chip(tone)}>{r.status}</span>
                        <span className="text-[10px] text-amber-200 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          {r.rating} / 5
                        </span>
                      </div>
                    </div>

                    <p className="text-xs italic text-gray-300">
                      “{r.comment || "No comment"}”
                    </p>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => approve(r.id)}
                        className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-200 px-3 py-1.5 rounded-full hover:bg-emerald-500/30"
                      >
                        Approve
                      </button>

                      <button
                        onClick={() => reject(r.id)}
                        className="text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-200 px-3 py-1.5 rounded-full hover:bg-red-500/30"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DripLink
          href="/admin"
          className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
        >
          Back to dashboard
        </DripLink>
      </div>
    </div>
  );
}

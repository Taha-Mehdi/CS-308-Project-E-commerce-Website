"use client";

import { useEffect, useMemo, useState } from "react";
import DripLink from "../../components/DripLink";
import SiteLayout from "../../components/SiteLayout";
import Skeleton from "../../components/Skeleton";
import { useAuth } from "../../context/AuthContext";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

function initialsFromName(fullName) {
  if (!fullName) return "SU";
  const parts = fullName.trim().split(" ").filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "SU";
}

// ✅ FIXED: Better status labels. "None" now displays as "RATED"
function reviewStatusChip(status) {
  const s = String(status || "unknown").toLowerCase();
  const base =
      "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border";

  if (s === "approved") return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
  if (s === "pending") return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
  if (s === "rejected") return `${base} border-red-500/25 bg-red-500/10 text-red-200`;

  // Handle "none" or unknown as just a neutral "Rated" tag
  return `${base} border-white/10 bg-white/5 text-gray-400`;
}

function getStatusLabel(status) {
  const s = String(status || "").toLowerCase();
  if (s === "none") return "RATED";
  return s.toUpperCase();
}

function Stars({ value = 0 }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  const full = Math.floor(v);
  return (
      <div className="flex items-center gap-1" aria-label={`Rating ${v} out of 5`}>
        {Array.from({ length: 5 }).map((_, i) => (
            <span
                key={i}
                className={[i < full ? "text-white" : "text-white/20", "text-sm", "leading-none"].join(" ")}
            >
          ★
        </span>
        ))}
      </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
      <div
          className="
        rounded-[18px] border border-white/10 bg-black/35 backdrop-blur
        px-4 py-3 text-[11px] text-gray-200/85
        shadow-[0_16px_50px_rgba(0,0,0,0.45)]
      "
      >
        {message}
      </div>
  );
}

function formatMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

export default function AccountPage() {
  const { user, loadingUser } = useAuth();

  /* ---------------- MY REVIEWS ---------------- */
  const [myReviews, setMyReviews] = useState([]);
  const [loadingMyReviews, setLoadingMyReviews] = useState(true);
  const [message, setMessage] = useState("");

  /* ---------- LOAD MY REVIEWS ---------- */
  useEffect(() => {
    let alive = true;

    async function loadMyReviews() {
      setLoadingMyReviews(true);
      try {
        const token =
            typeof window !== "undefined" ? localStorage.getItem("token") : null;

        if (!token) {
          if (alive) setMyReviews([]);
          return;
        }

        const res = await fetch(`${apiBase}/reviews/my`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (!res.ok) {
          if (alive) setMyReviews([]);
          return;
        }

        const data = await res.json();

        // Extract array from response object
        const list = Array.isArray(data?.reviews)
            ? data.reviews
            : Array.isArray(data)
                ? data
                : [];

        if (alive) setMyReviews(list);
      } catch {
        if (alive) setMyReviews([]);
      } finally {
        if (alive) setLoadingMyReviews(false);
      }
    }

    if (!loadingUser && user) loadMyReviews();
    return () => {
      alive = false;
    };
  }, [loadingUser, user]);

  const totalApprovedComments = useMemo(() => {
    return (Array.isArray(myReviews) ? myReviews : []).filter((r) => {
      const st = String(r?.status || r?.comment_status || "").toLowerCase();
      const hasText = Boolean(String(r?.comment || r?.comment_text || "").trim());
      // "none" counts as approved for rating stats in some contexts, but strictly for comments we usually check approved
      return (st === "approved" || st === "none") && hasText;
    }).length;
  }, [myReviews]);

  /* ---------- AUTH GATES ---------- */
  if (loadingUser) {
    return (
        <SiteLayout>
          <p className="text-sm text-gray-300/70">Checking your account…</p>
        </SiteLayout>
    );
  }

  if (!user) {
    return (
        <SiteLayout>
          <div className="py-6 space-y-4">
            <p className="text-sm text-gray-300/70">Please sign in to view your profile.</p>
            <DripLink
                href="/login"
                className="
                h-10 px-5 inline-flex items-center justify-center rounded-full
                bg-white text-black text-[11px] font-semibold uppercase tracking-[0.18em]
                hover:opacity-90 transition
              "
            >
              Login
            </DripLink>
          </div>
        </SiteLayout>
    );
  }

  const accountBalance = formatMoney(user?.accountBalance);

  return (
      <SiteLayout>
        <div className="space-y-10 py-6">
          {/* HEADER */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/60">
                My Profile
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Hey, {user.fullName || "Sneakerhead"}
              </h1>
              <p className="text-[12px] text-gray-300/70">
                Manage your personal details and view your activity.
              </p>
            </div>

            <div className="flex flex-col gap-3 min-w-[280px]">
              {/* User Chip */}
              <div
                  className="
                rounded-[26px] border border-border bg-black/25 backdrop-blur
                px-5 py-3 shadow-[0_18px_55px_rgba(0,0,0,0.45)]
                flex items-center gap-4
              "
              >
                <div className="h-11 w-11 rounded-full border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-100">
                  {initialsFromName(user.fullName)}
                </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {user.fullName || "SNEAKS-UP Member"}
                  </p>
                  <p className="text-[11px] text-gray-300/60 truncate">{user.email}</p>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-2">
                {/* Account Balance */}
                <div className="rounded-[20px] border border-white/10 bg-black/20 backdrop-blur px-4 py-3">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-gray-400">Balance</p>
                  <p className="mt-1 text-lg font-semibold text-white">${accountBalance}</p>
                </div>

                {/* Total Reviews */}
                <div className="rounded-[20px] border border-white/10 bg-black/20 backdrop-blur px-4 py-3">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-gray-400">Reviews</p>
                  <p className="mt-1 text-lg font-semibold text-white">{totalApprovedComments}</p>
                </div>
              </div>
            </div>
          </div>

          {/* TOAST */}
          <Toast message={message} />

          {/* ---------- PERSONAL DETAILS ---------- */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-white">
              Personal Details
            </h2>

            <div className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-6 shadow-[0_16px_60px_rgba(0,0,0,0.40)]">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60 mb-2">Full Name</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-semibold">{user.fullName || "—"}</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60 mb-2">Email Address</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-semibold">{user.email || "—"}</span>
                  </div>
                </div>

                {/* ✅ ADDED: Customer ID */}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60 mb-2">Customer ID</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-semibold">#{user.id}</span>
                  </div>
                </div>

                {/* ✅ ADDED: Tax ID */}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60 mb-2">Tax ID</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-semibold">{user.taxId || "—"}</span>
                  </div>
                </div>

                <div className="sm:col-span-2 lg:col-span-1">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-gray-300/60 mb-2">Shipping Address</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-semibold break-words">{user.address || "No address set"}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---------- MY REVIEWS ---------- */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-white">
                  My Reviews
                </h2>
                {loadingMyReviews ? (
                    <span className="text-[10px] text-gray-500">...</span>
                ) : (
                    <span className="text-[10px] text-gray-500 font-medium tracking-wider">
                    {myReviews.length} SUBMITTED
                  </span>
                )}
              </div>

              <DripLink
                  href="/products"
                  className="
                text-[11px] font-semibold uppercase tracking-[0.18em]
                text-gray-200/70 hover:text-white
                underline underline-offset-4
              "
              >
                Rate products
              </DripLink>
            </div>

            {loadingMyReviews ? (
                <div className="grid gap-3">
                  <Skeleton className="h-24 rounded-[26px]" />
                  <Skeleton className="h-24 rounded-[26px]" />
                </div>
            ) : myReviews.length === 0 ? (
                <div className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-8 text-center">
                  <p className="text-sm font-medium text-gray-300">You haven’t submitted any reviews yet.</p>
                  <p className="mt-2 text-[11px] text-gray-500">
                    Share your thoughts on products you've purchased to help others.
                  </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {myReviews.map((r) => {
                    const productName = r?.productName || r?.product?.name || `Product #${r?.productId}`;
                    const status = r?.status || r?.commentStatus || r?.comment_status || "none";
                    const rejectionReason = r?.rejectionReason || r?.rejection_reason || null;

                    return (
                        <div
                            key={r.id}
                            className="
                      rounded-[26px] border border-white/10 bg-black/20 backdrop-blur
                      p-5 shadow-[0_14px_55px_rgba(0,0,0,0.35)]
                      flex flex-col gap-3
                    "
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-white truncate max-w-[150px]">{productName}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <Stars value={r?.rating || 0} />
                              </div>
                            </div>
                            {/* ✅ FIXED: Use getStatusLabel to show 'RATED' instead of 'NONE' */}
                            <span className={reviewStatusChip(status)}>
                          {getStatusLabel(status)}
                        </span>
                          </div>

                          {r?.comment ? (
                              <div className="flex-1 rounded-2xl border border-white/5 bg-black/20 p-3">
                                <p className="text-[11px] text-gray-300 leading-relaxed line-clamp-3">"{r.comment}"</p>
                              </div>
                          ) : (
                              <p className="text-[11px] text-gray-500 italic">No written review.</p>
                          )}

                          {String(status).toLowerCase() === "rejected" && rejectionReason && (
                              <p className="text-[10px] text-red-300 bg-red-500/10 px-3 py-2 rounded-xl border border-red-500/20">
                                Reason: {rejectionReason}
                              </p>
                          )}
                        </div>
                    );
                  })}
                </div>
            )}
          </section>
        </div>
      </SiteLayout>
  );
}
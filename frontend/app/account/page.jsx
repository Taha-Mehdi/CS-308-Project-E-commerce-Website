"use client";

import { useEffect, useMemo, useState } from "react";
import DripLink from "../../components/DripLink";
import SiteLayout from "../../components/SiteLayout";
import ProductCard from "../../components/ProductCard";
import Skeleton from "../../components/Skeleton";
import { useAuth } from "../../context/AuthContext";
import { getWishlistApi, removeFromWishlistApi, addToCartApi } from "../../lib/api";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

function initialsFromName(fullName) {
  if (!fullName) return "SU";
  const parts = fullName.trim().split(" ").filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "SU";
}

function statusChip(status) {
  const s = String(status || "unknown").toLowerCase();
  const base =
    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border";

  if (s === "delivered")
    return `${base} bg-emerald-500/10 text-emerald-200 border-emerald-500/25`;
  if (s === "in_transit" || s === "in transit")
    return `${base} bg-blue-500/10 text-blue-200 border-blue-500/25`;
  if (s === "processing")
    return `${base} bg-amber-500/10 text-amber-200 border-amber-500/25`;
  if (s === "cancelled")
    return `${base} bg-red-500/10 text-red-200 border-red-500/25`;

  return `${base} bg-white/5 text-gray-200/80 border-white/10`;
}

function reviewStatusChip(status) {
  const s = String(status || "unknown").toLowerCase();
  const base =
    "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border";

  if (s === "approved") return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
  if (s === "pending") return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
  if (s === "rejected") return `${base} border-red-500/25 bg-red-500/10 text-red-200`;
  if (s === "none") return `${base} border-white/10 bg-white/5 text-gray-200/70`;
  return `${base} border-white/10 bg-white/5 text-gray-200/70`;
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

export default function AccountPage() {
  const { user, loadingUser } = useAuth();

  /* ---------------- ORDERS ---------------- */
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  /* ---------------- WISHLIST ---------------- */
  const [wishlist, setWishlist] = useState([]);
  const [loadingWishlist, setLoadingWishlist] = useState(true);

  // per-product loading states
  const [movingToBag, setMovingToBag] = useState(() => new Set());
  const [removing, setRemoving] = useState(() => new Set());

  /* ---------------- MY REVIEWS ---------------- */
  const [myReviews, setMyReviews] = useState([]);
  const [loadingMyReviews, setLoadingMyReviews] = useState(true);

  const [message, setMessage] = useState("");

  /* ---------- LOAD ORDERS ---------- */
  useEffect(() => {
    async function loadMyOrders() {
      setLoadingOrders(true);
      try {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;

        if (!token) {
          setOrders([]);
          return;
        }

        const res = await fetch(`${apiBase}/orders/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        setOrders(Array.isArray(data?.orders) ? data.orders : []);
      } catch {
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    }

    if (!loadingUser && user) loadMyOrders();
  }, [loadingUser, user]);

  /* ---------- LOAD WISHLIST ---------- */
  useEffect(() => {
    async function loadWishlist() {
      setLoadingWishlist(true);
      try {
        const data = await getWishlistApi();
        setWishlist(Array.isArray(data?.products) ? data.products : []);
      } catch {
        setWishlist([]);
      } finally {
        setLoadingWishlist(false);
      }
    }

    if (!loadingUser && user) loadWishlist();
  }, [loadingUser, user]);

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

        // Expected endpoint (spec): show user’s submissions with status and rejection reason.
        const res = await fetch(`${apiBase}/reviews/my`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (!res.ok) {
          if (alive) setMyReviews([]);
          return;
        }

        const data = await res.json();
        if (alive) setMyReviews(Array.isArray(data) ? data : []);
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

  function withSet(setter, id, on) {
    setter((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleRemoveFromWishlist(productId) {
    setMessage("");
    withSet(setRemoving, productId, true);

    try {
      await removeFromWishlistApi(productId);
      setWishlist((prev) => prev.filter((p) => p.id !== productId));
      setMessage("Removed from wishlist.");
    } catch {
      setMessage("Could not remove from wishlist.");
    } finally {
      withSet(setRemoving, productId, false);
    }
  }

  async function handleMoveToBag(productId) {
    setMessage("");
    withSet(setMovingToBag, productId, true);

    try {
      await addToCartApi({ productId, quantity: 1 });

      // remove from wishlist after successful add (best UX)
      try {
        await removeFromWishlistApi(productId);
        setWishlist((prev) => prev.filter((p) => p.id !== productId));
      } catch {
        // ignore: cart already succeeded
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cart-updated"));
      }

      setMessage("Added to bag.");
    } catch {
      setMessage("Could not add to bag.");
    } finally {
      withSet(setMovingToBag, productId, false);
    }
  }

  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 3),
    [orders]
  );

  // Spec: Total Reviews = count of APPROVED comments by user
  const totalApprovedComments = useMemo(() => {
    return (Array.isArray(myReviews) ? myReviews : []).filter((r) => {
      const st = String(r?.status || r?.comment_status || "").toLowerCase();
      const hasText = Boolean(String(r?.comment || r?.comment_text || "").trim());
      return st === "approved" && hasText;
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
        <p className="text-sm text-gray-300/70">Please sign in to view your account.</p>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="space-y-10 py-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/60">
              Account
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Hey, {user.fullName || "Sneakerhead"}
            </h1>
            <p className="text-[12px] text-gray-300/70">
              Wishlist alerts + order status for{" "}
              <span className="text-gray-100 font-semibold">{user.email}</span>.
            </p>
            <p className="mt-2 text-[11px] text-gray-300/60">
              Total Reviews (approved comments):{" "}
              <span className="text-white font-semibold">{totalApprovedComments}</span>
            </p>
          </div>

          <div
            className="
              rounded-[26px] border border-border bg-black/25 backdrop-blur
              px-5 py-3 shadow-[0_18px_55px_rgba(0,0,0,0.45)]
              flex items-center gap-4
            "
          >
            <div className="h-11 w-11 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
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
        </div>

        {/* TOAST */}
        <Toast message={message} />

        {/* ---------- MY REVIEWS ---------- */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-white">
                My Reviews
              </h2>

              <span
                className="
                  inline-flex items-center gap-2 rounded-full px-3 py-1
                  border border-white/10 bg-white/5
                  text-[10px] font-semibold uppercase tracking-[0.18em]
                  text-gray-200/80
                "
              >
                <span className="inline-block size-1.5 rounded-full bg-[var(--drip-accent)]" />
                {loadingMyReviews ? "…" : `${myReviews.length} submitted`}
              </span>
            </div>

            <DripLink
              href="/products"
              className="
                text-[11px] font-semibold uppercase tracking-[0.18em]
                text-gray-200/70 hover:text-white
                underline underline-offset-4
              "
            >
              Browse products
            </DripLink>
          </div>

          {loadingMyReviews ? (
            <Skeleton className="h-24 rounded-[28px]" />
          ) : myReviews.length === 0 ? (
            <div className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-5 text-[11px] text-gray-300/70">
              No reviews yet. (Ratings count immediately; comments appear after approval.)
            </div>
          ) : (
            <div className="grid gap-3">
              {myReviews
                .slice()
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .map((r) => {
                  const status = String(r.status || r.comment_status || "unknown").toLowerCase();
                  const comment = String(r.comment || r.comment_text || "").trim();
                  const rejectionReason = r.rejectionReason || r.rejection_reason || "";
                  const productLabel = r.productName || r.product_name || (r.productId ? `Product #${r.productId}` : "Product");

                  return (
                    <div
                      key={r.id}
                      className="
                        rounded-[28px] border border-border bg-black/20 backdrop-blur
                        p-5 shadow-[0_16px_60px_rgba(0,0,0,0.40)]
                        space-y-3
                      "
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{productLabel}</p>
                          <p className="text-[11px] text-gray-300/60">
                            {String(r.createdAt || "").slice(0, 10)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={reviewStatusChip(status)}>{status}</span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                            <Stars value={r.rating} />
                            <span className="text-[11px] text-white/80 font-semibold">
                              {Number(r.rating || 0)}/5
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                        <p className="text-[12px] text-gray-200/85 leading-relaxed">
                          {comment ? comment : <span className="italic text-gray-200/60">No comment.</span>}
                        </p>

                        {status === "rejected" && rejectionReason ? (
                          <p className="mt-3 text-[11px] text-rose-200/80">
                            <span className="font-semibold">Rejection reason:</span> {rejectionReason}
                          </p>
                        ) : null}

                        {status === "pending" ? (
                          <p className="mt-3 text-[11px] text-amber-200/70 italic">
                            Pending approval (not public yet).
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* ---------- WISHLIST ---------- */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-white">
                Wishlist
              </h2>

              <span
                className="
                  inline-flex items-center gap-2 rounded-full px-3 py-1
                  border border-white/10 bg-white/5
                  text-[10px] font-semibold uppercase tracking-[0.18em]
                  text-gray-200/80
                "
              >
                <span className="inline-block size-1.5 rounded-full bg-[var(--drip-accent)]" />
                {loadingWishlist ? "…" : `${wishlist.length} items`}
              </span>
            </div>

            <DripLink
              href="/products"
              className="
                text-[11px] font-semibold uppercase tracking-[0.18em]
                text-gray-200/70 hover:text-white
                underline underline-offset-4
              "
            >
              Browse
            </DripLink>
          </div>

          {loadingWishlist ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Skeleton className="h-72 rounded-[28px]" />
              <Skeleton className="h-72 rounded-[28px]" />
              <Skeleton className="h-72 rounded-[28px]" />
            </div>
          ) : wishlist.length === 0 ? (
            <div
              className="
                rounded-[28px] border border-border bg-black/20 backdrop-blur
                p-6 shadow-[0_16px_60px_rgba(0,0,0,0.40)]
              "
            >
              <p className="text-sm font-semibold text-white">No saved pairs yet.</p>
              <p className="mt-2 text-[12px] text-gray-300/70">
                Add products to your wishlist to get discount emails when sales managers apply
                discounts.
              </p>
              <div className="mt-4">
                <DripLink
                  href="/products"
                  className="
                    h-10 px-5 inline-flex items-center justify-center rounded-full
                    bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                    text-black text-[11px] font-semibold uppercase tracking-[0.18em]
                    hover:opacity-95 transition active:scale-[0.98]
                  "
                >
                  Explore products
                </DripLink>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
              {wishlist.map((product) => {
                const isMoving = movingToBag.has(product.id);
                const isRemoving = removing.has(product.id);

                return (
                  <div key={product.id} className="relative group/actions">
                    <div
                      className="
                        [&_p]:opacity-0 sm:[&_p]:opacity-100
                        sm:group-hover/actions:[&_p]:opacity-0
                        sm:group-focus-within/actions:[&_p]:opacity-0
                        transition-opacity duration-200
                      "
                    >
                      <ProductCard product={product} />
                    </div>

                    <div
                      className="
                        absolute left-4 right-4 bottom-4 z-10
                        opacity-0 translate-y-2
                        sm:group-hover/actions:opacity-100 sm:group-hover/actions:translate-y-0
                        sm:group-focus-within/actions:opacity-100 sm:group-focus-within/actions:translate-y-0
                        transition-all duration-200
                        pointer-events-none
                      "
                    >
                      <div
                        className="
                          pointer-events-auto
                          rounded-full border border-white/10
                          bg-black/55 backdrop-blur
                          shadow-[0_18px_55px_rgba(0,0,0,0.55)]
                          p-1 flex items-center gap-2
                        "
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <button
                          type="button"
                          disabled={isMoving || isRemoving}
                          className={`
                            flex-1 h-10 px-4 rounded-full
                            text-[11px] font-semibold uppercase tracking-[0.18em]
                            transition active:scale-[0.98]
                            ${
                              isMoving
                                ? "bg-white/10 text-gray-200/70 cursor-not-allowed"
                                : "bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] text-black hover:opacity-95"
                            }
                          `}
                          onClick={() => handleMoveToBag(product.id)}
                        >
                          {isMoving ? "Adding…" : "Move to bag"}
                        </button>

                        <button
                          type="button"
                          disabled={isRemoving || isMoving}
                          className={`
                            h-10 px-4 rounded-full
                            text-[11px] font-semibold uppercase tracking-[0.18em]
                            border transition active:scale-[0.98]
                            ${
                              isRemoving
                                ? "border-white/10 bg-white/5 text-gray-200/60 cursor-not-allowed"
                                : "border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/15"
                            }
                          `}
                          onClick={() => handleRemoveFromWishlist(product.id)}
                        >
                          {isRemoving ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    </div>

                    <div className="sm:hidden absolute left-4 right-4 bottom-4 z-10">
                      <div
                        className="
                          rounded-full border border-white/10 bg-black/55 backdrop-blur
                          p-1 flex items-center gap-2 shadow-[0_18px_55px_rgba(0,0,0,0.55)]
                        "
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <button
                          type="button"
                          disabled={isMoving || isRemoving}
                          className={`
                            flex-1 h-10 px-4 rounded-full
                            text-[11px] font-semibold uppercase tracking-[0.18em]
                            transition active:scale-[0.98]
                            ${
                              isMoving
                                ? "bg-white/10 text-gray-200/70 cursor-not-allowed"
                                : "bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] text-black hover:opacity-95"
                            }
                          `}
                          onClick={() => handleMoveToBag(product.id)}
                        >
                          {isMoving ? "Adding…" : "Move to bag"}
                        </button>

                        <button
                          type="button"
                          disabled={isRemoving || isMoving}
                          className={`
                            h-10 px-4 rounded-full
                            text-[11px] font-semibold uppercase tracking-[0.18em]
                            border transition active:scale-[0.98]
                            ${
                              isRemoving
                                ? "border-white/10 bg-white/5 text-gray-200/60 cursor-not-allowed"
                                : "border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/15"
                            }
                          `}
                          onClick={() => handleRemoveFromWishlist(product.id)}
                        >
                          {isRemoving ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ---------- RECENT ORDERS ---------- */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-white">
              Recent Orders
            </h2>
            <DripLink
              href="/orders"
              className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
            >
              View all
            </DripLink>
          </div>

          {loadingOrders ? (
            <Skeleton className="h-24 rounded-[28px]" />
          ) : recentOrders.length === 0 ? (
            <div className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-5 text-[11px] text-gray-300/70">
              No orders yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="
                    rounded-[28px] border border-border bg-black/20 backdrop-blur
                    p-5 shadow-[0_16px_60px_rgba(0,0,0,0.40)]
                    flex items-center justify-between gap-4
                  "
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">Order #{order.id}</p>
                    <div className="mt-2">
                      <span className={statusChip(order.status)}>
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--drip-accent)]" />
                        {String(order.status || "unknown").replaceAll("_", " ")}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-white">
                    ${Number(order.total || 0).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </SiteLayout>
  );
}

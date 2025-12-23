"use client";

import { useEffect, useMemo, useState } from "react";
import DripLink from "../../components/DripLink";
import SiteLayout from "../../components/SiteLayout";
import { useAuth } from "../../context/AuthContext";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

function initialsFromName(fullName) {
  if (!fullName) return "SU";
  const parts = fullName.trim().split(" ").filter(Boolean);
  const s = parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
  return s || "SU";
}

function statusChip(status) {
  const s = String(status || "unknown").toLowerCase();

  // keep it simple + premium
  const base =
    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border";

  if (s === "delivered") {
    return `${base} bg-emerald-500/10 text-emerald-200 border-emerald-500/25`;
  }
  if (s === "in_transit" || s === "in transit") {
    return `${base} bg-blue-500/10 text-blue-200 border-blue-500/25`;
  }
  if (s === "processing") {
    return `${base} bg-amber-500/10 text-amber-200 border-amber-500/25`;
  }
  if (s === "cancelled") {
    return `${base} bg-red-500/10 text-red-200 border-red-500/25`;
  }

  return `${base} bg-white/5 text-gray-200/80 border-white/10`;
}

export default function AccountPage() {
  const { user, loadingUser } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [message, setMessage] = useState("");

  // Load user's own orders
  useEffect(() => {
    async function loadMyOrders() {
      setLoadingOrders(true);
      setMessage("");

      try {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;

        if (!token) {
          setOrders([]);
          setLoadingOrders(false);
          return;
        }

        const res = await fetch(`${apiBase}/orders/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          let msg = "Failed to load your orders.";
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            try {
              const errJson = await res.json();
              if (errJson?.message) msg = errJson.message;
            } catch {}
          }
          setMessage(msg);
          setOrders([]);
          setLoadingOrders(false);
          return;
        }

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          setMessage("Unexpected response while loading orders.");
          setOrders([]);
          setLoadingOrders(false);
          return;
        }

        let data;
        try {
          data = await res.json();
        } catch {
          setMessage("Could not decode orders.");
          setOrders([]);
          setLoadingOrders(false);
          return;
        }

        if (Array.isArray(data)) setOrders(data);
        else if (Array.isArray(data?.orders)) setOrders(data.orders);
        else setOrders([]);
      } catch (err) {
        console.error("Account orders load error:", err);
        setMessage("Failed to load your orders.");
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    }

    if (!loadingUser && user) loadMyOrders();
    else if (!loadingUser) setLoadingOrders(false);
  }, [loadingUser, user]);

  // Sort orders newest → oldest
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
  }, [orders]);

  const recentOrders = useMemo(() => sortedOrders.slice(0, 3), [sortedOrders]);

  // AUTH GATES
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
        <div className="space-y-6 py-6">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Account
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Your SNEAKS-UP profile
            </h1>
            <p className="text-sm text-gray-300/70">
              Sign in to track orders, manage your bag, and save your history.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <DripLink
              href="/login"
              className="
                h-10 px-5 inline-flex items-center justify-center rounded-full
                bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                text-black text-[11px] font-semibold uppercase tracking-[0.18em]
                hover:opacity-95 transition active:scale-[0.98]
              "
            >
              Login
            </DripLink>
            <DripLink
              href="/register"
              className="
                h-10 px-5 inline-flex items-center justify-center rounded-full
                border border-border bg-white/5 text-[11px] font-semibold
                uppercase tracking-[0.18em] text-gray-100 hover:bg-white/10
                transition active:scale-[0.98]
              "
            >
              Create account
            </DripLink>
          </div>

          <p className="text-[11px] text-gray-300/55">
            Already shopped? Log in with the same email to see your history.
          </p>
        </div>
      </SiteLayout>
    );
  }

  // LOGGED-IN UI
  return (
    <SiteLayout>
      <div className="space-y-8 py-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Account
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Hey, {user.fullName || "Sneakerhead"}
            </h1>
            <p className="text-sm text-gray-300/70">
              Your control room — orders, bag and drops linked to{" "}
              <span className="font-semibold text-gray-100">{user.email}</span>.
            </p>
          </div>

          {/* Profile card */}
          <div className="rounded-[28px] border border-border bg-black/25 backdrop-blur px-5 py-4 shadow-[0_16px_60px_rgba(0,0,0,0.45)] flex items-center gap-4">
            <div className="h-11 w-11 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-100">
                {initialsFromName(user.fullName)}
              </span>
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user.fullName || "SNEAKS-UP Member"}
              </p>
              <p className="text-[11px] text-gray-300/60 truncate">
                {user.email}
              </p>
            </div>
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="grid gap-4 sm:grid-cols-3">
          <DripLink
            href="/products"
            className="
              group rounded-[28px] border border-border bg-black/20 backdrop-blur
              p-5 shadow-[0_16px_60px_rgba(0,0,0,0.40)]
              hover:bg-black/25 transition
            "
          >
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Browse
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              Browse drops
            </p>
            <p className="mt-1 text-[11px] text-gray-300/60">
              Explore what’s live in the vault.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100/90">
              Open <span className="opacity-70 group-hover:opacity-100">→</span>
            </div>
          </DripLink>

          <DripLink
            href="/cart"
            className="
              group rounded-[28px] border border-border bg-black/20 backdrop-blur
              p-5 shadow-[0_16px_60px_rgba(0,0,0,0.40)]
              hover:bg-black/25 transition
            "
          >
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Bag
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              View your bag
            </p>
            <p className="mt-1 text-[11px] text-gray-300/60">
              Review pairs lined up before checkout.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100/90">
              Open <span className="opacity-70 group-hover:opacity-100">→</span>
            </div>
          </DripLink>

          <DripLink
            href="/orders"
            className="
              group rounded-[28px] border border-border bg-black/20 backdrop-blur
              p-5 shadow-[0_16px_60px_rgba(0,0,0,0.40)]
              hover:bg-black/25 transition
            "
          >
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              History
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              Your orders
            </p>
            <p className="mt-1 text-[11px] text-gray-300/60">
              Track status & download invoices.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100/90">
              Open <span className="opacity-70 group-hover:opacity-100">→</span>
            </div>
          </DripLink>
        </div>

        {/* RECENT ORDERS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
                Recent
              </p>
              <p className="text-sm font-semibold text-white">
                Recent orders
              </p>
            </div>

            <DripLink
              href="/orders"
              className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
            >
              View full history
            </DripLink>
          </div>

          {loadingOrders ? (
            <div className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-5 text-[11px] text-gray-300/70">
              Loading your orders…
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-5 text-[11px] text-gray-300/70">
              No orders yet. Once you check out, they’ll appear here.
            </div>
          ) : (
            <div className="grid gap-4">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="
                    rounded-[28px] border border-border bg-black/20 backdrop-blur
                    p-5 shadow-[0_16px_60px_rgba(0,0,0,0.40)]
                    flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4
                  "
                >
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-semibold text-white">
                      Order #{order.id}
                    </p>

                    <p className="text-[11px] text-gray-300/60">
                      Placed{" "}
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleString()
                        : "N/A"}
                    </p>

                    <div className="pt-1">
                      <span className={statusChip(order.status)}>
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--drip-accent)]" />
                        {String(order.status || "unknown").replaceAll("_", " ")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <p className="text-sm font-semibold text-white">
                      ${Number(order.total || 0).toFixed(2)}
                    </p>

                    <DripLink
                      href="/orders"
                      className="
                        h-9 px-4 inline-flex items-center justify-center rounded-full
                        border border-border bg-white/5 text-[11px] font-semibold
                        uppercase tracking-[0.18em] text-gray-100 hover:bg-white/10
                        transition active:scale-[0.98]
                      "
                    >
                      Details
                    </DripLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTNOTE */}
        {message && (
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-gray-200/80">
            {message}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

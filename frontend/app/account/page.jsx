"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../components/SiteLayout";
import { useAuth } from "../../context/AuthContext";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

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
          typeof window !== "undefined"
            ? localStorage.getItem("token")
            : null;

        if (!token) {
          setOrders([]);
          setLoadingOrders(false);
          return;
        }

        const res = await fetch(`${apiBase}/orders/my`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          let msg = "Failed to load your orders.";
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            try {
              const errJson = await res.json();
              if (errJson && errJson.message) {
                msg = errJson.message;
              }
            } catch {
              // ignore parse error
            }
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

        // Support both array and { orders, items }
        if (Array.isArray(data)) {
          setOrders(data);
        } else if (Array.isArray(data.orders)) {
          setOrders(data.orders);
        } else {
          setOrders([]);
        }
      } catch (err) {
        console.error("Account orders load error:", err);
        setMessage("Failed to load your orders.");
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    }

    if (!loadingUser && user) {
      loadMyOrders();
    } else if (!loadingUser) {
      setLoadingOrders(false);
    }
  }, [loadingUser, user]);

  // Sort orders newest → oldest
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
  }, [orders]);

  const recentOrders = useMemo(
    () => sortedOrders.slice(0, 3),
    [sortedOrders]
  );

  // AUTH GATES
  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-500">Checking your account…</p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-5">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-500">
              Sneaks-up
            </p>
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
              Your SNEAKS-UP account
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Sign in to track your orders, bag, and drops in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-semibold uppercase tracking-[0.18em] text-gray-800 hover:bg-gray-100 transition-colors"
            >
              Create account
            </Link>
          </div>

          <p className="text-[11px] text-gray-500">
            Already shopped? Log in with the same email to see your history.
          </p>
        </div>
      </SiteLayout>
    );
  }

  // LOGGED-IN UI
  return (
    <SiteLayout>
      <div className="space-y-7">
        {/* HEADER + PROFILE CARD */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-500">
              Sneaks-up
            </p>
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
              Hey, {user.fullName || "Sneakerhead"}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              This is your control room — orders, bag and drops all linked to{" "}
              <span className="font-medium text-gray-900">
                {user.email}
              </span>
              .
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 sm:px-5 sm:py-4 shadow-sm flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-black text-white flex items-center justify-center text-xs font-semibold uppercase tracking-[0.18em]">
              {user.fullName
                ? user.fullName
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                : "SU"}
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-gray-900">
                {user.fullName || "SNEAKS-UP Member"}
              </p>
              <p className="text-[11px] text-gray-500">{user.email}</p>
            </div>
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/products"
            className="rounded-2xl border border-gray-200 bg-white px-4 py-4 sm:px-5 sm:py-5 shadow-sm flex flex-col gap-2 hover:-translate-y-[1px] hover:shadow-md transition-all"
          >
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-500">
              Browse
            </p>
            <p className="text-sm font-semibold text-gray-900">
              Browse drops
            </p>
            <p className="text-[11px] text-gray-500">
              Explore what&apos;s live in the SNEAKS-UP vault.
            </p>
          </Link>

          <Link
            href="/cart"
            className="rounded-2xl border border-gray-200 bg-white px-4 py-4 sm:px-5 sm:py-5 shadow-sm flex flex-col gap-2 hover:-translate-y-[1px] hover:shadow-md transition-all"
          >
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-500">
              Bag
            </p>
            <p className="text-sm font-semibold text-gray-900">
              View your bag
            </p>
            <p className="text-[11px] text-gray-500">
              Review pairs you&apos;ve lined up before checkout.
            </p>
          </Link>

          <Link
            href="/orders"
            className="rounded-2xl border border-gray-200 bg-white px-4 py-4 sm:px-5 sm:py-5 shadow-sm flex flex-col gap-2 hover:-translate-y-[1px] hover:shadow-md transition-all"
          >
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-500">
              History
            </p>
            <p className="text-sm font-semibold text-gray-900">
              Your orders
            </p>
            <p className="text-[11px] text-gray-500">
              Track delivery status & download invoices.
            </p>
          </Link>
        </div>

        {/* RECENT ORDERS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-900">
              Recent orders
            </p>
            <Link
              href="/orders"
              className="text-[11px] text-gray-600 underline underline-offset-4 hover:text-black"
            >
              View full history
            </Link>
          </div>

          {loadingOrders ? (
            <p className="text-xs text-gray-500">Loading your orders…</p>
          ) : recentOrders.length === 0 ? (
            <p className="text-xs text-gray-500">
              No orders yet. Once you check out, they&apos;ll appear here.
            </p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-3 sm:px-5 sm:py-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-gray-900">
                      Order #{order.id}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Placed{" "}
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleString()
                        : "N/A"}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Status:{" "}
                      <span className="font-medium text-gray-900">
                        {order.status}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-gray-900">
                      ${Number(order.total || 0).toFixed(2)}
                    </p>
                    <Link
                      href="/orders"
                      className="text-[11px] border border-gray-300 rounded-full px-3 py-1.5 text-gray-800 hover:bg-gray-100 transition-colors"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SMALL FOOTNOTE */}
        {message && (
          <p className="text-[11px] text-gray-500">{message}</p>
        )}
      </div>
    </SiteLayout>
  );
}

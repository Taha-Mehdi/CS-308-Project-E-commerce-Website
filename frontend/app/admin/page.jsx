"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteLayout from "../../components/SiteLayout";
import { useAuth } from "../../context/AuthContext";

export default function AdminDashboardPage() {
  const { user, loadingUser } = useAuth();

  const [ordersCount, setOrdersCount] = useState(null);
  const [productsCount, setProductsCount] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [message, setMessage] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    async function loadStats() {
      if (!user || user.roleId !== 1) return;

      setLoadingStats(true);
      setMessage("");

      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("token")
            : null;

        if (!token) {
          setOrdersCount(null);
          setProductsCount(null);
          setLoadingStats(false);
          return;
        }

        // Admin orders (all orders)
        try {
          const oRes = await fetch(`${apiBase}/orders`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (oRes.ok) {
            const ct = oRes.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              const data = await oRes.json();
              if (Array.isArray(data)) {
                setOrdersCount(data.length);
              } else if (Array.isArray(data.orders)) {
                setOrdersCount(data.orders.length);
              } else {
                setOrdersCount(null);
              }
            } else {
              setOrdersCount(null);
            }
          } else {
            setOrdersCount(null);
          }
        } catch {
          setOrdersCount(null);
        }

        // Products
        try {
          const pRes = await fetch(`${apiBase}/products`);
          if (pRes.ok) {
            const ct2 = pRes.headers.get("content-type") || "";
            if (ct2.includes("application/json")) {
              const pData = await pRes.json();
              setProductsCount(Array.isArray(pData) ? pData.length : null);
            } else {
              setProductsCount(null);
            }
          } else {
            setProductsCount(null);
          }
        } catch {
          setProductsCount(null);
        }
      } catch (err) {
        console.error("Admin stats load error:", err);
        setMessage("Failed to load admin stats.");
      } finally {
        setLoadingStats(false);
      }
    }

    if (!loadingUser && user && user.roleId === 1) {
      loadStats();
    }
  }, [apiBase, loadingUser, user]);

  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-500">Checking your admin access…</p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-4">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
            Admin
          </h1>
          <p className="text-sm text-gray-600">
            You need to be logged in as an admin to view this page.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login?next=/admin"
              className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gray-900 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium uppercase tracking-[0.18em] text-gray-800 hover:bg-gray-100 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (user.roleId !== 1) {
    return (
      <SiteLayout>
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
            Admin
          </h1>
          <p className="text-sm text-gray-600">
            Your account does not have admin permissions.
          </p>
          <Link
            href="/"
            className="inline-flex text-[11px] text-gray-700 underline underline-offset-4 mt-2"
          >
            Back to homepage
          </Link>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
              SNEAKS-UP
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
              Admin dashboard
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Manage drops, orders, and analytics for this project.
            </p>
          </div>
          <Link
            href="/products"
            className="text-[11px] text-gray-700 underline underline-offset-4 hover:text-black"
          >
            View store
          </Link>
        </header>

        {message && (
          <p className="text-xs text-red-600">{message}</p>
        )}

        {/* Tiles */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Orders tile */}
          <Link
            href="/admin/orders"
            className="group rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between"
          >
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                Orders
              </p>
              <h2 className="text-sm font-semibold text-gray-900">
                All orders
              </h2>
              <p className="text-xs text-gray-500">
                Review every order placed through SNEAKS-UP.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-2xl font-semibold text-gray-900">
                {loadingStats
                  ? "—"
                  : ordersCount !== null
                  ? ordersCount
                  : "—"}
              </span>
              <span className="text-[11px] text-gray-700 group-hover:text-black underline underline-offset-4">
                Manage
              </span>
            </div>
          </Link>

          {/* Products tile */}
          <Link
            href="/admin/products"
            className="group rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between"
          >
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                Drops
              </p>
              <h2 className="text-sm font-semibold text-gray-900">
                Manage products
              </h2>
              <p className="text-xs text-gray-500">
                Add, edit, or deactivate sneaker drops.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-2xl font-semibold text-gray-900">
                {loadingStats
                  ? "—"
                  : productsCount !== null
                  ? productsCount
                  : "—"}
              </span>
              <span className="text-[11px] text-gray-700 group-hover:text-black underline underline-offset-4">
                Manage
              </span>
            </div>
          </Link>

          {/* Analytics tile */}
          <Link
            href="/admin/analytics"
            className="group rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between"
          >
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                Analytics
              </p>
              <h2 className="text-sm font-semibold text-gray-900">
                Charts & stats
              </h2>
              <p className="text-xs text-gray-500">
                Visualize orders, revenue and activity (demo charts).
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-2xl font-semibold text-gray-900">
                →
              </span>
              <span className="text-[11px] text-gray-700 group-hover:text-black underline underline-offset-4">
                Open
              </span>
            </div>
          </Link>

          {/* View as customer tile */}
          <Link
            href="/"
            className="group rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between"
          >
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                Storefront
              </p>
              <h2 className="text-sm font-semibold text-gray-900">
                View as customer
              </h2>
              <p className="text-xs text-gray-500">
                Jump back to the main SNEAKS-UP experience.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-2xl font-semibold text-gray-900">
                👟
              </span>
              <span className="text-[11px] text-gray-700 group-hover:text-black underline underline-offset-4">
                Go to home
              </span>
            </div>
          </Link>
        </section>
      </div>
    </SiteLayout>
  );
}

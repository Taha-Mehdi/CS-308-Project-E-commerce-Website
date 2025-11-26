"use client";

import Link from "next/link";
import SiteLayout from "../../components/SiteLayout";
import { useAuth } from "../../context/AuthContext";

export default function AdminDashboardPage() {
  const { user, loadingUser } = useAuth();

  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-500">Checking admin access…</p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-3">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-sm text-gray-600">
            You need to be logged in as an admin to view this page.
          </p>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-900 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium text-gray-800 hover:bg-gray-100 transition-colors"
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
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-sm text-gray-600">
            Your account does not have admin permissions.
          </p>
          <Link
            href="/"
            className="inline-flex text-xs text-gray-800 underline underline-offset-4 mt-2"
          >
            Back to homepage
          </Link>
        </div>
      </SiteLayout>
    );
  }

  // Admin view
  return (
    <SiteLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage products, orders, and view analytics for the store.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Manage products */}
          <Link
            href="/admin/products"
            className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
          >
            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                Products
              </p>
              <h2 className="text-sm font-semibold text-gray-900">
                Manage catalog
              </h2>
              <p className="text-xs text-gray-600">
                Create, edit, and remove products. Upload images and control stock.
              </p>
            </div>
            <span className="mt-3 text-[11px] text-gray-800 group-hover:underline underline-offset-4">
              Go to products →
            </span>
          </Link>

          {/* Admin orders */}
          <Link
            href="/admin/orders"
            className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
          >
            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                Orders
              </p>
              <h2 className="text-sm font-semibold text-gray-900">
                All customer orders
              </h2>
              <p className="text-xs text-gray-600">
                See all orders across users and their statuses.
              </p>
            </div>
            <span className="mt-3 text-[11px] text-gray-800 group-hover:underline underline-offset-4">
              View orders →
            </span>
          </Link>

          {/* Analytics */}
          <Link
            href="/admin/analytics"
            className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
          >
            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                Analytics
              </p>
              <h2 className="text-sm font-semibold text-gray-900">
                Sales analytics
              </h2>
              <p className="text-xs text-gray-600">
                View charts for orders, revenue, and product performance.
              </p>
            </div>
            <span className="mt-3 text-[11px] text-gray-800 group-hover:underline underline-offset-4">
              Open analytics →
            </span>
          </Link>

          {/* Back to store */}
          <Link
            href="/products"
            className="group rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 hover:border-gray-400 transition-colors flex flex-col justify-between"
          >
            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                Store
              </p>
              <h2 className="text-sm font-semibold text-gray-900">
                View storefront
              </h2>
              <p className="text-xs text-gray-600">
                Jump to the public catalog to see what customers see.
              </p>
            </div>
            <span className="mt-3 text-[11px] text-gray-800 group-hover:underline underline-offset-4">
              Go to store →
            </span>
          </Link>
        </div>
      </div>
    </SiteLayout>
  );
}

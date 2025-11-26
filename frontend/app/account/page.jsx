"use client";

import Link from "next/link";
import SiteLayout from "../../components/SiteLayout";
import { useAuth } from "../../context/AuthContext";

export default function AccountPage() {
  const { user, loadingUser } = useAuth();

  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-500">Checking login status…</p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-3">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Your Account
          </h1>
          <p className="text-sm text-gray-600">
            You need to be logged in to view your account.
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

  return (
    <SiteLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Your Account
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Basic profile info and quick links.
          </p>
        </div>

        {/* User info */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">
            Profile
          </h2>
          <p className="text-sm text-gray-800">
            {user.fullName}
          </p>
          <p className="text-xs text-gray-600">
            {user.email}
          </p>
          <p className="text-xs text-gray-500">
            Role:{" "}
            {user.roleId === 1
              ? "Admin"
              : user.roleId === 2
              ? "Customer"
              : `Role #${user.roleId}`}
          </p>
        </div>

        {/* Quick links */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Quick links
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/orders"
              className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium text-gray-800 hover:bg-gray-100 transition-colors"
            >
              View your orders
            </Link>
            <Link
              href="/cart"
              className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium text-gray-800 hover:bg-gray-100 transition-colors"
            >
              Open cart
            </Link>
            {user.roleId === 1 && (
              <>
                <Link
                  href="/admin"
                  className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  Admin dashboard
                </Link>
                <Link
                  href="/admin/products"
                  className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  Manage products
                </Link>
                <Link
                  href="/admin/analytics"
                  className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  Analytics
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

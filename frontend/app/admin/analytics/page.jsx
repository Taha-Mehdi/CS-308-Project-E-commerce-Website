"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import SiteLayout from "../../../components/SiteLayout";
import DripLink from "../../../components/DripLink";
import { useAuth } from "../../../context/AuthContext";

function roleNameOf(user) {
  return user?.roleName || user?.role || user?.role_name || null;
}

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const { user, loadingUser } = useAuth();

  useEffect(() => {
    if (loadingUser) return;

    const role = roleNameOf(user);

    // If Sales Manager accidentally hits /admin/analytics, send them to the correct analytics page
    if (role === "sales_manager") {
      router.replace("/sales-admin/analytics");
      return;
    }

    // If not logged in, send to login
    if (!user) {
      router.replace("/login?next=/admin/analytics");
    }
  }, [loadingUser, user, router]);

  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-300/70">Loading…</p>
      </SiteLayout>
    );
  }

  const role = roleNameOf(user);

  // sales_manager will be redirected above
  if (!user) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-300/70">Redirecting…</p>
      </SiteLayout>
    );
  }

  // Admin/Product Manager: show a stable page (NO apiRequest calls → no 403 redirect)
  if (role === "admin" || role === "product_manager") {
    return (
      <SiteLayout>
        <div className="space-y-4 py-6">
          <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
            Sneaks-up · Admin
          </p>

          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Analytics
          </h1>

          <p className="text-sm text-gray-300/70">
            Revenue / profit analytics are available in the <b>Sales Manager</b>{" "}
            panel only.
          </p>

          <div className="flex items-center gap-3">
            <DripLink
              href="/admin"
              className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
            >
              Back to Admin dashboard →
            </DripLink>
            <DripLink
              href="/"
              className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
            >
              Go to homepage →
            </DripLink>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // Any other role: generic deny
  return (
    <SiteLayout>
      <div className="space-y-4 py-6">
        <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
          Admin
        </p>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
          Access denied
        </h1>
        <p className="text-sm text-gray-300/70">
          You don’t have access to this page.
        </p>
        <DripLink
          href="/"
          className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
        >
          Back to homepage →
        </DripLink>
      </div>
    </SiteLayout>
  );
}

"use client";

import DripLink from "../../components/DripLink";
import SiteLayout from "../../components/SiteLayout";
import { useAuth } from "../../context/AuthContext";

function canSalesPanelRole(user) {
  const rn = user?.roleName;
  return rn === "sales_manager" || rn === "admin";
}

export default function SalesAdminHome() {
  const { user, loadingUser } = useAuth();

  if (loadingUser) {
    return (
      <SiteLayout>
        <p className="text-sm text-gray-300/70">Checking access…</p>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="space-y-4 py-6">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Sales Manager panel
          </h1>
          <p className="text-sm text-gray-300/70">
            Please log in to access sales tools.
          </p>
          <DripLink
            href="/login"
            className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
          >
            Go to login →
          </DripLink>
        </div>
      </SiteLayout>
    );
  }

  if (!canSalesPanelRole(user)) {
    return (
      <SiteLayout>
        <div className="space-y-4 py-6">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Access denied
          </h1>
          <p className="text-sm text-gray-300/70">
            This panel is for sales managers.
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

  return (
    <SiteLayout>
      <div className="space-y-6 py-6">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
            Sneaks-up · Sales
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Sales Manager panel
          </h1>
          <p className="text-sm text-gray-300/70">
            Discounts, invoices, and profit/loss analytics.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <DripLink
            href="/sales-admin/discounts"
            className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-5 hover:bg-black/25 transition"
          >
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Discounts
            </p>
            <h2 className="mt-1 text-sm font-semibold text-white">Apply discounts</h2>
            <p className="mt-3 text-[11px] text-gray-300/60">
              Select products, set discount %, notify wishlists automatically.
            </p>
          </DripLink>

          <DripLink
            href="/sales-admin/invoices"
            className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-5 hover:bg-black/25 transition"
          >
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Invoices
            </p>
            <h2 className="mt-1 text-sm font-semibold text-white">View invoices</h2>
            <p className="mt-3 text-[11px] text-gray-300/60">
              Filter by date range, open or save PDF.
            </p>
          </DripLink>

          <DripLink
            href="/sales-admin/analytics"
            className="rounded-[28px] border border-border bg-black/20 backdrop-blur p-5 hover:bg-black/25 transition"
          >
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-300/60">
              Analytics
            </p>
            <h2 className="mt-1 text-sm font-semibold text-white">Profit / loss</h2>
            <p className="mt-3 text-[11px] text-gray-300/60">
              Revenue and profit chart between dates.
            </p>
          </DripLink>
        </div>

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

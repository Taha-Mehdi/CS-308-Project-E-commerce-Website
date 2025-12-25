"use client";

import DripLink from "../../components/DripLink";
import { useAuth } from "../../context/AuthContext";

// NOTE:
// Access control + shell is now handled by app/sales-admin/layout.jsx (Step 4).
// This page should only render the Sales dashboard content.

export default function SalesAdminHome() {
  // We keep useAuth here only if you want to show user-specific info later.
  // For now, it can stay (no harm), or you can remove it.
  useAuth();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
          Sales Manager panel
        </p>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
          Discounts & reporting
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
          <h2 className="mt-1 text-sm font-semibold text-white">
            Apply discounts
          </h2>
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
  );
}

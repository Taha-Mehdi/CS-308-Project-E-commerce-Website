"use client";

import DripLink from "../../components/DripLink";
import { useAuth } from "../../context/AuthContext";

/* ----------------- dependency-safe icons ----------------- */
function IconDiscount(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M7 7h.01M17 17h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6.4 3.6h4.2l1.4 1.4H21v7.6l-8.4 8.4a2 2 0 0 1-2.8 0L3.6 14.8a2 2 0 0 1 0-2.8L6.4 9.2V3.6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 16L16 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconInvoice(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M7 3h8l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M15 3v5h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 12h8M8 16h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconAnalytics(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 19V5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 19h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 16v-4M12 16v-7M16 16v-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPricing(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ✅ NEW: Returns icon */
function IconReturn(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M7 7h9a4 4 0 1 1 0 8H9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 9 7 7l3-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 17h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ----------------- card link ----------------- */
function CardLink({ href, eyebrow, title, desc, meta, Icon }) {
  return (
    <DripLink
      href={href}
      className={[
        "group relative flex h-full min-h-[190px] flex-col overflow-hidden rounded-3xl",
        "border border-white/10",
        "bg-gradient-to-b from-white/[0.08] to-white/[0.03]",
        "backdrop-blur-xl",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_30px_80px_-40px_rgba(0,0,0,0.85)]",
        "p-5 sm:p-6",
        "transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-white/20 hover:from-white/[0.10] hover:to-white/[0.04]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          backgroundPosition: "center",
          maskImage:
            "radial-gradient(60% 60% at 50% 45%, black 60%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(60% 60% at 50% 45%, black 60%, transparent 100%)",
        }}
      />

      <div className="relative flex items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-colors group-hover:bg-white/[0.07]">
          <Icon className="h-5 w-5 text-white/90" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-white/55">
            {eyebrow}
          </p>

          <h2 className="mt-1 text-[15px] font-semibold tracking-tight text-white">
            {title}
          </h2>

          <p className="mt-2 text-[12.5px] leading-relaxed text-white/60">
            {desc}
          </p>

          <div className="mt-3">
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-white/60">
              {meta}
            </span>
          </div>
        </div>
      </div>

      <div className="relative mt-auto pt-5">
        <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-white/75">
          <span className="h-1.5 w-1.5 rounded-full bg-white/35 transition-colors group-hover:bg-white/60" />
          Open
          <span className="translate-x-0 transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </div>
      </div>
    </DripLink>
  );
}

export default function SalesAdminHome() {
  useAuth();

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-28 left-1/2 h-72 w-[560px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl opacity-40" />
        <div className="absolute top-32 right-0 h-72 w-72 rounded-full bg-white/5 blur-3xl opacity-30" />
        <div className="absolute bottom-0 left-10 h-72 w-72 rounded-full bg-white/5 blur-3xl opacity-25" />
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-white/55">
            Sales Manager panel
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Discounts & reporting
              </h1>
              <p className="max-w-xl text-sm text-white/60">
                Discounts, invoices, profit/loss analytics and pricing manager.
              </p>
            </div>

            <DripLink
              href="/"
              className={[
                "inline-flex items-center justify-center rounded-2xl",
                "border border-white/10 bg-white/[0.04] px-4 py-2",
                "text-[11px] font-semibold text-white/75",
                "shadow-[0_0_0_1px_rgba(255,255,255,0.03)]",
                "transition-colors hover:bg-white/[0.06] hover:text-white",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
              ].join(" ")}
            >
              Back to homepage <span className="ml-2">→</span>
            </DripLink>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 auto-rows-fr">
          <CardLink
            href="/sales-admin/discounts"
            eyebrow="Discounts"
            title="Apply discounts"
            desc="Select products, set discount %, notify wishlists automatically."
            meta="Promo control"
            Icon={IconDiscount}
          />

          <CardLink
            href="/sales-admin/invoices"
            eyebrow="Invoices"
            title="View invoices"
            desc="Filter by date range, open or save PDF."
            meta="Billing"
            Icon={IconInvoice}
          />

          <CardLink
            href="/sales-admin/analytics"
            eyebrow="Analytics"
            title="Profit / loss"
            desc="Revenue and profit chart between dates."
            meta="Reporting"
            Icon={IconAnalytics}
          />

          <CardLink
            href="/sales-admin/products"
            eyebrow="Catalog"
            title="Pricing Manager"
            desc="Update product base prices."
            meta="Pricing"
            Icon={IconPricing}
          />

          {/* ✅ NEW */}
          <CardLink
            href="/sales-admin/returns"
            eyebrow="Returns"
            title="Return requests"
            desc="Approve/reject returns, mark received, trigger refunds + restock."
            meta="Refund workflow"
            Icon={IconReturn}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

function NavItem({ href, label }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={[
        "block rounded-xl px-3 py-2 text-sm transition",
        active
          ? "bg-white/10 text-white"
          : "text-gray-300/80 hover:bg-white/5 hover:text-white",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function AdminShell({ title = "Admin Panel", children }) {
  const { user, logout } = useAuth();

  // Role gating: show Analytics + Sales tools ONLY for sales manager.
  const role =
    (user?.roleName || user?.role || user?.role_name || "").toString().toLowerCase();

  const isSalesManager =
    role === "sales_manager" || role === "sales manager" || role === "salesmanager";

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-gray-400">
              {title}
            </p>
            <h1 className="text-xl font-semibold">
              Welcome, {user?.name || user?.email}
            </h1>
          </div>

          <button
            onClick={logout}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] hover:bg-white/10"
          >
            Logout
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-3">
            <div className="space-y-1">
              <NavItem href="/admin" label="Dashboard" />
              <NavItem href="/admin/products" label="Products" />
              <NavItem href="/admin/orders" label="Orders" />
              <NavItem href="/admin/invoices" label="Invoices" />
              {isSalesManager && <NavItem href="/admin/analytics" label="Analytics" />}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4 space-y-1">
              {isSalesManager && (
                <Link
                  href="/sales-admin"
                  className="block rounded-xl px-3 py-2 text-sm text-gray-300/80 hover:bg-white/5 hover:text-white transition"
                >
                  ↗ Sales tools
                </Link>
              )}

              <Link
                href="/"
                className="block rounded-xl px-3 py-2 text-sm text-gray-300/80 hover:bg-white/5 hover:text-white transition"
              >
                ← Back to store
              </Link>
            </div>
          </aside>

          <main className="rounded-3xl border border-white/10 bg-white/5 p-4">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

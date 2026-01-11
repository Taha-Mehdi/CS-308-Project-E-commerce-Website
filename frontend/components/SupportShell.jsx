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

export default function SupportShell({ title = "Sneaks-up · Support", children }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-gray-300/80">
              Logged in as{" "}
              <span className="text-white/90 font-medium">
                {user?.fullName || user?.email || "Support Agent"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 hover:bg-white/10 hover:text-white transition"
            >
              ← Back to store
            </Link>

            <button
              type="button"
              onClick={logout}
              className="rounded-full bg-white text-black px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] hover:bg-gray-100 transition"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-3">
            <div className="space-y-1">
              <NavItem href="/support" label="Support Dashboard" />
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

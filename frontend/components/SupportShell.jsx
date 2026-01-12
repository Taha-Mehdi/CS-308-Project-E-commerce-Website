"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useEffect, useRef, useState } from "react";

function NavItem({ href, label, hint }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={[
        "group block rounded-2xl px-3 py-2 transition",
        active
          ? "bg-white/10 text-white border border-white/10"
          : "text-gray-300/80 hover:bg-white/5 hover:text-white border border-transparent",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">{label}</div>
        {active ? (
          <span className="rounded-full bg-white text-black px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
            Active
          </span>
        ) : null}
      </div>
      {hint ? (
        <div className="mt-1 text-[12px] text-white/50 group-hover:text-white/60 transition">
          {hint}
        </div>
      ) : null}
    </Link>
  );
}

export default function SupportShell({ title = "Sneaks-up · Support", children }) {
  const { user, logout } = useAuth();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = user?.fullName || user?.email || "Support Agent";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Subtle premium background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.25) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-4 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate">
                  {title}
                </h1>
                <span className="hidden sm:inline-flex rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  Agent Console
                </span>
              </div>
              <div className="mt-1 text-[12px] text-white/60">
                Fast queue handling · Live chat · Customer context
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link
                href="/"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 hover:bg-white/10 hover:text-white transition"
              >
                ← Back to store
              </Link>

              {/* User Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] hover:bg-white/10 transition focus:outline-none"
                >
                  <span className="text-white/90 max-w-[220px] truncate">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-white/50">▼</span>
                </button>

                {dropdownOpen ? (
                  <div className="absolute right-0 mt-2 w-52 origin-top-right rounded-2xl border border-white/10 bg-black/80 backdrop-blur-2xl py-1 shadow-2xl z-50 overflow-hidden">
                    <Link
                      href="/account"
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Profile
                    </Link>
                    <Link
                      href="/orders"
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition"
                      onClick={() => setDropdownOpen(false)}
                    >
                      My Orders
                    </Link>
                    <Link
                      href="/wishlist"
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Wishlist
                    </Link>

                    <div className="my-1 h-px bg-white/10" />

                    <button
                      onClick={logout}
                      className="w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-white/10 hover:text-red-200 transition"
                    >
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Layout */}
        <div className="grid gap-4 lg:grid-cols-[260px_1fr] items-start">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl p-3">
            <div className="mb-2 px-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                Navigation
              </div>
            </div>

            <div className="space-y-2">
              <NavItem
                href="/support"
                label="Support Dashboard"
                hint="Queue + active chats"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                Tips
              </div>
              <div className="mt-2 text-[12px] text-white/60 leading-relaxed">
                Claim conversations quickly, ask for order ID, and use attachments
                to verify issues.
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl p-4 min-h-[calc(100vh-160px)]">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

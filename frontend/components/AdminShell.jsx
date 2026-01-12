"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useState, useRef, useEffect } from "react";

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const role = (user?.roleName || user?.role || user?.role_name || "")
      .toString()
      .toLowerCase();

  const isSalesManager =
      role === "sales_manager" || role === "sales manager" || role === "salesmanager";
  const isProductManager = role === "product_manager";

  // Close dropdown if clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          {/* Upper Toolbar */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-300/70">
              {title}
            </p>

            {/* User Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-white/10 transition focus:outline-none"
              >
              <span className="text-gray-200">
                {user?.fullName || user?.email || "Admin"}
              </span>
                <span className="text-[10px] text-gray-400 opacity-70">▼</span>
              </button>

              {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-xl border border-white/10 bg-[#111] py-1 shadow-2xl z-50">
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
                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/10 hover:text-red-300 transition"
                    >
                      Logout
                    </button>
                  </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <aside className="rounded-3xl border border-white/10 bg-white/5 p-3">
              <div className="space-y-1">
                <NavItem href="/admin" label="Dashboard" />
                <NavItem href="/admin/products" label="Products" />
                <NavItem href="/admin/products/add" label="Add Product" />
                <NavItem href="/admin/categories" label="Categories" />
                <NavItem href="/admin/reviews" label="Reviews" />

                {/* Admin Work Orders (Distinct from personal orders in dropdown) */}
                <NavItem
                    href="/admin/orders"
                    label={isProductManager ? "Deliveries" : "Client Orders"}
                />
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
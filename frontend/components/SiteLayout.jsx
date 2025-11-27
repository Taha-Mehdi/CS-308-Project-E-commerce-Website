"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function SiteLayout({ children }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Load cart count + listen for updates (JSON-safe)
  useEffect(() => {
    async function loadCartCount() {
      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("token")
            : null;
        if (!token) {
          setCartCount(0);
          return;
        }

        const res = await fetch(`${apiBase}/cart`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          setCartCount(0);
          return;
        }

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          setCartCount(0);
          return;
        }

        let data;
        try {
          data = await res.json();
        } catch {
          setCartCount(0);
          return;
        }

        if (Array.isArray(data)) {
          setCartCount(data.length);
        } else {
          setCartCount(0);
        }
      } catch {
        setCartCount(0);
      }
    }

    loadCartCount();

    function handleUpdated() {
      loadCartCount();
    }

    if (typeof window !== "undefined") {
      window.addEventListener("cart-updated", handleUpdated);
      return () => {
        window.removeEventListener("cart-updated", handleUpdated);
      };
    }
  }, []);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/products", label: "Drops" },
    { href: "/cart", label: "Cart" },
    { href: "/orders", label: "Orders", requiresAuth: true },
    { href: "/admin", label: "Admin", requiresAdmin: true },
  ];

  function isActive(href) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function renderNavLinks(onClick) {
    return navLinks.map((link) => {
      if (link.requiresAuth && !user) return null;
      if (link.requiresAdmin && (!user || user.roleId !== 1)) return null;

      const active = isActive(link.href);

      return (
        <Link
          key={link.href}
          href={link.href}
          onClick={onClick}
          className={`relative flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] transition-colors ${
            active
              ? "bg-white text-black"
              : "text-gray-300 hover:text-white hover:bg-white/10"
          }`}
        >
          {link.label}
          {link.href === "/cart" && cartCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[1.15rem] h-[1.15rem] rounded-full bg-white text-[10px] text-black">
              {cartCount}
            </span>
          )}
        </Link>
      );
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-black via-black to-[#050505]">
      {/* NAVBAR */}
      <header className="border-b border-white/10 bg-black/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Left: brand */}
          <Link href="/" className="flex items-center">
            <span className="text-base sm:text-lg font-semibold tracking-[0.28em] text-white uppercase">
              SNEAKS-UP
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            {renderNavLinks()}
          </nav>

          {/* Right: auth controls (desktop) */}
          <div className="hidden md:flex items-center gap-2">
            {!user ? (
              <>
                <Link
                  href="/login"
                  className="text-[11px] font-medium px-3.5 py-1.5 rounded-full bg-white text-black hover:bg-gray-100 transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="text-[11px] font-medium px-3.5 py-1.5 rounded-full border border-white/40 text-white hover:bg-white hover:text-black transition-colors"
                >
                  Get started
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/account"
                  className="px-3.5 py-1.5 rounded-full border border-white/35 text-[11px] font-medium text-white hover:bg-white hover:text-black transition-colors"
                >
                  {user.fullName || "Account"}
                </Link>
                <button
                  onClick={logout}
                  className="px-3.5 py-1.5 rounded-full bg-blue-600 text-[11px] font-medium text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
                >
                  Logout
                </button>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-full border border-white/30 text-white text-xs"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 bg-black/90">
            <div className="max-w-6xl mx-auto px-4 py-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {renderNavLinks(() => setMobileOpen(false))}
              </div>
              <div className="flex flex-wrap gap-2">
                {!user ? (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMobileOpen(false)}
                      className="flex-1 text-center text-[11px] font-medium px-3 py-1.75 rounded-full bg-white text-black hover:bg-gray-100 transition-colors"
                    >
                      Login
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileOpen(false)}
                      className="flex-1 text-center text-[11px] font-medium px-3 py-1.75 rounded-full border border-white/40 text-white hover:bg-white hover:text-black transition-colors"
                    >
                      Get started
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/account"
                      onClick={() => setMobileOpen(false)}
                      className="flex-1 text-center text-[11px] font-medium px-3 py-1.75 rounded-full border border-white/40 text-white hover:bg-white hover:text-black transition-colors"
                    >
                      {user.fullName || "Account"}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileOpen(false);
                        logout();
                      }}
                      className="flex-1 text-center text-[11px] font-medium px-3 py-1.75 rounded-full bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
                    >
                      Logout
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="bg-[#f5f5f5] rounded-3xl shadow-sm border border-gray-200/60 px-4 sm:px-6 py-6 sm:py-8">
            {children}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-500">
            CS-308 · SNEAKS-UP Ecommerce Project
          </p>
          <p className="text-[11px] text-gray-400">
            Node / Express / Neon · Next.js / Tailwind
          </p>
        </div>
      </footer>
    </div>
  );
}

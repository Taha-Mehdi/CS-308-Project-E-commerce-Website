"use client";

import { useEffect, useState } from "react";
import DripLink from "./DripLink";
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
          typeof window !== "undefined" ? localStorage.getItem("token") : null;
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

        if (Array.isArray(data)) setCartCount(data.length);
        else setCartCount(0);
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
      return () => window.removeEventListener("cart-updated", handleUpdated);
    }
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/products", label: "Drops" },
    { href: "/cart", label: "Bag" },
    { href: "/orders", label: "Orders", requiresAuth: true },
    { href: "/admin", label: "Admin", requiresAdmin: true },
  ];

  function isActive(href) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function NavLink({ href, label, onClick }) {
    const active = isActive(href);

    return (
      <DripLink
        href={href}
        onClick={onClick}
        className={[
          "relative inline-flex items-center gap-2 rounded-full px-4 py-2",
          "text-[11px] font-semibold uppercase tracking-[0.16em]",
          "transition-all active:scale-[0.98]",
          active
            ? "text-black"
            : "text-gray-200/85 hover:text-white hover:bg-white/10",
        ].join(" ")}
      >
        {/* active gradient pill background */}
        {active && (
          <span
            className="absolute inset-0 rounded-full bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]"
            aria-hidden="true"
          />
        )}

        <span className="relative z-10">{label}</span>

        {href === "/cart" && cartCount > 0 && (
          <span
            className="
              relative z-10 inline-flex items-center justify-center
              min-w-[1.25rem] h-[1.25rem] px-1
              rounded-full text-[10px] font-bold
              bg-black/60 text-white
              border border-white/15
            "
          >
            {cartCount}
          </span>
        )}
      </DripLink>
    );
  }

  function renderNavLinks(onClick) {
    return navLinks.map((link) => {
      if (link.requiresAuth && !user) return null;
      if (link.requiresAdmin && (!user || user.roleId !== 1)) return null;

      return (
        <NavLink
          key={link.href}
          href={link.href}
          label={link.label}
          onClick={onClick}
        />
      );
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50">
        <div className="pt-3">
          <div
            className="
              max-w-6xl mx-auto px-4
              rounded-[22px]
              border border-border
              bg-black/35 backdrop-blur
              shadow-[0_18px_60px_rgba(0,0,0,0.55)]
              overflow-hidden
            "
          >
            {/* subtle glow */}
            <div
              className="
                pointer-events-none absolute inset-0
                bg-[radial-gradient(800px_circle_at_15%_0%,rgba(168,85,247,0.20),transparent_55%),radial-gradient(800px_circle_at_85%_20%,rgba(251,113,133,0.16),transparent_60%)]
              "
              aria-hidden="true"
            />

            <div className="relative px-4 sm:px-5 py-3 flex items-center justify-between gap-4">
              {/* Brand */}
              <DripLink href="/" className="flex items-center">
                <span className="text-sm sm:text-base font-semibold tracking-[0.32em] uppercase">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]">
                    SNEAKS-UP
                  </span>
                </span>
              </DripLink>

              {/* Desktop nav */}
              <nav className="hidden md:flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
                  {renderNavLinks()}
                </div>
              </nav>

              {/* Desktop auth */}
              <div className="hidden md:flex items-center gap-2">
                {!user ? (
                  <>
                    <DripLink
                      href="/login"
                      className="
                        px-4 py-2 rounded-full
                        text-[11px] font-semibold uppercase tracking-[0.14em]
                        border border-white/10 bg-white/5 text-white/85
                        hover:bg-white/10 hover:text-white transition active:scale-[0.98]
                      "
                    >
                      Login
                    </DripLink>
                    <DripLink
                      href="/register"
                      className="
                        px-4 py-2 rounded-full
                        text-[11px] font-semibold uppercase tracking-[0.14em]
                        bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                        text-black
                        hover:opacity-95 transition active:scale-[0.98]
                      "
                    >
                      Get started
                    </DripLink>
                  </>
                ) : (
                  <>
                    <DripLink
                      href="/account"
                      className="
                        px-4 py-2 rounded-full
                        text-[11px] font-semibold uppercase tracking-[0.14em]
                        border border-white/10 bg-white/5 text-white/85
                        hover:bg-white/10 hover:text-white transition active:scale-[0.98]
                      "
                    >
                      {user.fullName || "Account"}
                    </DripLink>
                    <button
                      onClick={logout}
                      className="
                        px-4 py-2 rounded-full
                        text-[11px] font-semibold uppercase tracking-[0.14em]
                        bg-white text-black hover:bg-gray-100 transition active:scale-[0.98]
                      "
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
                className="
                  md:hidden inline-flex items-center justify-center
                  w-10 h-10 rounded-full
                  border border-white/10 bg-white/5 text-white
                  hover:bg-white/10 transition
                "
                aria-label="Toggle menu"
              >
                {mobileOpen ? "✕" : "☰"}
              </button>
            </div>

            {/* Mobile dropdown */}
            {mobileOpen && (
              <div className="md:hidden border-t border-white/10 bg-black/35 backdrop-blur">
                <div className="px-4 py-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {renderNavLinks(() => setMobileOpen(false))}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {!user ? (
                      <>
                        <DripLink
                          href="/login"
                          onClick={() => setMobileOpen(false)}
                          className="
                            flex-1 text-center px-4 py-2 rounded-full
                            text-[11px] font-semibold uppercase tracking-[0.14em]
                            border border-white/10 bg-white/5 text-white/85
                            hover:bg-white/10 hover:text-white transition
                          "
                        >
                          Login
                        </DripLink>
                        <DripLink
                          href="/register"
                          onClick={() => setMobileOpen(false)}
                          className="
                            flex-1 text-center px-4 py-2 rounded-full
                            text-[11px] font-semibold uppercase tracking-[0.14em]
                            bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                            text-black hover:opacity-95 transition
                          "
                        >
                          Get started
                        </DripLink>
                      </>
                    ) : (
                      <>
                        <DripLink
                          href="/account"
                          onClick={() => setMobileOpen(false)}
                          className="
                            flex-1 text-center px-4 py-2 rounded-full
                            text-[11px] font-semibold uppercase tracking-[0.14em]
                            border border-white/10 bg-white/5 text-white/85
                            hover:bg-white/10 hover:text-white transition
                          "
                        >
                          {user.fullName || "Account"}
                        </DripLink>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileOpen(false);
                            logout();
                          }}
                          className="
                            flex-1 text-center px-4 py-2 rounded-full
                            text-[11px] font-semibold uppercase tracking-[0.14em]
                            bg-white text-black hover:bg-gray-100 transition
                          "
                        >
                          Logout
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="rounded-3xl border border-border bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.35)] px-4 sm:px-6 py-6 sm:py-8">
            {children}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border bg-black/30 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-300">
            © {new Date().getFullYear()} SNEAKS-UP. All rights reserved.
          </p>
          <p className="text-[11px] text-gray-400">
            Built for sneakerheads. Powered by Node & Next.js.
          </p>
        </div>
      </footer>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import DripLink from "./DripLink";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function SiteLayout({ children }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  // -------------------------
  // Cart count (JSON-safe) + updates
  // -------------------------
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
          headers: { Authorization: `Bearer ${token}` },
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

        setCartCount(Array.isArray(data) ? data.length : 0);
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

  const navLinks = useMemo(
    () => [
      { href: "/", label: "Home" },
      { href: "/products", label: "Drops" },
      { href: "/cart", label: "Bag" },
      { href: "/orders", label: "Orders", requiresAuth: true },

      // One "Admin" entry for both roles, but different destinations.
      {
        label: "Admin",
        requiresAdmin: true,
        getHref: (u) =>
          u?.roleName === "admin"
            ? "/admin"
            : u?.roleName === "sales_manager"
            ? "/sales-admin"
            : null,
      },
    ],
    []
  );

  function isActive(href) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function DockLink({ href, label, onClick }) {
    const active = isActive(href);

    return (
      <DripLink
        href={href}
        onClick={onClick}
        className={[
          "relative inline-flex items-center justify-center",
          "px-4 py-2 rounded-full",
          "text-[11px] font-semibold uppercase tracking-[0.16em]",
          "transition active:scale-[0.98]",
          active ? "text-white" : "text-gray-200/80 hover:text-white",
        ].join(" ")}
      >
        {/* active background (contained inside dock) */}
        {active && (
          <span
            className="
              absolute inset-0 rounded-full
              bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
              opacity-90
            "
            aria-hidden="true"
          />
        )}

        <span className="relative z-10">{label}</span>

        {/* Minimal glass bag badge */}
        {href === "/cart" && cartCount > 0 && (
          <span
            className="
              relative z-10 ml-2 inline-flex items-center gap-1.5
              rounded-full px-2 py-1
              text-[10px] font-medium leading-none tracking-tight
              border border-white/12
              bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]
              backdrop-blur-md
              shadow-[0_6px_18px_rgba(0,0,0,0.18)]
              select-none
            "
            aria-label={`${cartCount} items in bag`}
          >
            <span
              className="
                inline-block size-1.5 rounded-full
                bg-[var(--drip-accent)]
                shadow-[0_0_8px_rgba(168,85,247,0.5)]
              "
              aria-hidden="true"
            />
            <span className="text-white/85">
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          </span>
        )}
      </DripLink>
    );
  }

  function ActionPill({ href, label, onClick, variant = "glass" }) {
    const base =
      "inline-flex items-center justify-center rounded-full px-4 py-2 " +
      "text-[11px] font-semibold uppercase tracking-[0.14em] transition active:scale-[0.98]";

    const styles =
      variant === "primary"
        ? "bg-white text-black hover:bg-gray-100 shadow-[0_14px_55px_rgba(0,0,0,0.25)]"
        : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white";

    if (!href) {
      return (
        <button type="button" onClick={onClick} className={`${base} ${styles}`}>
          {label}
        </button>
      );
    }

    return (
      <DripLink href={href} onClick={onClick} className={`${base} ${styles}`}>
        {label}
      </DripLink>
    );
  }

  function renderDockLinks(onClick) {
    return navLinks.map((link) => {
      if (link.requiresAuth && !user) return null;

      if (link.requiresAdmin) {
        if (!user) return null;

        const allowed = ["admin", "sales_manager"].includes(user.roleName);
        if (!allowed) return null;

        const href = link.getHref(user);
        if (!href) return null;

        return (
          <DockLink
            key={href}
            href={href}
            label={link.label}
            onClick={onClick}
          />
        );
      }

      return (
        <DockLink
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
      {/* NAVBAR (NO OUTER BACKDROP) */}
      <header className="sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div
            className="
              relative overflow-hidden
              rounded-[24px]
              border border-white/10
              bg-black/35 backdrop-blur
              shadow-[0_16px_65px_rgba(0,0,0,0.55)]
            "
          >
            {/* inner sheen only (contained) */}
            <div
              className="
                pointer-events-none absolute inset-0
                bg-[linear-gradient(to_right,rgba(255,255,255,0.06),transparent,rgba(255,255,255,0.05))]
                opacity-60
              "
              aria-hidden="true"
            />

            <div className="relative h-[56px] px-4 sm:px-5 flex items-center">
              {/* Left: LOGO ONLY */}
              <div className="flex items-center">
                <DripLink
                  href="/"
                  className="
                    text-sm sm:text-base font-semibold tracking-tight
                    text-white
                    hover:opacity-90 transition
                  "
                >
                  SNEAKS-UP
                </DripLink>
              </div>

              {/* Center dock */}
              <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2">
                <div
                  className="
                    relative flex items-center gap-1
                    rounded-full
                    border border-white/10
                    bg-white/[0.04]
                    backdrop-blur
                    p-1
                    shadow-[0_10px_35px_rgba(0,0,0,0.35)]
                  "
                >
                  <div
                    className="pointer-events-none absolute inset-0 rounded-full bg-white/5 opacity-40"
                    aria-hidden="true"
                  />
                  <div className="relative flex items-center gap-1">
                    {renderDockLinks()}
                  </div>
                </div>
              </nav>

              {/* Right actions */}
              <div className="ml-auto hidden md:flex items-center gap-2">
                {!user ? (
                  <>
                    <ActionPill href="/login" label="Login" />
                    <ActionPill
                      href="/register"
                      label="Get started"
                      variant="primary"
                    />
                  </>
                ) : (
                  <>
                    <ActionPill
                      href="/account"
                      label={user.fullName || "Account"}
                    />
                    <ActionPill
                      label="Logout"
                      variant="primary"
                      onClick={logout}
                    />
                  </>
                )}
              </div>

              {/* Mobile toggle */}
              <button
                type="button"
                onClick={() => setMobileOpen((prev) => !prev)}
                className="
                  md:hidden ml-auto inline-flex items-center justify-center
                  w-10 h-10 rounded-full
                  border border-white/10 bg-white/5 text-white
                  hover:bg-white/10 transition
                "
                aria-label="Toggle menu"
              >
                {mobileOpen ? "✕" : "☰"}
              </button>
            </div>

            {/* Mobile sheet */}
            {mobileOpen && (
              <div className="md:hidden border-t border-white/10">
                <div className="px-4 py-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {renderDockLinks(() => setMobileOpen(false))}
                  </div>

                  <div className="h-px w-full bg-white/10" />

                  <div className="flex flex-wrap gap-2 pt-1">
                    {!user ? (
                      <>
                        <ActionPill
                          href="/login"
                          label="Login"
                          onClick={() => setMobileOpen(false)}
                        />
                        <ActionPill
                          href="/register"
                          label="Get started"
                          variant="primary"
                          onClick={() => setMobileOpen(false)}
                        />
                      </>
                    ) : (
                      <>
                        <ActionPill
                          href="/account"
                          label={user.fullName || "Account"}
                          onClick={() => setMobileOpen(false)}
                        />
                        <ActionPill
                          label="Logout"
                          variant="primary"
                          onClick={() => {
                            setMobileOpen(false);
                            logout();
                          }}
                        />
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

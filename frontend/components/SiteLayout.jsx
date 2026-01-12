"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import DripLink from "./DripLink";
import ChatWidget from "./ChatWidget";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

function safeParseJsonArray(raw, fallback = []) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function sumQuantities(items) {
  if (!Array.isArray(items)) return 0;
  let total = 0;
  for (const it of items) {
    const q = Number(it?.quantity ?? 1);
    total += Number.isFinite(q) && q > 0 ? q : 0;
  }
  return total;
}

function getGuestCartCount() {
  if (typeof window === "undefined") return 0;
  const cart = safeParseJsonArray(window.localStorage.getItem("guestCart") || "[]", []);
  return sumQuantities(cart);
}

export default function SiteLayout({ children }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // -------------------------
  // Cart count (guest + logged-in)
  // -------------------------
  const loadCartCount = useCallback(async () => {
    try {
      const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;

      if (!token) {
        setCartCount(getGuestCartCount());
        return;
      }

      const res = await fetch(`${apiBase}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        setCartCount(getGuestCartCount());
        return;
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        setCartCount(getGuestCartCount());
        return;
      }

      let data;
      try {
        data = await res.json();
      } catch {
        setCartCount(getGuestCartCount());
        return;
      }

      if (Array.isArray(data)) {
        const qtySum = sumQuantities(data);
        setCartCount(qtySum > 0 ? qtySum : data.length);
      } else {
        setCartCount(0);
      }
    } catch {
      setCartCount(getGuestCartCount());
    }
  }, []);

  useEffect(() => {
    loadCartCount();
  }, [loadCartCount, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleUpdated() {
      loadCartCount();
    }

    function handleStorage(e) {
      if (e.key === "guestCart" || e.key === "token") {
        loadCartCount();
      }
    }

    window.addEventListener("cart-updated", handleUpdated);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("cart-updated", handleUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadCartCount]);

  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navLinks = useMemo(
      () => [
        { href: "/", label: "Home" },
        { href: "/products", label: "Drops" },
        { href: "/cart", label: "Bag" },
        // "Panel" removed from here to separate it
      ],
      []
  );

  // ✅ FIXED: Added "support" role to the panel logic
  const panelHref = useMemo(() => {
    if (!user) return null;
    const role = (user.roleName || "").toLowerCase();

    if (role === "product_manager") return "/admin";
    if (role === "sales_manager") return "/sales-admin";
    if (role === "support") return "/support"; // Added this line

    return null;
  }, [user]);

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
              >
            <span
                className="inline-block size-1.5 rounded-full bg-[var(--drip-accent)] shadow-[0_0_8px_rgba(168,85,247,0.5)]"
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
      return <DockLink key={link.href} href={link.href} label={link.label} onClick={onClick} />;
    });
  }

  return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        {/* NAVBAR */}
        <header className="sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div
                className="
              relative overflow-visible
              rounded-[24px]
              border border-white/10
              bg-black/35 backdrop-blur
              shadow-[0_16px_65px_rgba(0,0,0,0.55)]
            "
            >
              <div
                  className="
                pointer-events-none absolute inset-0 rounded-[24px] overflow-hidden
                bg-[linear-gradient(to_right,rgba(255,255,255,0.06),transparent,rgba(255,255,255,0.05))]
                opacity-60
              "
                  aria-hidden="true"
              />

              <div className="relative h-[56px] px-4 sm:px-5 flex items-center">
                {/* Left: LOGO */}
                <div className="flex items-center">
                  <DripLink
                      href="/"
                      className="text-sm sm:text-base font-semibold tracking-tight text-white hover:opacity-90 transition"
                  >
                    SNEAKS-UP
                  </DripLink>
                </div>

                {/* Center dock (Home, Drops, Bag only) */}
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

                  {/* ✅ SEPARATED PANEL LINK (for privileged users) */}
                  {panelHref && (
                      <ActionPill href={panelHref} label="Panel" variant="glass" />
                  )}

                  {!user ? (
                      <>
                        <ActionPill href="/login" label="Login" />
                        <ActionPill href="/register" label="Get started" variant="primary" />
                      </>
                  ) : (
                      // DROPDOWN FOR DESKTOP
                      <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="
                        flex items-center gap-2
                        rounded-full border border-white/10 bg-white/5
                        pl-4 pr-3 py-2
                        text-[11px] font-semibold uppercase tracking-[0.14em] text-white
                        hover:bg-white/10 transition
                      "
                        >
                          <span>{user.fullName || "Account"}</span>
                          <span className="text-[9px] opacity-60">▼</span>
                        </button>

                        {dropdownOpen && (
                            <div className="absolute right-0 mt-3 w-48 origin-top-right rounded-2xl border border-white/10 bg-[#0a0a0a] p-1 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none">
                              <Link
                                  href="/account"
                                  className="block rounded-xl px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition"
                                  onClick={() => setDropdownOpen(false)}
                              >
                                Profile
                              </Link>
                              <Link
                                  href="/orders"
                                  className="block rounded-xl px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition"
                                  onClick={() => setDropdownOpen(false)}
                              >
                                Orders
                              </Link>
                              <Link
                                  href="/wishlist"
                                  className="block rounded-xl px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition"
                                  onClick={() => setDropdownOpen(false)}
                              >
                                Wishlist
                              </Link>
                              <div className="my-1 h-px bg-white/10" />
                              <button
                                  onClick={() => {
                                    setDropdownOpen(false);
                                    logout();
                                  }}
                                  className="block w-full text-left rounded-xl px-4 py-2 text-sm text-red-400 hover:bg-white/10 hover:text-red-300 transition"
                              >
                                Logout
                              </button>
                            </div>
                        )}
                      </div>
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

                        {/* ✅ PANEL LINK IN MOBILE (Manually added) */}
                        {panelHref && (
                            <DockLink href={panelHref} label="Panel" onClick={() => setMobileOpen(false)} />
                        )}
                      </div>

                      <div className="h-px w-full bg-white/10" />

                      <div className="flex flex-col gap-2 pt-1">
                        {!user ? (
                            <div className="flex flex-wrap gap-2">
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
                            </div>
                        ) : (
                            <div className="space-y-1">
                              <p className="px-1 text-[10px] uppercase tracking-widest text-gray-500 mb-2">
                                Signed in as {user.fullName || "User"}
                              </p>
                              <Link
                                  href="/account"
                                  onClick={() => setMobileOpen(false)}
                                  className="block rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white"
                              >
                                Profile
                              </Link>
                              <Link
                                  href="/orders"
                                  onClick={() => setMobileOpen(false)}
                                  className="block rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white"
                              >
                                Orders
                              </Link>
                              <Link
                                  href="/wishlist"
                                  onClick={() => setMobileOpen(false)}
                                  className="block rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white"
                              >
                                Wishlist
                              </Link>
                              <button
                                  onClick={() => {
                                    setMobileOpen(false);
                                    logout();
                                  }}
                                  className="block w-full text-left rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-white/10"
                              >
                                Logout
                              </button>
                            </div>
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

        <ChatWidget />
      </div>
  );
}
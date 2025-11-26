"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function SiteLayout({ children }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-[#f5f5f4] flex flex-col">
      {/* Top Nav */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Left: logo/name */}
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xl font-semibold tracking-tight">
              Online Store
            </Link>
          </div>

          {/* Center: nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700">
            <Link
              href="/"
              className="hover:text-black transition-colors"
            >
              Home
            </Link>
            <Link
              href="/products"
              className="hover:text-black transition-colors"
            >
              Products
            </Link>
            <Link
              href="/cart"
              className="hover:text-black transition-colors"
            >
              Cart
            </Link>
          </nav>

          {/* Right: auth / account */}
          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="hidden sm:inline text-gray-700">
                  {user.fullName}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-full border border-gray-300 text-gray-800 text-xs font-medium hover:bg-gray-100 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-gray-700 hover:text-black text-xs font-medium"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="px-3 py-1.5 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-900 transition-colors"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-8">{children}</div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/80">
        <div className="max-w-6xl mx-auto px-4 py-6 text-xs text-gray-500 flex flex-col sm:flex-row justify-between gap-2">
          <span>© {new Date().getFullYear()} Online Store. All rights reserved.</span>
          <span className="text-gray-400">
            CS308 Ecommerce Project
          </span>
        </div>
      </footer>
    </div>
  );
}

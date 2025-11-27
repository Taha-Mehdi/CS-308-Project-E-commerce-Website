"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const nextPath = searchParams.get("next") || "/";

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const res = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          fullName,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data = null;
      if (contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        setMessage(
          (data && data.message) ||
            "Registration failed. Please check your details."
        );
        setSubmitting(false);
        return;
      }

      if (!data || !data.token || !data.user) {
        setMessage("Invalid response from server.");
        setSubmitting(false);
        return;
      }

      // 🔐 SAFE CALL TO login() – supports both signatures
      try {
        if (login.length >= 2) {
          // login(token, user)
          login(data.token, data.user);
        } else {
          // login({ token, user }) or similar
          login({ token: data.token, user: data.user });
        }
      } catch (err) {
        console.error("AuthContext login error:", err);
        setMessage("Invalid data returned from server.");
        setSubmitting(false);
        return;
      }

      router.push(nextPath);
    } catch (err) {
      console.error("Register error:", err);
      setMessage("An unexpected error occurred.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Outer gradient + white-ish glow */}
        <div className="rounded-3xl bg-gradient-to-br from-black via-neutral-900 to-black p-[1px] shadow-[0_0_80px_rgba(255,255,255,0.18)]">
          {/* Inner panel */}
          <div className="rounded-[calc(1.5rem-1px)] bg-[#050505] px-6 py-7 sm:px-8 sm:py-8 space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.3em] uppercase text-gray-400">
                SNEAKS-UP
              </p>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                Create your account
              </h1>
              <p className="text-xs text-gray-400">
                Sign up to start collecting drops, managing your bag, and
                tracking orders.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-300 uppercase tracking-[0.2em]">
                  Full name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Test User"
                  className="w-full rounded-xl border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-300 uppercase tracking-[0.2em]">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-300 uppercase tracking-[0.2em]">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {message && (
                <p className="text-xs text-red-400 pt-1">{message}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 rounded-full bg-blue-600 text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] text-white py-2.5 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Creating account…" : "Create account"}
              </button>
            </form>

            {/* Footer links */}
            <div className="pt-2 flex items-center justify-between text-[11px] text-gray-400">
              <span>Already have an account?</span>
              <Link
                href="/login"
                className="text-gray-100 underline underline-offset-4 hover:text-white"
              >
                Sign in instead
              </Link>
            </div>

            <p className="text-[10px] text-gray-500 pt-1">
              New users are stored in Neon PostgreSQL via Drizzle ORM, with
              passwords hashed using bcrypt and JWT-based auth.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

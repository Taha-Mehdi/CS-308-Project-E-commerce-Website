"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DripLink from "../../components/DripLink";
import { useAuth } from "../../context/AuthContext";

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fullName, setFullName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const nextPath = searchParams.get("next") || "/";

  function validateForm() {
    if (!fullName.trim()) return "Please enter your full name.";
    if (fullName.trim().length < 2) return "Your name should be at least 2 characters.";

    if (!taxId.trim()) return "Please enter your Tax ID.";
    if (taxId.trim().length < 3) return "Tax ID looks too short.";

    if (!address.trim()) return "Please enter your home address.";
    if (address.trim().length < 5) return "Address looks too short.";

    if (!email.trim()) return "Please enter your email address.";
    if (!email.includes("@") || !email.includes(".")) return "Please enter a valid email address.";

    if (!password.trim()) return "Please choose a password.";
    if (password.length < 6) return "Password should be at least 6 characters long.";

    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    const validationError = validateForm();
    if (validationError) {
      setMessage(validationError);
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          taxId: taxId.trim(),
          address: address.trim(),
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
        setMessage((data && data.message) || "Registration failed.");
        setSubmitting(false);
        return;
      }

      if (!data || !data.token) {
        setMessage("Invalid response from server.");
        setSubmitting(false);
        return;
      }

      // Save token + let AuthContext handle guest-cart merge
      localStorage.setItem("token", data.token);

      try {
        login(data.token, data.user);
      } catch (err) {
        console.error("AuthContext login error:", err);
        setMessage("Something went wrong while saving your session.");
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

  const inputBase =
    "w-full h-11 rounded-2xl border border-border bg-white/5 px-4 " +
    "text-sm text-gray-100 placeholder:text-gray-400/70 backdrop-blur " +
    "focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_45%,transparent)]";

  const textAreaBase =
    "w-full rounded-2xl border border-border bg-white/5 px-4 py-3 " +
    "text-sm text-gray-100 placeholder:text-gray-400/70 backdrop-blur " +
    "focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_45%,transparent)]";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-black text-white">
      <div className="w-full max-w-md">
        <div className="rounded-[28px] border border-border bg-black/25 backdrop-blur shadow-[0_18px_80px_rgba(0,0,0,0.55)] overflow-hidden">
          {/* top glow */}
          <div
            className="pointer-events-none h-1.5 w-full bg-gradient-to-r from-[var(--drip-accent)] via-white/20 to-[var(--drip-accent-2)]"
            aria-hidden="true"
          />

          <div className="px-6 py-7 sm:px-8 sm:py-8 space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
                SNEAKS-UP
              </p>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                Create account
              </h1>
              <p className="text-xs text-gray-300/70">
                Sign up to save your bag, track orders, and access drops.
              </p>
            </div>

            {/* Message */}
            {message && (
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] text-gray-200/85">
                {message}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300/70">
                  Full name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Test User"
                  className={inputBase}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300/70">
                  Tax ID
                </label>
                <input
                  type="text"
                  required
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="1234567890"
                  className={inputBase}
                />
                <p className="text-[10px] text-gray-300/55">
                  Required for invoices and order records.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300/70">
                  Home address
                </label>
                <textarea
                  rows={3}
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, Building, City, Country"
                  className={textAreaBase}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300/70">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputBase}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-300/70">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputBase}
                />
                <p className="text-[10px] text-gray-300/55">
                  Minimum 6 characters.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="
                  w-full h-11 rounded-full
                  bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                  text-black text-[11px] sm:text-sm font-semibold
                  uppercase tracking-[0.18em]
                  hover:opacity-95 transition active:scale-[0.98]
                  disabled:opacity-60 disabled:cursor-not-allowed
                "
              >
                {submitting ? "Creating…" : "Create account"}
              </button>
            </form>

            {/* Footer */}
            <div className="pt-1 flex items-center justify-between gap-3 text-[11px] text-gray-300/70">
              <span>Already have an account?</span>
              <DripLink
                href="/login"
                className="text-gray-100 underline underline-offset-4 hover:text-white"
              >
                Sign in instead
              </DripLink>
            </div>

            <p className="text-[10px] text-gray-300/55">
              Passwords are stored hashed on the server for security.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

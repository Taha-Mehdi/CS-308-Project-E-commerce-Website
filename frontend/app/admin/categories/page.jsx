"use client";

import { useEffect, useState } from "react";
import DripLink from "../../../components/DripLink";
import { useAuth } from "../../../context/AuthContext";
import { apiRequest } from "../../../lib/api";

/* --- UI helpers copied from admin/products/page.jsx --- */
function panelClass() {
  return [
    "rounded-[34px]",
    "border border-white/10",
    "bg-white/[0.04]",
    "backdrop-blur-xl",
    "p-5 sm:p-6",
    "shadow-[0_18px_70px_rgba(0,0,0,0.45)]",
  ].join(" ");
}

function chipBase() {
  return "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border whitespace-nowrap";
}
function chip(tone = "muted") {
  const base = chipBase();
  if (tone === "warn") return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
  if (tone === "ok") return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
  if (tone === "bad") return `${base} border-red-500/25 bg-red-500/10 text-red-200`;
  return `${base} border-white/10 bg-white/5 text-gray-200/80`;
}

const fieldBase =
  "h-11 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm text-white placeholder:text-gray-400/60 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_35%,transparent)]";

const btnBase =
  "h-11 inline-flex items-center justify-center rounded-full px-6 text-[11px] font-semibold uppercase tracking-[0.18em] transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";

const btnPrimary =
  "bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] text-black hover:opacity-95";

function canCatalogRole(user) {
  const rn = user?.roleName || user?.role || user?.role_name || "";
  return rn === "admin" || rn === "product_manager";
}

export default function AdminCategoriesPage() {
  const { user, loadingUser } = useAuth();
  const canEditCatalog = canCatalogRole(user);

  const [categories, setCategories] = useState([]);
  const [newCatName, setNewCatName] = useState("");

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function setMsg(msg, error = false) {
    setMessage(msg);
    setIsError(error);
    if (!error && msg) setTimeout(() => setMessage(""), 3000);
  }

  async function loadCategories() {
    setLoading(true);
    setMessage("");

    try {
      const data = await apiRequest("/categories", { method: "GET" });
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setCategories([]);
      setMsg("Failed to load categories.", true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!loadingUser && user && canEditCatalog) loadCategories();
    else if (!loadingUser) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingUser, user]);

  async function handleAddCategory() {
    if (!newCatName.trim()) return;

    try {
      const created = await apiRequest("/categories", {
        method: "POST",
        auth: true,
        body: { name: newCatName },
      });

      if (!created) return; // apiRequest returns null on 403 (and redirects)

      setCategories((prev) => [...prev, created]);
      setNewCatName("");
      setMsg("Category added.");
    } catch (e) {
      console.error(e);
      setMsg(e?.message || "Failed to add category.", true);
    }
  }

  async function handleDeleteCategory(id) {
    if (!confirm("Delete category? It might still be used by products.")) return;

    try {
      const res = await apiRequest(`/categories/${id}`, {
        method: "DELETE",
        auth: true,
        headers: { "Content-Type": "application/json" },
      });

      if (res === null) return; // forbidden redirect handled by apiRequest

      setCategories((prev) => prev.filter((c) => c.id !== id));
      setMsg("Category deleted.");
    } catch (e) {
      console.error(e);
      setMsg(e?.message || "Could not delete category (maybe in use).", true);
    }
  }

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className="text-sm text-gray-300/70">Checking access…</p>
        </div>
      </div>
    );
  }

  if (!user || !canEditCatalog) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="space-y-4">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Admin
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Access denied
            </h1>
            <p className="text-sm text-gray-300/70">
              You need admin or product manager permissions to manage categories.
            </p>
            <DripLink
              href="/"
              className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
            >
              Back to homepage
            </DripLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
              Sneaks-up · Admin
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Categories
            </h1>
            <p className="text-sm text-gray-300/70">
              Add and remove product categories.
            </p>

            <div className="pt-2 flex flex-wrap gap-2">
              <span className={chip("muted")}>{categories.length} categories</span>
            </div>
          </div>

          <DripLink
            href="/admin"
            className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
          >
            Back to dashboard
          </DripLink>
        </div>

        {message && (
          <div
            className={`rounded-2xl border px-4 py-3 text-[11px] font-medium ${
              isError
                ? "border-red-500/20 bg-red-500/10 text-red-200"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {message}
          </div>
        )}

        <div className={panelClass() + " space-y-4 border-emerald-500/20"}>
          <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-300/70">
            Manage Categories
          </h3>

          <div className="flex gap-2 max-w-md">
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="New category name"
              className={fieldBase}
            />
            <button onClick={handleAddCategory} className={btnBase + " " + btnPrimary}>
              Add
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-white/40 italic">Loading…</p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-2">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10"
                >
                  <span className="text-xs text-white/80">
                    {c.name} <span className="opacity-50">(ID: {c.id})</span>
                  </span>
                  <button
                    onClick={() => handleDeleteCategory(c.id)}
                    className="text-red-400 hover:text-red-200 ml-1 font-bold text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}

              {categories.length === 0 && (
                <div className="text-xs text-white/40 italic">No categories found.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

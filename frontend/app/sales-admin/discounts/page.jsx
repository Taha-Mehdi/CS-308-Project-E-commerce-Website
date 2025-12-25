"use client";

import { useEffect, useMemo, useState } from "react";
import DripLink from "../../../components/DripLink";
import { applyDiscountApi, clearStoredTokens } from "../../../lib/api";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

function panelClass() {
  return "rounded-[28px] border border-border bg-black/25 backdrop-blur p-5 shadow-[0_16px_60px_rgba(0,0,0,0.45)]";
}

function chipBase() {
  return "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border";
}
function chip(tone = "muted") {
  const base = chipBase();
  if (tone === "warn")
    return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
  if (tone === "ok")
    return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
  return `${base} border-white/10 bg-white/5 text-gray-200/80`;
}

function handleAuthRedirect(err, nextPath) {
  const status = err?.status;
  if (status === 401) {
    clearStoredTokens();
    window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
    return true;
  }
  if (status === 403) {
    window.location.href = "/";
    return true;
  }
  return false;
}

export default function SalesDiscountsPage() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [message, setMessage] = useState("");

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [discountPct, setDiscountPct] = useState("");
  const [discountBusy, setDiscountBusy] = useState(false);

  const [query, setQuery] = useState("");

  async function safeJson(res) {
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  async function loadProducts() {
    setLoadingProducts(true);
    setMessage("");

    try {
      const prodRes = await fetch(`${apiBase}/products`);
      if (!prodRes.ok) {
        setMessage("Failed to load products.");
        setProducts([]);
        return;
      }

      const j = await safeJson(prodRes);
      setProducts(Array.isArray(j) ? j : []);
    } catch (err) {
      console.error("Sales discounts load error:", err);
      setMessage("Failed to load products.");
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;

    return products.filter((p) => {
      const hay = `${p.name || ""} ${p.description || ""} ${p.model || ""} ${
        p.serialNumber || ""
      }`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, query]);

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelected() {
    setSelectedIds(new Set());
  }

  function selectAllVisible(list) {
    setSelectedIds(new Set(list.map((p) => p.id)));
  }

  async function runDiscount(ratePct) {
    if (selectedIds.size === 0) {
      setMessage("Select at least one product to discount.");
      return;
    }

    const rate = Number(ratePct);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      setMessage("Discount must be a number between 0 and 100.");
      return;
    }

    setDiscountBusy(true);
    setMessage("");

    try {
      const productIds = Array.from(selectedIds);

      const result = await applyDiscountApi({
        productIds,
        discountRate: rate,
      });

      const updated = result?.updatedProducts || [];
      if (Array.isArray(updated) && updated.length) {
        const map = new Map(updated.map((p) => [p.id, p]));
        setProducts((prev) => prev.map((p) => map.get(p.id) || p));
      } else {
        await loadProducts();
      }

      setMessage(
        rate <= 0
          ? "Discount cleared and original prices restored."
          : `Discount applied (${rate.toFixed(
              2
            )}%) — wishlist users notified.`
      );
    } catch (err) {
      console.error("Apply discount error:", err);
      if (handleAuthRedirect(err, "/sales-admin/discounts")) return;
      setMessage(err?.message || "Failed to apply discount.");
    } finally {
      setDiscountBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
            Sneaks-up · Sales
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Discounts
          </h1>
          <p className="text-sm text-gray-300/70">
            Select products, set discount %, and apply.
          </p>
        </div>

        <DripLink
          href="/sales-admin"
          className="text-[11px] text-gray-200/70 underline underline-offset-4 hover:text-white"
        >
          Back to sales panel →
        </DripLink>
      </div>

      {message && (
        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] text-gray-200/80">
          {message}
        </div>
      )}

      <div className={panelClass()}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-300/60">
              Discounts
            </p>
            <p className="text-sm text-gray-200/80">
              Selected:{" "}
              <span className="text-gray-100">{selectedIds.size}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={discountPct}
              onChange={(e) => setDiscountPct(e.target.value)}
              placeholder="Discount %"
              className="h-10 w-28 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/15"
            />

            <button
              type="button"
              disabled={discountBusy}
              onClick={() => runDiscount(discountPct)}
              className="
                h-10 px-5 rounded-full
                bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)]
                text-black text-[11px] font-semibold uppercase tracking-[0.18em]
                hover:opacity-95 transition active:scale-[0.98]
                disabled:opacity-60 disabled:cursor-not-allowed
              "
            >
              {discountBusy ? "Applying…" : "Apply"}
            </button>

            <button
              type="button"
              disabled={discountBusy}
              onClick={() => runDiscount(0)}
              className="
                h-10 px-5 rounded-full border border-border bg-white/5
                text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100
                hover:bg-white/10 transition active:scale-[0.98]
                disabled:opacity-60 disabled:cursor-not-allowed
              "
            >
              Clear discount
            </button>

            <button
              type="button"
              disabled={discountBusy}
              onClick={clearSelected}
              className="
                h-10 px-5 rounded-full border border-border bg-white/5
                text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100
                hover:bg-white/10 transition active:scale-[0.98]
                disabled:opacity-60 disabled:cursor-not-allowed
              "
            >
              Clear selection
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name / description / model / serial…"
            className="h-10 w-full rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/15"
          />

          <button
            type="button"
            onClick={() => selectAllVisible(filteredProducts)}
            className="
              h-10 px-5 rounded-full border border-border bg-white/5
              text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-100
              hover:bg-white/10 transition active:scale-[0.98]
            "
          >
            Select visible
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {loadingProducts ? (
          <div className={panelClass()}>
            <p className="text-sm text-gray-300/70">Loading products…</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className={panelClass()}>
            <p className="text-sm text-gray-300/70">No products found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map((p) => {
              const imageUrl = p.imageUrl ? `${apiBase}${p.imageUrl}` : null;
              const isSelected = selectedIds.has(p.id);

              return (
                <div key={p.id} className={panelClass()}>
                  <div className="flex flex-col lg:flex-row gap-5">
                    <div className="flex flex-col items-start gap-2 w-full lg:w-[220px]">
                      <div className="w-full flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-200/80">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelected(p.id)}
                            className="h-4 w-4 rounded border border-white/20 bg-white/5"
                          />
                          Select
                        </label>

                        {p.discountRate ? (
                          <span className={chip("warn")}>
                            {Number(p.discountRate).toFixed(2)}% off
                          </span>
                        ) : (
                          <span className={chip("muted")}>No discount</span>
                        )}
                      </div>

                      <div className="w-full aspect-square rounded-[24px] overflow-hidden border border-white/10 bg-white/5">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={p.name || "Product image"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[11px] uppercase tracking-[0.28em] text-gray-300/50">
                            No image
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 space-y-2">
                      <h2 className="text-lg font-semibold text-white">
                        {p.name}
                      </h2>
                      <p className="text-[11px] text-gray-300/60">
                        ID: {p.id} · Model: {p.model || "—"} · Serial:{" "}
                        {p.serialNumber || "—"}
                      </p>
                      <p className="text-sm text-gray-200/80 leading-relaxed">
                        {p.description || (
                          <span className="text-gray-300/50 italic">
                            No description.
                          </span>
                        )}
                      </p>

                      <div className="pt-2 flex flex-wrap gap-2">
                        <span className={chip("ok")}>
                          ${Number(p.price || 0).toFixed(2)}
                        </span>
                        <span className={chip("muted")}>
                          Stock: {Number(p.stock ?? 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

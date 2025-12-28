"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DripLink from "../../../components/DripLink";
import { useAuth } from "../../../context/AuthContext";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

/* --------------------------------- helpers -------------------------------- */

function money(n) {
  const v = Number(n || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v);
}

function clsx(...s) {
  return s.filter(Boolean).join(" ");
}

function safeImgUrl(p) {
  if (!p?.imageUrl) return null;
  if (/^https?:\/\//i.test(p.imageUrl)) return p.imageUrl;
  return `${apiBase}${p.imageUrl}`;
}

/* --------------------------------- primitives ------------------------------ */

function Shell({ children }) {
  return (
    <div className="relative text-white">
      {/* ambient */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-72 w-[560px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl opacity-35" />
        <div className="absolute top-32 right-0 h-72 w-72 rounded-full bg-white/5 blur-3xl opacity-35" />
        <div className="absolute bottom-0 left-8 h-72 w-72 rounded-full bg-white/5 blur-3xl opacity-25" />
      </div>
      {children}
    </div>
  );
}

function Panel({ className = "", children }) {
  return (
    <div
      className={clsx(
        // Default is overflow-hidden, but we may override per-instance.
        "relative overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl",
        className
      )}
    >
      {/* subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.10) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          backgroundPosition: "center",
          maskImage:
            "radial-gradient(60% 60% at 50% 45%, black 55%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(60% 60% at 50% 45%, black 55%, transparent 100%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase text-white/70">
      {children}
    </span>
  );
}

function Toast({ tone = "info", children }) {
  const tones = {
    info: "border-white/10 bg-white/[0.04] text-white/80",
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
    error: "border-red-500/20 bg-red-500/10 text-red-100",
  };
  return (
    <div className={clsx("rounded-2xl border px-4 py-3 text-sm", tones[tone])}>
      {children}
    </div>
  );
}

function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center rounded-full font-semibold tracking-[0.16em] uppercase transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:opacity-60 disabled:cursor-not-allowed";
  const sizes = {
    xs: "h-9 px-4 text-[10px]",
    sm: "h-9 px-4 text-[11px]",
    md: "h-10 px-5 text-[11px]",
    lg: "h-11 px-6 text-[11px]",
  };
  const variants = {
    primary:
      "bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] text-black hover:opacity-95",
    ghost:
      "border border-white/12 bg-white/[0.03] text-white/80 hover:bg-white/[0.06] hover:text-white",
    light: "bg-white text-black hover:bg-white/90 border border-white/10",
  };

  return (
    <button
      className={clsx(base, sizes[size], variants[variant], className)}
      disabled={disabled}
      {...props}
    />
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={clsx(
        "h-11 w-full rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/40",
        "focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20",
        className
      )}
      {...props}
    />
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-white/55">
          {label}
        </p>
        {hint ? <p className="text-[11px] text-white/45">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

/* ----------------------------- sort dropdown (portal) ----------------------------- */

const SORT_OPTIONS = [
  { value: "name_asc", label: "Name (A → Z)" },
  { value: "price_asc", label: "Price (Low → High)" },
  { value: "price_desc", label: "Price (High → Low)" },
];

function SortDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const [pos, setPos] = useState({
    left: 0,
    top: 0,
    width: 0,
  });

  const current = SORT_OPTIONS.find((o) => o.value === value) || SORT_OPTIONS[0];

  useEffect(() => {
    // portal mount guard
    setMounted(true);
  }, []);

  const computePos = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8; // matches mt-2
    setPos({
      left: r.left,
      top: r.bottom + gap,
      width: r.width,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    computePos();
    // also compute on next paint to be safe with fonts/layout
    const id = requestAnimationFrame(computePos);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    function onDoc(e) {
      const t = e.target;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    function onReflow() {
      computePos();
    }

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("resize", onReflow);
    // capture scroll anywhere (including nested containers)
    window.addEventListener("scroll", onReflow, true);

    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const menu =
    open && mounted
      ? createPortal(
          <div
            ref={popRef}
            role="listbox"
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              width: pos.width,
              zIndex: 2147483647, // max-ish to beat any app layers
            }}
            className={clsx(
              "overflow-hidden rounded-3xl border border-white/12",
              "bg-black/85 backdrop-blur-xl",
              "shadow-[0_18px_80px_rgba(0,0,0,0.55)]"
            )}
          >
            <div className="p-2">
              {SORT_OPTIONS.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={clsx(
                      "w-full rounded-2xl px-3 py-2 text-left text-sm transition",
                      active
                        ? "bg-white/12 text-white"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "h-11 w-full rounded-full border border-white/10 bg-white/5 px-4 text-left text-sm text-white",
          "flex items-center justify-between gap-3",
          "focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{current.label}</span>
        <span className={clsx("text-white/60 transition", open && "rotate-180")}>
          ▼
        </span>
      </button>

      {menu}
    </div>
  );
}

/* ------------------------------ product card ------------------------------ */

function ProductCard({
  product,
  editing,
  editPrice,
  onEditPriceChange,
  onStartEdit,
  onCancel,
  onSave,
  saving,
}) {
  const img = safeImgUrl(product);

  return (
    <div className="rounded-[34px] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[170px_1fr_260px]">
        {/* IMAGE (square) */}
        <div className="p-4 lg:p-5">
          <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img}
                alt={product?.name || "Product image"}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-widest text-white/40">
                No Image
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
          </div>
        </div>

        {/* CONTENT */}
        <div className="px-4 pb-4 lg:px-0 lg:py-5 lg:pr-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg sm:text-xl font-semibold tracking-tight leading-snug break-words">
                {product?.name}
              </h3>
              {typeof product?.stock === "number" ? (
                <Badge>
                  {product.stock > 0 ? `Stock: ${product.stock}` : "Out"}
                </Badge>
              ) : (
                <Badge>ID: {product?.id}</Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                Current:
                <span className="font-semibold text-white">
                  {money(product?.price)}
                </span>
              </span>

              {product?.categoryId != null ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                  Category:
                  <span className="text-white/85">{product.categoryId}</span>
                </span>
              ) : null}
            </div>

            {product?.description ? (
              <p className="text-sm text-white/55 leading-relaxed">
                {product.description}
              </p>
            ) : (
              <p className="text-sm text-white/45">No description provided.</p>
            )}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="p-4 lg:p-5 border-t border-white/10 lg:border-t-0 lg:border-l border-white/10">
          {editing ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-full max-w-[220px] rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-white/55">
                    Price
                  </p>
                  <Badge>USD</Badge>
                </div>

                <div className="mt-3 space-y-3">
                  {/* ✅ Spinner removed: use text + inputMode decimal */}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editPrice}
                    onChange={(e) => {
                      const v = e.target.value;
                      // allow only digits + one decimal point, and max 2 decimals
                      if (/^\d*\.?\d{0,2}$/.test(v) || v === "") {
                        onEditPriceChange(v);
                      }
                    }}
                    className="h-10 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                    placeholder="0.00"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="primary"
                      size="xs"
                      onClick={onSave}
                      disabled={saving}
                      className="w-full"
                    >
                      {saving ? "…" : "Save"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={onCancel}
                      disabled={saving}
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="w-full max-w-[220px] space-y-2">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={onStartEdit}
                  className="w-full"
                >
                  Edit price
                </Button>

                {img ? (
                  <a
                    href={img}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full block"
                  >
                    <Button variant="ghost" size="xs" className="w-full">
                      View image
                    </Button>
                  </a>
                ) : (
                  <Button variant="ghost" size="xs" disabled className="w-full">
                    No image
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- page ---------------------------------- */

export default function SalesPricingPage() {
  const { user, loadingUser } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState({ tone: "info", text: "" });

  // Search + sort only
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name_asc");

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editPrice, setEditPrice] = useState("");
  const [savingId, setSavingId] = useState(null);

  const isSalesManager = user?.roleName === "sales_manager";

  useEffect(() => {
    if (loadingUser) return;

    async function load() {
      try {
        const res = await fetch(`${apiBase}/products`);
        if (res.ok) {
          const data = await res.json();
          setProducts(Array.isArray(data) ? data : []);
        } else {
          setMessage({ tone: "error", text: "Failed to load products." });
        }
      } catch (e) {
        console.error(e);
        setMessage({ tone: "error", text: "Network error loading products." });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [loadingUser]);

  function startEdit(p) {
    setMessage({ tone: "info", text: "" });
    setEditingId(p.id);
    setEditPrice(String(p.price ?? ""));
  }

  async function handleSave(p) {
    const token = localStorage.getItem("token");
    setSavingId(p.id);
    setMessage({ tone: "info", text: "" });

    const next = Number(editPrice);
    if (Number.isNaN(next) || next < 0) {
      setSavingId(null);
      setMessage({
        tone: "error",
        text: "Please enter a valid non-negative price.",
      });
      return;
    }

    try {
      const res = await fetch(`${apiBase}/products/${p.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...p,
          price: next,
          categoryId: p.categoryId,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setProducts((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
        setEditingId(null);
        setEditPrice("");
        setMessage({ tone: "success", text: "Price updated successfully." });
      } else if (res.status === 401 || res.status === 403) {
        setMessage({
          tone: "error",
          text: "You’re not authorized to update prices. Please log in again.",
        });
      } else {
        setMessage({ tone: "error", text: "Failed to update price." });
      }
    } catch (err) {
      console.error(err);
      setMessage({ tone: "error", text: "Error saving price." });
    } finally {
      setSavingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products;

    if (q)
      list = list.filter((p) =>
        String(p?.name || "").toLowerCase().includes(q)
      );

    list = [...list].sort((a, b) => {
      if (sort === "name_asc")
        return String(a?.name || "").localeCompare(String(b?.name || ""));
      if (sort === "price_asc") return Number(a?.price || 0) - Number(b?.price || 0);
      if (sort === "price_desc") return Number(b?.price || 0) - Number(a?.price || 0);
      return 0;
    });

    return list;
  }, [products, query, sort]);

  if (loadingUser || loading) {
    return (
      <Shell>
        <div className="p-8">
          <Panel className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-40 rounded-full bg-white/10" />
                <div className="h-3 w-64 rounded-full bg-white/10" />
              </div>
              <div className="h-9 w-24 rounded-full bg-white/10" />
            </div>
            <div className="mt-6 space-y-3">
              <div className="h-11 w-full rounded-full bg-white/10" />
              <div className="h-28 w-full rounded-3xl bg-white/10" />
              <div className="h-28 w-full rounded-3xl bg-white/10" />
            </div>
          </Panel>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Sneaks-up</Badge>
              <Badge>Sales</Badge>
              <Badge>Pricing</Badge>
              {!isSalesManager ? <Badge>Read-only</Badge> : <Badge>Manager</Badge>}
            </div>

            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Pricing Manager
            </h1>
            <p className="text-sm text-white/60">
              Search and sort products — dropdown always stacks above everything.
            </p>
          </div>

          <DripLink
            href="/sales-admin"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase text-white/75 transition hover:bg-white/[0.06] hover:text-white"
          >
            Back <span className="ml-2">→</span>
          </DripLink>
        </div>

        {/* Message */}
        {message.text ? <Toast tone={message.tone}>{message.text}</Toast> : null}

        {/* Controls: Search + Sort */}
        {/* Keep overflow-visible anyway; portal makes it unnecessary, but it's nice UX. */}
        <Panel className="p-5 sm:p-6 overflow-visible">
          <div className="relative z-0 grid gap-4 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8">
              <Field
                label="Search"
                hint={`Showing ${filtered.length} of ${products.length}`}
              >
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products by name…"
                />
              </Field>
            </div>

            <div className="lg:col-span-4">
              <Field label="Sort">
                <SortDropdown value={sort} onChange={setSort} />
              </Field>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-white/45">
              Tip: sort by price to quickly find outliers.
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuery("")}
                className="min-w-[140px]"
              >
                Clear search
              </Button>
            </div>
          </div>
        </Panel>

        {/* Permission notice */}
        {!isSalesManager ? (
          <Toast tone="error">
            Your account role is{" "}
            <b className="text-white">{String(user?.roleName || "unknown")}</b>. You
            can view products, but price editing may be restricted.
          </Toast>
        ) : null}

        {/* List */}
        <div className="grid gap-4">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              editing={editingId === p.id}
              editPrice={editingId === p.id ? editPrice : ""}
              onEditPriceChange={setEditPrice}
              onStartEdit={() => startEdit(p)}
              onCancel={() => {
                setEditingId(null);
                setEditPrice("");
              }}
              onSave={() => handleSave(p)}
              saving={savingId === p.id}
            />
          ))}

          {!filtered.length ? (
            <Panel className="p-10">
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold">No products found</p>
                <p className="text-sm text-white/60">Try a different search term.</p>
                <div className="flex flex-col sm:flex-row justify-center gap-2 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => setQuery("")}
                    className="min-w-[180px]"
                  >
                    Reset search
                  </Button>
                </div>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}

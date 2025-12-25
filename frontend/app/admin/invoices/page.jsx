"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DripLink from "../../../components/DripLink";
import ActionButton from "../../../components/ActionButton";
import { getInvoicesRangeApi, downloadInvoicePdfBlob } from "../../../lib/api";

function panelClass(extra = "") {
  return (
    "rounded-[28px] border border-border bg-white/[0.04] backdrop-blur-xl " +
    "shadow-[0_16px_60px_rgba(0,0,0,0.35)] " +
    extra
  );
}

function chip(tone = "muted") {
  const base =
    "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] border";
  if (tone === "live")
    return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
  if (tone === "warn")
    return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
  return `${base} border-white/10 bg-white/5 text-gray-200/80`;
}

function formatDateTime(v) {
  try {
    return v ? new Date(v).toLocaleString() : "—";
  } catch {
    return "—";
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "invoice.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function printPdfBlob(blob) {
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener,noreferrer");

  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error("Popup blocked. Allow popups to print.");
  }

  w.addEventListener("load", () => {
    try {
      w.focus();
      w.print();
    } catch {}
  });

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/* Bigger, cleaner controls */
const controlLabel =
  "text-[12px] font-semibold uppercase tracking-[0.22em] text-gray-200/70";

const helperText = "text-[13px] text-gray-200/70";

const dateInputLarge =
  "h-12 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 " +
  "text-[14px] text-white/90 shadow-[0_10px_34px_rgba(0,0,0,0.18)] " +
  "focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_40%,transparent)] " +
  "placeholder:text-gray-300/40";

function clampDateOnly(d) {
  // returns YYYY-MM-DD in local time
  const x = new Date(d);
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getPresetRange(presetKey) {
  const today = new Date();
  const end = new Date(today);
  const start = new Date(today);

  const setToStartOfDay = (dt) => {
    dt.setHours(0, 0, 0, 0);
    return dt;
  };
  const setToEndOfDay = (dt) => {
    dt.setHours(23, 59, 59, 999);
    return dt;
  };

  // We only store YYYY-MM-DD in state (date inputs), so end-of-day is handled server-side usually.
  // Still, these calculations are for selecting the right day boundaries.
  if (presetKey === "today") {
    setToStartOfDay(start);
    setToEndOfDay(end);
  } else if (presetKey === "7d") {
    start.setDate(start.getDate() - 6);
    setToStartOfDay(start);
    setToEndOfDay(end);
  } else if (presetKey === "30d") {
    start.setDate(start.getDate() - 29);
    setToStartOfDay(start);
    setToEndOfDay(end);
  } else if (presetKey === "this_month") {
    start.setDate(1);
    setToStartOfDay(start);
    setToEndOfDay(end);
  } else if (presetKey === "last_month") {
    // first day of current month -> subtract 1 day -> last month end
    const firstThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthEnd = new Date(firstThisMonth);
    lastMonthEnd.setDate(0); // last day of previous month
    const lastMonthStart = new Date(
      lastMonthEnd.getFullYear(),
      lastMonthEnd.getMonth(),
      1
    );
    return {
      from: clampDateOnly(lastMonthStart),
      to: clampDateOnly(lastMonthEnd),
    };
  } else {
    return null;
  }

  return { from: clampDateOnly(start), to: clampDateOnly(end) };
}

function QuickRangeDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const options = [
    { key: "today", label: "Today" },
    { key: "7d", label: "Last 7 days" },
    { key: "30d", label: "Last 30 days" },
    { key: "this_month", label: "This month" },
    { key: "last_month", label: "Last month" },
  ];

  useEffect(() => {
    function onDocClick(e) {
      if (!open) return;
      const t = e.target;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const currentLabel =
    options.find((o) => o.key === value)?.label || "Quick range";

  return (
    <div className="relative w-full">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={
          "h-12 w-full rounded-2xl border border-white/10 bg-white/[0.06] " +
          "px-4 text-left text-[14px] text-white/90 " +
          "shadow-[0_10px_34px_rgba(0,0,0,0.18)] " +
          "focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--drip-accent)_40%,transparent)] " +
          "hover:bg-white/[0.08] transition " +
          "flex items-center justify-between gap-3"
        }
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="truncate">{currentLabel}</span>
        <span className="text-white/50 text-[12px]">▾</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={
            "absolute z-50 mt-2 w-full overflow-hidden rounded-2xl " +
            "border border-white/10 bg-[#0B0D12]/95 backdrop-blur-xl " +
            "shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          }
        >
          <div className="p-2">
            {options.map((opt) => {
              const active = opt.key === value;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChange(opt.key);
                    setOpen(false);
                  }}
                  className={
                    "w-full rounded-xl px-3 py-3 text-left text-[14px] " +
                    "flex items-center justify-between gap-3 " +
                    "transition " +
                    (active
                      ? "bg-white/[0.10] text-white"
                      : "text-gray-200/85 hover:bg-white/[0.06] hover:text-white")
                  }
                >
                  <span className="truncate">{opt.label}</span>
                  {active ? <span className="text-[12px]">✓</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminInvoicesPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [invoices, setInvoices] = useState([]);

  const [busyId, setBusyId] = useState(null); // for print/download
  const [preset, setPreset] = useState(""); // quick range preset key

  const totalSum = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
  }, [invoices]);

  useEffect(() => {
    if (!preset) return;
    const r = getPresetRange(preset);
    if (!r) return;
    setFrom(r.from);
    setTo(r.to);
  }, [preset]);

  async function loadInvoices() {
    setMessage("");
    setInvoices([]);

    if (!from || !to) {
      setMessage("Please select both From and To dates.");
      return;
    }
    if (new Date(from) > new Date(to)) {
      setMessage("From date must be before To date.");
      return;
    }

    setLoading(true);
    try {
      const data = await getInvoicesRangeApi(from, to);

      const list =
        (Array.isArray(data?.invoices) && data.invoices) ||
        (Array.isArray(data?.orders) && data.orders) ||
        (Array.isArray(data) && data) ||
        [];

      setInvoices(list);
      setMessage(`Loaded ${list.length} invoice(s).`);
    } catch (err) {
      console.error("Load invoices error:", err);
      setMessage(err?.message || "Failed to load invoices.");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(orderId) {
    setMessage("");
    setBusyId(orderId);
    try {
      const blob = await downloadInvoicePdfBlob(orderId);
      downloadBlob(blob, `invoice_${orderId}.pdf`);
      setMessage(`Saved invoice_${orderId}.pdf`);
    } catch (err) {
      console.error("Download invoice error:", err);
      setMessage(err?.message || "Invoice download failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePrint(orderId) {
    setMessage("");
    setBusyId(orderId);
    try {
      const blob = await downloadInvoicePdfBlob(orderId);
      await printPdfBlob(blob);
      setMessage("Opened invoice for printing.");
    } catch (err) {
      console.error("Print invoice error:", err);
      setMessage(err?.message || "Failed to open invoice for printing.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.32em] uppercase text-gray-300/70">
            Sneaks-up · Admin
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Invoices
          </h1>
          <p className="text-sm text-gray-300/70">
            View invoices in a date range. Print or save as PDF.
          </p>

          <div className="pt-2 flex flex-wrap gap-2">
            <span className={chip("live")}>Live</span>
            <span className={chip("muted")}>{invoices.length} invoices</span>
            <span className={chip("muted")}>${totalSum.toFixed(2)} total</span>
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
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur px-4 py-3 text-[12px] text-gray-200/80">
          {message}
        </div>
      )}

      {/* Filter (BIGGER + BETTER) */}
      <div className={panelClass("p-6 sm:p-8")}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <p className="text-[12px] font-semibold tracking-[0.28em] uppercase text-gray-300/70">
              Date range
            </p>
            <p className={helperText}>
              Pick dates (or a quick range), then load invoices.
            </p>
          </div>

          <div className="w-full xl:max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Quick range */}
              <div className="md:col-span-4 space-y-2">
                <label className={controlLabel}>Quick range</label>
                <QuickRangeDropdown value={preset} onChange={setPreset} />
              </div>

              {/* From */}
              <div className="md:col-span-3 space-y-2">
                <label className={controlLabel}>From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setPreset("");
                    setFrom(e.target.value);
                  }}
                  className={dateInputLarge}
                />
              </div>

              {/* To */}
              <div className="md:col-span-3 space-y-2">
                <label className={controlLabel}>To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setPreset("");
                    setTo(e.target.value);
                  }}
                  className={dateInputLarge}
                />
              </div>

              {/* Button */}
              <div className="md:col-span-2 flex items-end">
                <ActionButton
                  type="button"
                  onClick={loadInvoices}
                  disabled={loading}
                  className={
                    "!h-12 !w-full !rounded-2xl !px-6 " +
                    "!text-[12px] !tracking-[0.18em] " +
                    "!whitespace-nowrap"
                  }
                >
                  {loading ? "Loading…" : "Load invoices"}
                </ActionButton>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-gray-200/70">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                Tip: use “Quick range” for common windows
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                From must be ≤ To
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className={panelClass("p-6")}>
          <p className="text-sm text-gray-300/70">Loading…</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className={panelClass("p-6")}>
          <p className="text-sm text-gray-300/70">
            No invoices loaded yet (or none in this range).
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv, idx) => {
            const orderId = inv.orderId ?? inv.id ?? inv.order_id ?? `row-${idx}`;
            const isBusy = busyId === orderId;

            const createdAt = inv.createdAt ?? inv.created_at ?? inv.date;
            const status = inv.status || inv.orderStatus || "—";
            const customerName =
              inv.customer?.fullName || inv.customer?.name || inv.fullName || "—";
            const customerEmail = inv.customer?.email || inv.email || "—";
            const shipTo =
              inv.shippingAddress ||
              inv.shipping_address ||
              inv.address ||
              "—";

            return (
              <div key={orderId} className={panelClass("p-6")}>
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-white">
                        Invoice / Order #{orderId}
                      </p>
                      <span className={chip("muted")}>{status}</span>
                    </div>

                    <div className="grid gap-1">
                      <p className="text-[12px] text-gray-300/60">
                        Date:{" "}
                        <span className="text-gray-100/90">
                          {formatDateTime(createdAt)}
                        </span>
                      </p>

                      <p className="text-[12px] text-gray-300/60 break-words">
                        Customer:{" "}
                        <span className="text-gray-100/90">{customerName}</span>{" "}
                        <span className="text-gray-300/50">·</span>{" "}
                        <span className="text-gray-100/90">{customerEmail}</span>
                      </p>

                      <p className="text-[12px] text-gray-300/60 break-words">
                        Ship to:{" "}
                        <span className="text-gray-100/90">{shipTo}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-3">
                    <p className="text-xl font-semibold text-white">
                      ${Number(inv.total || 0).toFixed(2)}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <ActionButton
                        type="button"
                        onClick={() => handlePrint(orderId)}
                        disabled={isBusy}
                        className="!h-10 !px-5 !text-[11px] !tracking-[0.18em] !whitespace-nowrap"
                      >
                        {isBusy ? "Opening…" : "Print"}
                      </ActionButton>

                      <ActionButton
                        type="button"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => handleDownload(orderId)}
                        className="!h-10 !px-5 !text-[11px] !tracking-[0.18em] !whitespace-nowrap"
                      >
                        {isBusy ? "Saving…" : "Download PDF"}
                      </ActionButton>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

const VARIANTS = {
  primary:
    "bg-black text-white hover:bg-gray-900 shadow-sm shadow-black/10 active:translate-y-[0.5px]",
  outline:
    "border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 shadow-sm shadow-black/5",
  muted:
    "border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 shadow-[0_10px_30px_-12px_rgba(16,185,129,0.45)]",
  info:
    "bg-blue-600 text-white hover:bg-blue-700 shadow-[0_10px_30px_-12px_rgba(59,130,246,0.45)]",
  accent:
    "bg-purple-600 text-white hover:bg-purple-700 shadow-[0_10px_30px_-12px_rgba(147,51,234,0.4)]",
  danger:
    "bg-red-600 text-white hover:bg-red-700 shadow-[0_10px_30px_-12px_rgba(239,68,68,0.45)]",
};

const SIZES = {
  sm: "px-3.5 py-2 text-[11px]",
  xs: "px-3 py-1.5 text-[10px]",
};

export default function ActionButton({
  children,
  variant = "primary",
  size = "sm",
  className = "",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center rounded-full font-semibold uppercase tracking-[0.18em] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed";
  const variantClass = VARIANTS[variant] || VARIANTS.primary;
  const sizeClass = SIZES[size] || SIZES.sm;

  return (
    <button
      className={`${base} ${variantClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function getVariantClass(variant) {
  return VARIANTS[variant] || VARIANTS.primary;
}

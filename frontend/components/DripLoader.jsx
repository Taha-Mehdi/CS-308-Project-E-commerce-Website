"use client";

export default function DripLoader() {
  const GOO_MATRIX =
    "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black">
      {/* SVG filter (hidden, hydration-safe) */}
      <svg width="0" height="0" aria-hidden="true" focusable="false">
        <filter id="dripGoo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values={GOO_MATRIX} result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </svg>

      {/* Drip loader blobs */}
      <div className="relative flex items-center justify-center w-28 h-28 [filter:url(#dripGoo)]">
        {/* Center blob */}
        <span className="absolute w-10 h-10 rounded-full bg-gradient-to-r from-[var(--drip-accent)] to-[var(--drip-accent-2)] animate-pulse" />

        {/* Dripping blobs */}
        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[var(--drip-accent)] animate-drip-160" />
        <span className="absolute bottom-0 left-1/3 w-5 h-5 rounded-full bg-[var(--drip-accent-2)] animate-drip-190" />
        <span className="absolute bottom-0 right-1/3 w-5 h-5 rounded-full bg-[var(--drip-accent)] animate-drip-210" />
      </div>

      {/* Brand text */}
      <div className="absolute bottom-10 text-center">
        <p className="text-[11px] tracking-[0.32em] uppercase text-gray-400">
          SNEAKS-UP
        </p>
      </div>
    </div>
  );
}

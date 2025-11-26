"use client";

import Link from "next/link";
import SiteLayout from "../components/SiteLayout";

export default function NotFound() {
  return (
    <SiteLayout>
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center gap-4">
        <p className="text-[11px] font-semibold tracking-[0.24em] text-gray-500 uppercase">
          404 · Page not found
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
          We couldn&apos;t find that page.
        </h1>
        <p className="text-sm text-gray-600 max-w-md">
          The page you&apos;re looking for might have been moved, deleted, or
          never existed. Try going back to the homepage or browsing products.
        </p>
        <div className="flex flex-wrap gap-3 justify-center mt-2">
          <Link
            href="/"
            className="px-4 py-2.5 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-900 transition-colors"
          >
            Go to homepage
          </Link>
          <Link
            href="/products"
            className="px-4 py-2.5 rounded-full border border-gray-300 text-xs font-medium text-gray-800 hover:bg-gray-100 transition-colors"
          >
            Browse products
          </Link>
        </div>
      </div>
    </SiteLayout>
  );
}

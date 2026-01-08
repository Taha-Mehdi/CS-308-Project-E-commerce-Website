"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useGlobalLoading } from "../context/GlobalLoadingContext";

function isExternalHref(href) {
  if (typeof href !== "string") return false;
  return (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

function hrefToPath(href) {
  if (typeof href === "string") return href;
  // For Link objects, at least keep pathname
  return href?.pathname || "/";
}

export default function DripLink({
  href,
  onClick,
  target,
  rel,
  prefetch,
  replace,
  scroll,
  shallow, // harmless if passed, ignored by App Router
  children,
  ...rest
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { startLoading } = useGlobalLoading();

  const dest = hrefToPath(href);

  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      prefetch={prefetch}
      replace={replace}
      scroll={scroll}
      {...rest}
      onClick={(e) => {
        // Allow new-tab / modified clicks to behave normally
        if (
          target === "_blank" ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0
        ) {
          onClick?.(e);
          return;
        }

        // Let external links behave normally
        if (isExternalHref(dest)) {
          onClick?.(e);
          return;
        }

        // If user clicks link to same route, don't flash loader
        if (dest === pathname) {
          onClick?.(e);
          return;
        }

        // We control navigation to avoid flash + ensure loader paints first
        e.preventDefault();

        startLoading();
        onClick?.(e);

        requestAnimationFrame(() => {
          router.push(dest);
        });
      }}
    >
      {children}
    </Link>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGlobalLoading } from "../context/GlobalLoadingContext";

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
  const { startLoading } = useGlobalLoading();

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

        // We control navigation to avoid flash + avoid click interruption
        e.preventDefault();

        // show loader immediately
        startLoading();

        // run any user handler (like closing mobile menu)
        onClick?.(e);

        // navigate on next frame so loader paints first
        requestAnimationFrame(() => {
          router.push(typeof href === "string" ? href : href?.pathname || "/");
        });
      }}
    >
      {children}
    </Link>
  );
}

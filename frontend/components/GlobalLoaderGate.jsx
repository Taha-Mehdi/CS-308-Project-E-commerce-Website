"use client";

import { useEffect } from "react";
import { useGlobalLoading } from "../context/GlobalLoadingContext";
import DripLoader from "./DripLoader";

function isModifiedClick(e) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

export default function GlobalLoaderGate({ children }) {
  const { loading, startLoading } = useGlobalLoading();

  useEffect(() => {
    const onDocumentClickCapture = (e) => {
      // 1) Allow opt-out anywhere in the click chain
      if (e.target?.closest?.("[data-no-global-loader]")) return;

      // 2) If already prevented, don't start loader
      if (e.defaultPrevented) return;

      // 3) Ignore modified clicks (new tab, etc.)
      if (isModifiedClick(e)) return;

      // 4) Find nearest anchor
      const a = e.target?.closest?.("a");
      if (!a) return;

      // Respect target/download
      const target = a.getAttribute("target");
      if (target && target.toLowerCase() === "_blank") return;
      if (a.hasAttribute("download")) return;

      const hrefAttr = a.getAttribute("href");
      if (!hrefAttr) return;

      // Hash-only navigation shouldn't show full loader
      if (hrefAttr.startsWith("#")) return;

      // Resolve URL
      let url;
      try {
        url = new URL(hrefAttr, window.location.href);
      } catch {
        return;
      }

      // Same-origin only
      if (url.origin !== window.location.origin) return;

      // Same URL -> no loader flash
      const current = new URL(window.location.href);
      const sameUrl =
        url.pathname === current.pathname &&
        url.search === current.search &&
        url.hash === current.hash;

      if (sameUrl) return;

      // Start loader now; it should stop when route changes (your existing logic)
      startLoading();
    };

    document.addEventListener("click", onDocumentClickCapture, true);
    return () => document.removeEventListener("click", onDocumentClickCapture, true);
  }, [startLoading]);

  return (
    <>
      {children}
      {loading ? <DripLoader /> : null}
    </>
  );
}

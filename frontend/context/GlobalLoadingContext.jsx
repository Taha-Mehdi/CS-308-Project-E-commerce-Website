"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";

const GlobalLoadingContext = createContext(null);

const MIN_LOADER_MS = 700; // minimum visible time to avoid flicker

export function GlobalLoadingProvider({ children }) {
  const pathname = usePathname();

  const [loading, setLoading] = useState(false);

  const startedAtRef = useRef(0);
  const stopTimeoutRef = useRef(null);
  const loadingRef = useRef(false);

  const clearStopTimer = () => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  };

  const startLoading = useCallback(() => {
    clearStopTimer();
    startedAtRef.current = Date.now();
    loadingRef.current = true;
    setLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    if (!loadingRef.current) return;

    const elapsed = Date.now() - (startedAtRef.current || Date.now());
    const remaining = Math.max(0, MIN_LOADER_MS - elapsed);

    clearStopTimer();

    if (remaining > 0) {
      stopTimeoutRef.current = setTimeout(() => {
        loadingRef.current = false;
        setLoading(false);
        stopTimeoutRef.current = null;
      }, remaining);
    } else {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  // Stop the loader when navigation actually completes (pathname changes)
  useEffect(() => {
    stopLoading();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Back/forward navigation: start loader immediately, stop happens on pathname change above
  useEffect(() => {
    const onPop = () => startLoading();
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, [startLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearStopTimer();
    };
  }, []);

  return (
    <GlobalLoadingContext.Provider value={{ loading, startLoading, stopLoading }}>
      {children}
    </GlobalLoadingContext.Provider>
  );
}

export function useGlobalLoading() {
  const ctx = useContext(GlobalLoadingContext);
  if (!ctx) {
    throw new Error("useGlobalLoading must be used within GlobalLoadingProvider");
  }
  return ctx;
}

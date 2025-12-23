"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

const GlobalLoadingContext = createContext(null);

export function GlobalLoadingProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef(null);

  const startLoading = () => {
    // Start immediately
    setLoading(true);

    // Reset timer if user clicks fast multiple times
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Force minimum loader duration (1s)
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  // Back/forward navigation
  useEffect(() => {
    const onPop = () => startLoading();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GlobalLoadingContext.Provider value={{ loading, startLoading }}>
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

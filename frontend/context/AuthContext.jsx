"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { clearStoredTokens, addToCartApi } from "../lib/api";

const AuthContext = createContext(null);

function getRoleName(u) {
  return u?.roleName || u?.role || u?.role_name || null;
}

function isCustomerRole(u) {
  return getRoleName(u) === "customer";
}

function safeParseArray(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function normalizeGuestCart(rawItems) {
  // Aggregate quantities by productId, ignore invalid rows
  const map = new Map();
  for (const it of rawItems) {
    const pid = Number(it?.productId);
    if (!Number.isInteger(pid) || pid <= 0) continue;

    const qty = Number(it?.quantity);
    const q = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;

    map.set(pid, (map.get(pid) || 0) + q);
  }
  return Array.from(map.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window === "undefined") {
        setLoadingUser(false);
        return;
      }

      const storedToken = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");

      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser && typeof parsedUser === "object") {
            setToken(storedToken);
            setUser(parsedUser);
          }
        } catch (err) {
          console.warn("Failed to parse stored user:", err);
        }
      }
    } catch (err) {
      console.warn("Auth init error:", err);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  /**
   * Merge guestCart into authenticated cart.
   *
   * Conflict-safe behavior:
   * - Aggregates duplicate productIds (sum quantities)
   * - Attempts to sync each item
   * - Removes only successfully-synced items from guestCart
   * - Leaves failed items in guestCart (so nothing is lost)
   */
  async function mergeGuestCartIntoServer(currentUser) {
    if (typeof window === "undefined") return;

    // Only customers should own carts
    if (!isCustomerRole(currentUser)) return;

    const raw = localStorage.getItem("guestCart");
    if (!raw) return;

    // Prevent double-merge loops in edge cases
    // (e.g. login called twice quickly)
    if (localStorage.getItem("guestCartMergeInProgress") === "1") return;

    const guestCartRaw = safeParseArray(raw);
    const guestItems = normalizeGuestCart(guestCartRaw);
    if (guestItems.length === 0) return;

    localStorage.setItem("guestCartMergeInProgress", "1");

    try {
      const successes = new Set(); // productIds successfully merged

      for (const item of guestItems) {
        try {
          // addToCartApi should increment quantity on server-side
          await addToCartApi({ productId: item.productId, quantity: item.quantity });
          successes.add(item.productId);
        } catch (err) {
          // If auth/role fails, stop merging (keep guest cart intact)
          if (err?.status === 401 || err?.status === 403) break;

          // For other errors (network, product missing, etc.), keep going
          console.warn("Guest cart sync failed for", item, err);
        }
      }

      if (successes.size > 0) {
        // Remove only successfully-merged items; keep failed items for safety
        const remaining = guestItems.filter((it) => !successes.has(it.productId));

        if (remaining.length === 0) localStorage.removeItem("guestCart");
        else localStorage.setItem("guestCart", JSON.stringify(remaining));

        window.dispatchEvent(new Event("cart-updated"));
      }
    } finally {
      localStorage.removeItem("guestCartMergeInProgress");
    }
  }

  function login(newToken, newUser) {
    if (!newToken || !newUser || typeof newUser !== "object") {
      console.warn("AuthContext.login received invalid data:", { newToken, newUser });
      return;
    }

    try {
      setToken(newToken);
      setUser(newUser);

      if (typeof window !== "undefined") {
        localStorage.setItem("token", newToken);
        localStorage.setItem("user", JSON.stringify(newUser));

        // ✅ Merge guest cart after auth is stored (api.js reads token from storage)
        mergeGuestCartIntoServer(newUser);
      }
    } catch (err) {
      console.error("AuthContext.login storage error:", err);
    }
  }

  function logout() {
    try {
      setToken(null);
      setUser(null);

      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }

      clearStoredTokens();
      window.dispatchEvent(new Event("cart-updated"));
    } catch (err) {
      console.error("AuthContext.logout error:", err);
    }
  }

  const value = {
    token,
    user,
    loadingUser,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

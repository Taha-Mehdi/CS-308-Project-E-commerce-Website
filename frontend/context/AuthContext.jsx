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

  // Helper: merge guest cart into server cart after login
  async function mergeGuestCartIntoServer(currentUser) {
    if (typeof window === "undefined") return;

    // ✅ Only customers should have carts / orders
    if (!isCustomerRole(currentUser)) {
      // Keep guest cart for later in case they log in as customer later
      return;
    }

    try {
      const raw = localStorage.getItem("guestCart");
      if (!raw) return;

      let guestCart;
      try {
        guestCart = JSON.parse(raw);
      } catch {
        guestCart = null;
      }

      if (!Array.isArray(guestCart) || guestCart.length === 0) return;

      // Add each item to backend cart
      for (const item of guestCart) {
        if (!item || typeof item.productId !== "number") continue;
        const qty = Number(item.quantity) || 1;

        try {
          await addToCartApi({
            productId: item.productId,
            quantity: qty,
          });
        } catch (err) {
          // ✅ If role/cart forbidden, stop spamming console and stop merging
          if (err?.status === 403) return;
          if (err?.status === 401) return;
          // For other issues, keep it quiet (optional: console.warn)
          console.warn("Failed to sync guest cart item", item, err);
        }
      }

      // Clear guest cart once merged
      localStorage.removeItem("guestCart");
      window.dispatchEvent(new Event("cart-updated"));
    } catch (err) {
      console.error("mergeGuestCartIntoServer error:", err);
    }
  }

  function login(newToken, newUser) {
    if (!newToken || !newUser || typeof newUser !== "object") {
      console.warn("AuthContext.login received invalid data:", {
        newToken,
        newUser,
      });
      return;
    }

    try {
      setToken(newToken);
      setUser(newUser);

      if (typeof window !== "undefined") {
        localStorage.setItem("token", newToken);
        localStorage.setItem("user", JSON.stringify(newUser));

        // ✅ merge only if customer
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
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

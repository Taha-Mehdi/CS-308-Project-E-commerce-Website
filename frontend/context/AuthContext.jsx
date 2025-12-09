"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { clearStoredTokens, addToCartApi } from "../lib/api";

const AuthContext = createContext(null);

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
          setToken(storedToken);
          setUser(parsedUser);
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
  async function mergeGuestCartIntoServer() {
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem("guestCart");
      if (!raw) return;

      let guestCart;
      try {
        guestCart = JSON.parse(raw);
      } catch {
        guestCart = null;
      }

      if (!Array.isArray(guestCart) || guestCart.length === 0) {
        return;
      }

      // For each guest cart item, call backend /cart/add
      for (const item of guestCart) {
        if (!item || typeof item.productId !== "number") continue;
        const qty = Number(item.quantity) || 1;

        try {
          await addToCartApi({
            productId: item.productId,
            quantity: qty,
          });
        } catch (err) {
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
        // token is also stored by api.js, but we keep this for compatibility
        localStorage.setItem("token", newToken);
        localStorage.setItem("user", JSON.stringify(newUser));
        mergeGuestCartIntoServer();
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

      // Also clear access + refresh token via api.js helper
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

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

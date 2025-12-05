"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { clearStoredTokens } from "../lib/api";

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

  // MAIN login()
  // Call this after a successful login/register API call
  // e.g. const data = await loginApi(...); login(data.token, data.user);
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

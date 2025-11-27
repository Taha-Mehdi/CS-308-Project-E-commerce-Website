"use client";

import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedToken =
        typeof window !== "undefined"
          ? localStorage.getItem("token")
          : null;
      const storedUser =
        typeof window !== "undefined"
          ? localStorage.getItem("user")
          : null;

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

  // MAIN login() — this is where the “Invalid data” was coming from before
  function login(newToken, newUser) {
    // Be lenient: just check we have *something* sensible
    if (!newToken || !newUser || typeof newUser !== "object") {
      console.warn("AuthContext.login received invalid data:", {
        newToken,
        newUser,
      });
      // Don’t throw anymore – just ignore and stay logged out
      return;
    }

    try {
      setToken(newToken);
      setUser(newUser);

      if (typeof window !== "undefined") {
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

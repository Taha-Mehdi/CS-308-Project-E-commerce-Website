"use client";

import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  // Load token + user on first load
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      setTokenReady(true);
      setLoadingUser(false);
      return;
    }

    async function fetchMe() {
      try {
        const res = await fetch(`${apiBase}/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (!res.ok) {
          // token invalid/expired
          localStorage.removeItem("token");
          setUser(null);
        } else {
          const data = await res.json();
          setUser(data);
        }
      } catch (err) {
        console.error("Failed to load current user:", err);
      } finally {
        setTokenReady(true);
        setLoadingUser(false);
      }
    }

    fetchMe();
  }, [apiBase]);

  // Login helper
  async function login(email, password) {
    const res = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Login failed");
    }

    if (data.token) {
      localStorage.setItem("token", data.token);
      setUser(data.user);
    }

    return data;
  }

  // Register helper
  async function register(email, password, fullName) {
    const res = await fetch(`${apiBase}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, fullName }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Register failed");
    }

    if (data.token) {
      localStorage.setItem("token", data.token);
      setUser(data.user);
    }

    return data;
  }

  // Logout helper
  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  const value = {
    user,
    loadingUser,
    tokenReady,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

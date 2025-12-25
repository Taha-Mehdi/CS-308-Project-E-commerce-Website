"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import AdminShell from "../../components/AdminShell";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const { user, loadingUser } = useAuth();

  // 1. LOG EVERYTHING IMMEDIATELY
  // If you don't see this in the browser console, the page isn't loading at all.
  console.log("ADMIN LAYOUT MOUNTED", {
    loadingUser,
    role: user?.roleName,
    email: user?.email
  });

  useEffect(() => {
    // Don't do anything until we know who the user is
    if (loadingUser) return;

    // 2. If no user, Go to Login
    if (!user) {
      console.log("No user found. Redirecting to login...");
      router.replace("/login?next=/admin");
      return;
    }

    // 3. THE PERMISSION CHECK
    // We allow "admin" OR "product_manager"
    const isAllowed = user.roleName === "admin" || user.roleName === "product_manager";

    console.log("Is User Allowed?", isAllowed);

    if (!isAllowed) {
      console.log("Access Denied! Redirecting to home...");
      router.replace("/");
    }
  }, [user, loadingUser, router]);

  // 4. THE RENDER GUARD (Prevents flashing)
  if (loadingUser) {
    return <div className="p-10 text-white">Checking permissions...</div>;
  }

  if (!user) return null;

  const isAllowed = user.roleName === "admin" || user.roleName === "product_manager";
  if (!isAllowed) return null;

  // 5. If we passed all checks, show the page
  return <AdminShell title="Sneaks-up · Product Manager">{children}</AdminShell>;
}
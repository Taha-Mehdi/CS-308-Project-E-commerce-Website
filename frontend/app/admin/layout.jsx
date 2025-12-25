"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import AdminShell from "../../components/AdminShell";

function getRole(user) {
  return user?.roleName || user?.role || user?.role_name || "";
}

export default function AdminLayout({ children }) {
  const router = useRouter();
  const { user, loadingUser } = useAuth();

  useEffect(() => {
    if (loadingUser) return;

    if (!user) {
      router.replace("/login?next=/admin");
      return;
    }

    const role = getRole(user);
    const allowed = role === "admin" || role === "product_manager";
    if (!allowed) router.replace("/");
  }, [user, loadingUser, router]);

  if (loadingUser) {
    return (
      <AdminShell title="Sneaks-up · Admin">
        <p className="text-sm text-gray-300/70">Checking access…</p>
      </AdminShell>
    );
  }

  const role = getRole(user);
  const allowed = user && (role === "admin" || role === "product_manager");
  if (!allowed) return null;

  return <AdminShell title="Sneaks-up · Admin">{children}</AdminShell>;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import SalesShell from "../../components/SalesShell";

function getRole(user) {
  return user?.roleName || user?.role || user?.role_name || "";
}

export default function SalesAdminLayout({ children }) {
  const router = useRouter();
  const { user, loadingUser } = useAuth();

  useEffect(() => {
    if (loadingUser) return;

    if (!user) {
      router.replace("/login?next=/sales-admin");
      return;
    }

    const role = getRole(user);
    const allowed = role === "sales_manager" || role === "admin";
    if (!allowed) router.replace("/");
  }, [user, loadingUser, router]);

  if (loadingUser) {
    return (
      <SalesShell title="Sneaks-up · Sales">
        <p className="text-sm text-gray-300/70">Checking access…</p>
      </SalesShell>
    );
  }

  const role = getRole(user);
  const allowed = user && (role === "sales_manager" || role === "admin");
  if (!allowed) return null;

  return <SalesShell title="Sneaks-up · Sales">{children}</SalesShell>;
}

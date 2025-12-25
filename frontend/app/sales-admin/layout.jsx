"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import SalesShell from "../../components/SalesShell";

export default function SalesAdminLayout({ children }) {
  const router = useRouter();
  const { user, loadingUser } = useAuth();

  useEffect(() => {
    if (loadingUser) return;

    if (!user) {
      router.replace("/login?next=/sales-admin");
      return;
    }

    if (user.roleName !== "sales_manager") {
      router.replace("/");
    }
  }, [user, loadingUser, router]);

  if (loadingUser || !user || user.roleName !== "sales_manager") return null;

  return <SalesShell title="Sneaks-up · Sales">{children}</SalesShell>;
}

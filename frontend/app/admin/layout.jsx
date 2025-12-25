"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import AdminShell from "../../components/AdminShell";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const { user, loadingUser } = useAuth();

  useEffect(() => {
    if (loadingUser) return;

    if (!user) {
      router.replace("/login?next=/admin");
      return;
    }

    if (user.roleName !== "admin") {
      router.replace("/");
    }
  }, [user, loadingUser, router]);

  if (loadingUser || !user || user.roleName !== "admin") return null;

  return <AdminShell title="Sneaks-up · Admin">{children}</AdminShell>;
}

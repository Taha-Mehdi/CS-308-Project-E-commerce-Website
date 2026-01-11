"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import SupportShell from "../../components/SupportShell";

export default function SupportLayout({ children }) {
  const router = useRouter();
  const { user, loadingUser } = useAuth();

  useEffect(() => {
    if (loadingUser) return;

    if (!user) {
      router.replace("/login?next=/support");
      return;
    }

    if (user.roleName !== "support") {
      router.replace("/");
    }
  }, [user, loadingUser, router]);

  if (loadingUser || !user || user.roleName !== "support") return null;

  return <SupportShell title="Sneaks-up · Support">{children}</SupportShell>;
}

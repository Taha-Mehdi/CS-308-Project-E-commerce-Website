"use client";

import { usePathname } from "next/navigation";

export default function PageTransition({ children }) {
  const pathname = usePathname();

  // key forces remount on navigation so the CSS animation replays
  return (
    <div key={pathname} className="page-fade">
      {children}
    </div>
  );
}

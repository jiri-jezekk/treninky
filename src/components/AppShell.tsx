"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      <AppSidebar currentPath={pathname} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}

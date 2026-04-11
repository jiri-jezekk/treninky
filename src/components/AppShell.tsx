"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AppSidebar, MobileMenuPanel } from "@/components/AppSidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-[100dvh]">
      <AppSidebar currentPath={pathname} />

      <div className="flex min-h-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/90 bg-white px-3 py-2.5 shadow-sm md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu-drawer"
            aria-label="Otevřít menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <span className="truncate text-sm font-medium text-slate-800">Treninky</span>
        </header>

        <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 md:p-8">{children}</main>
      </div>

      {mobileOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
            aria-label="Zavřít menu"
            onClick={() => setMobileOpen(false)}
          />
          <div
            id="mobile-menu-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(17rem,82vw)] max-w-[85vw] flex-col shadow-xl md:hidden"
          >
            <MobileMenuPanel currentPath={pathname} onClose={() => setMobileOpen(false)} />
          </div>
        </>
      ) : null}
    </div>
  );
}

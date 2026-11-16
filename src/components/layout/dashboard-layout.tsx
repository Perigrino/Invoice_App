"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { StorageHydrator } from "./storage-hydrator";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import { RecoveryKeyGate } from "@/components/settings/recovery";
import { Toaster } from "@/components/ui/toaster";

export function DashboardLayout({
  children,
  workspaceId,
}: {
  children: React.ReactNode;
  workspaceId: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const mobileNavOpen = useUIStore((s) => s.mobileNavOpen);
  const closeMobileNav = useUIStore((s) => s.closeMobileNav);
  const pathname = usePathname();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1279px)");
    const apply = () => setCollapsed(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileNav();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen, closeMobileNav]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    // Anonymous workspace id only: there is no account to identify.
    posthog.identify(`workspace_${workspaceId}`);
    return () => posthog.reset();
  }, [workspaceId]);

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-subtle dark:bg-gradient-subtle">
      <StorageHydrator workspaceId={workspaceId} />
      <RecoveryKeyGate />
      <Toaster />
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={closeMobileNav}
          aria-hidden="true"
        />
      )}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileNavOpen}
        onClose={closeMobileNav}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className={cn("flex-1 overflow-auto p-4 lg:p-6")}>
          {children}
        </main>
      </div>
    </div>
  );
}

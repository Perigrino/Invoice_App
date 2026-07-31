"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { StorageHydrator } from "./storage-hydrator";
import { cn } from "@/lib/utils";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-subtle dark:bg-gray-900">
      <StorageHydrator />
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className={cn("flex-1 overflow-auto p-6")}>
          {children}
        </main>
      </div>
    </div>
  );
}

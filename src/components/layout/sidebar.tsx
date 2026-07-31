"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Plus,
  Check,
} from "lucide-react";
import { useProfileStore } from "@/store/profile-store";

const navItems = [
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = resolvedTheme || theme;

  return (
    <button
      type="button"
      onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50",
        collapsed && "justify-center px-2"
      )}
    >
      {mounted && currentTheme === "dark" ? (
        <Sun className="h-5 w-5 flex-shrink-0" />
      ) : (
        <Moon className="h-5 w-5 flex-shrink-0" />
      )}
      {!collapsed && <span>{mounted && currentTheme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
    </button>
  );
}

function ProfileSwitcher({ collapsed }: { collapsed: boolean }) {
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const switchProfile = useProfileStore((s) => s.switchProfile);

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  return (
    <div className={cn("border-t border-gray-200 dark:border-gray-800", collapsed && "flex flex-col items-center")}>
      {!collapsed && (
        <div className="p-2">
          <div className="relative">
            <select
              value={activeProfileId}
              onChange={(e) => switchProfile(e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {collapsed && activeProfile && (
        <div className="p-2">
          <div
            title={activeProfile.name}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
          >
            {activeProfile.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
        {!collapsed && (
          <Link href="/invoices" className="flex items-center gap-2 font-semibold">
            <FileText className="h-5 w-5 text-emerald-600" />
            <span className="bg-gradient-to-r from-emerald-600 via-violet-600 to-pink-600 bg-clip-text text-transparent">InvoiceFlow</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/invoices" className="mx-auto">
            <FileText className="h-5 w-5 text-emerald-600" />
          </Link>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/invoices" && pathname?.startsWith(item.href));
            return (
                <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-emerald-50 to-violet-50 text-emerald-700 dark:from-emerald-950/60 dark:to-violet-950/60 dark:text-emerald-400 shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50",
                  collapsed && "justify-center px-2"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <ProfileSwitcher collapsed={collapsed} />

      <div className="border-t border-gray-200 dark:border-gray-800">
        <div className="p-2">
          <ThemeToggle collapsed={collapsed} />
        </div>
        <div className="border-t border-gray-200 p-4 dark:border-gray-800">
          {!collapsed && (
            <p className="text-xs text-gray-400">
              InvoiceFlow v1.0
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

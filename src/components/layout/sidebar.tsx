"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  ShieldCheck,
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
  mobileOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

function ProfileSwitcher({ collapsed }: { collapsed: boolean }) {
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const switchProfile = useProfileStore((s) => s.switchProfile);

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  return (
    <div
      className={cn(
        "border-t border-gray-200 dark:border-gray-800",
        collapsed && "lg:flex lg:flex-col lg:items-center"
      )}
    >
      <div className={cn("p-2", collapsed && "lg:hidden")}>
        <p className="px-1 pb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Company
        </p>
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
      {collapsed && activeProfile && (
        <div className="hidden p-2 lg:block">
          <div
            title={activeProfile.name}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
          >
            {(activeProfile.name || "?").charAt(0).toUpperCase()}
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onClose, isAdmin }: SidebarProps) {
  const pathname = usePathname();
  const items = isAdmin
    ? [...navItems, { href: "/admin", label: "Admin", icon: ShieldCheck }]
    : navItems;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white/95 backdrop-blur-xl transition-transform duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-950/95 lg:static lg:z-auto lg:translate-x-0 lg:bg-white/70 lg:transition-[width] lg:duration-300 lg:dark:bg-gray-950/70",
        mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        collapsed ? "lg:w-16" : "lg:w-60"
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
        <Link
          href="/invoices"
          className={cn(
            "flex items-center gap-2 font-semibold",
            collapsed && "lg:hidden"
          )}
        >
          <FileText className="h-5 w-5 text-emerald-600" />
          <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-violet-500 bg-clip-text text-transparent">
            InvoiceFlow
          </span>
        </Link>
        <Link
          href="/invoices"
          className={cn("mx-auto hidden", collapsed && "lg:flex")}
        >
          <FileText className="h-5 w-5 text-emerald-600" />
        </Link>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close menu"
            className="lg:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden h-8 w-8 lg:flex"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/invoices" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200 lg:py-2",
                  isActive
                    ? "bg-gradient-to-r from-emerald-50 to-violet-50 text-emerald-700 shadow-sm dark:from-emerald-950/60 dark:to-violet-950/60 dark:text-emerald-400"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50",
                  collapsed && "lg:justify-center lg:px-2"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className={cn(collapsed && "lg:hidden")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <ProfileSwitcher collapsed={collapsed} />

      <div className="border-t border-gray-200 dark:border-gray-800">
        <div className="border-t border-gray-200 p-4 dark:border-gray-800">
          <p
            className={cn(
              "text-xs text-gray-400",
              collapsed && "lg:hidden"
            )}
          >
            InvoiceFlow v1.0
          </p>
        </div>
      </div>
    </aside>
  );
}

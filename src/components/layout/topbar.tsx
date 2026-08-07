"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/ui/theme-provider";
import { Button } from "@/components/ui/button";
import { UserMenu } from "./user-menu";
import { Sun, Moon, Menu } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import type { DashboardUser } from "./dashboard-layout";

export function Topbar({ user }: { user: DashboardUser }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const openMobileNav = useUIStore((s) => s.openMobileNav);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = resolvedTheme || theme;

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white/80 px-4 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/80 lg:px-6">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={openMobileNav}
        aria-label="Open menu"
        className="h-10 w-10 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="ml-auto flex items-center gap-2 lg:gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          className="h-10 w-10 lg:h-8 lg:w-8"
        >
          {mounted && currentTheme === "dark" ? (
            <Sun className="h-5 w-5 lg:h-4 lg:w-4" />
          ) : (
            <Moon className="h-5 w-5 lg:h-4 lg:w-4" />
          )}
        </Button>
        <UserMenu user={user} />
      </div>
    </header>
  );
}

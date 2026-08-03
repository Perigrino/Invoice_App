"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Sun,
  Moon,
  Menu,
} from "lucide-react";
import { useUIStore } from "@/store/ui-store";

export function Topbar() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { toggleSidebar } = useUIStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = resolvedTheme || theme;

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white/80 backdrop-blur-sm px-6 dark:border-gray-800 dark:bg-gray-950/80">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-8 w-8 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
          className="h-8 w-8"
        >
          {mounted && currentTheme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </header>
  );
}

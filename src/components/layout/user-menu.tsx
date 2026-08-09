"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { track } from "@/lib/analytics";
import type { DashboardUser } from "./dashboard-layout";

function initialsOf(user: DashboardUser) {
  if (user.name) {
    const parts = user.name.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

export function UserMenu({ user }: { user: DashboardUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-lg px-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/70 lg:h-9"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white lg:h-7 lg:w-7">
          {initialsOf(user)}
        </span>
        <span className="hidden max-w-[140px] truncate text-sm font-medium text-gray-700 dark:text-gray-300 sm:inline">
          {user.username || user.name || user.email}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-[80dvh] w-60 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl shadow-gray-200/60 dark:border-gray-800 dark:bg-gray-950 dark:shadow-black/40">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
              {user.username ? `@${user.username}` : user.name}
            </p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {user.email}
            </p>
          </div>
          <div className="my-1 h-px bg-gray-100 dark:bg-gray-800" />
          <form action={logoutAction} onSubmit={() => track("logout")}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

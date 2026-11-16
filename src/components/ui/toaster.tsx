"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/store/toast-store";

/**
 * The one place a failed write becomes visible. Errors are assertive and stay
 * up longer than confirmations, because they usually mean the user's work is
 * not on the server.
 */
export function Toaster() {
  const notices = useToastStore((state) => state.notices);
  const dismiss = useToastStore((state) => state.dismiss);

  if (notices.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
    >
      {notices.map((notice) => (
        <div
          key={notice.id}
          role={notice.kind === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg",
            notice.kind === "error"
              ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/80 dark:text-red-100"
              : "border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
          )}
        >
          <span className="flex-1">{notice.message}</span>
          <button
            type="button"
            onClick={() => dismiss(notice.id)}
            aria-label="Dismiss"
            className="-mr-1 shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

import Link from "next/link";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthScene } from "@/components/auth/auth-scene";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-subtle px-4 py-10 dark:bg-gradient-subtle">
      <AuthScene />
      <div className="relative z-10 w-full max-w-md">
        <div
          className="auth-fade rounded-2xl border border-gray-200 bg-white/85 p-6 shadow-xl shadow-gray-200/50 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-950/85 dark:shadow-black/40 sm:p-8"
          style={{ "--auth-delay": "0ms" } as React.CSSProperties}
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <Link
              href="/"
              className="auth-logo-enter mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-500 to-violet-600 shadow-lg shadow-emerald-500/30 transition-transform duration-300 hover:scale-105 active:scale-95"
              style={{ "--auth-delay": "40ms" } as React.CSSProperties}
            >
              <FileText className="h-7 w-7 text-white" />
            </Link>
            <h1
              className="auth-enter text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50"
              style={{ "--auth-delay": "120ms" } as React.CSSProperties}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="auth-enter mt-1.5 text-sm text-gray-500 dark:text-gray-400"
                style={{ "--auth-delay": "190ms" } as React.CSSProperties}
              >
                {subtitle}
              </p>
            )}
          </div>
          <div className="auth-enter" style={{ "--auth-delay": "260ms" } as React.CSSProperties}>
            {children}
          </div>
        </div>
        <p
          className={cn(
            "auth-enter mt-6 text-center text-xs text-gray-400 dark:text-gray-600"
          )}
          style={{ "--auth-delay": "340ms" } as React.CSSProperties}
        >
          InvoiceFlow — invoicing for freelancers &amp; small businesses
        </p>
      </div>
    </div>
  );
}

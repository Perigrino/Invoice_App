import Link from "next/link";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-subtle px-4 py-10 dark:bg-gradient-subtle">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white/85 p-6 shadow-xl shadow-gray-200/50 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-950/85 dark:shadow-black/40 sm:p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <Link href="/" className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-500 to-violet-600 shadow-lg shadow-emerald-500/30">
              <FileText className="h-7 w-7 text-white" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                {subtitle}
              </p>
            )}
          </div>
          {children}
        </div>
        <p
          className={cn(
            "mt-6 text-center text-xs text-gray-400 dark:text-gray-600"
          )}
        >
          InvoiceFlow — invoicing for freelancers &amp; small businesses
        </p>
      </div>
    </div>
  );
}

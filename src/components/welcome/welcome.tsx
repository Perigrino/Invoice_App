"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { RecoverKeyForm } from "./recover-key-form";

/**
 * Deliberately plain: one column, one accent, one action. The buffer only
 * earns its place if it costs the visitor nothing but a click.
 */
export function Welcome() {
  useEffect(() => {
    track("landing_viewed");
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-6 py-16 dark:bg-gray-950">
      <div className="w-full max-w-[36rem]">
        <p className="text-sm font-semibold tracking-wide text-emerald-600 dark:text-emerald-400">
          InvoiceFlow
        </p>

        <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-gray-900 sm:text-4xl dark:text-gray-50">
          Make an invoice in your browser.
        </h1>

        <p className="mt-3 text-base leading-relaxed text-gray-600 dark:text-gray-300">
          No account, no sign-up. What you write here stays in this browser.
        </p>

        <div className="mt-8">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/invoices/new" onClick={() => track("landing_start")}>
              Create an invoice
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          After your first invoice you&rsquo;ll get a recovery key. Keep it — it is the only way
          back to your invoices if you clear this browser.
        </p>

        <div className="mt-14 border-t border-gray-100 pt-8 dark:border-gray-900">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Have a recovery key?
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Open that workspace in this browser.
          </p>
          <RecoverKeyForm />
        </div>
      </div>
    </main>
  );
}

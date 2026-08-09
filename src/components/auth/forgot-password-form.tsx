"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import { requestPasswordResetAction, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { track } from "@/lib/analytics";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    requestPasswordResetAction,
    {}
  );

  useEffect(() => {
    if (state.success) track("password_reset_requested");
  }, [state.success]);

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
          {state.success}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="pt-1 text-center text-sm text-gray-500 dark:text-gray-400">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

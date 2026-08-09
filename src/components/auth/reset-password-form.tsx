"use client";

import { useActionState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { resetPasswordAction, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { track } from "@/lib/analytics";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    resetPasswordAction,
    {}
  );

  useEffect(() => {
    if (state.success) track("password_reset_success");
  }, [state.success]);

  if (!token || !email) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
        This reset link is invalid or incomplete.{" "}
        <Link href="/forgot-password" className="font-semibold underline">
          Request a new one
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <div className="space-y-3">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
            {state.success}
          </p>
          <Button asChild className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      )}
      {!state.success && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? "Updating…" : "Reset password"}
          </Button>
        </>
      )}
    </form>
  );
}

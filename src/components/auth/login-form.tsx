"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  loginAction,
  resendVerificationAction,
  type AuthFormState,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { track } from "@/lib/analytics";

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    loginAction,
    {}
  );
  const [email, setEmail] = useState("");
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resending, startResending] = useTransition();
  const prevPending = useRef(false);

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      track("login_success", { email });
    }
    prevPending.current = pending;
  }, [pending, state.error, email]);

  const resend = () => {
    setResendMsg(null);
    startResending(async () => {
      const r = await resendVerificationAction(email);
      setResendMsg(r.success ?? r.error ?? "");
    });
  };

  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={() => track("login_started", { email })}
    >
      {state.error && (
        <div className="space-y-2">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 dark:bg-red-950/50 dark:text-red-400">
            {state.error}
          </p>
          {state.needsVerification && email && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={resending}
              onClick={resend}
            >
              {resending && <Loader2 className="h-4 w-4 animate-spin" />}
              Resend verification email
            </Button>
          )}
          {resendMsg && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
              {resendMsg}
            </p>
          )}
        </div>
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </div>
      <Button type="submit" disabled={pending} className="btn-springy w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="pt-1 text-center text-sm text-gray-500 dark:text-gray-400">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}

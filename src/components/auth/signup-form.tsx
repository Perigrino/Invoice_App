"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, MailCheck, X } from "lucide-react";
import { signupAction, resendVerificationAction, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { passwordRules } from "@/lib/validations/auth";
import { track } from "@/lib/analytics";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signupAction,
    {}
  );
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resending, startResending] = useTransition();
  const [resendState, setResendState] = useState<AuthFormState | null>(null);

  useEffect(() => {
    if (state.success) {
      track("signup_success", { email });
    } else if (state.error) {
      track("signup_error", { email });
    }
  }, [state.success, state.error, email]);

  const usernameValid = /^[a-zA-Z0-9_]{3,20}$/.test(username);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (state.success) {
    const confirmedEmail = state.email ?? email;
    const sendFailed = state.success.includes("couldn't send");
    return (
      <div className="flex flex-col items-center space-y-5 text-center">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-inner ${
            sendFailed
              ? "bg-amber-100 dark:bg-amber-950/60"
              : "bg-emerald-100 dark:bg-emerald-950/60"
          }`}
        >
          <MailCheck
            className={`h-8 w-8 ${
              sendFailed ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
            }`}
          />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            {sendFailed ? "Almost there" : "Check your inbox"}
          </h2>
          {sendFailed ? (
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {state.success} We&apos;ll send a fresh link if you need one.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              We sent a confirmation link to
              {confirmedEmail ? (
                <>
                  {" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {confirmedEmail}
                  </span>
                </>
              ) : (
                " your email"
              )}
              . Click it to verify your account — the link expires in 1 hour.
            </p>
          )}
        </div>

        {!sendFailed && (
          <div className="w-full rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2.5 text-left text-xs leading-relaxed text-gray-500 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
            Can&apos;t find it? Check your spam folder or request a new link below.
          </div>
        )}

        <div className="w-full space-y-2">
          {resendState?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 dark:bg-red-950/50 dark:text-red-400">
              {resendState.error}
            </p>
          )}
          {resendState?.success && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
              {resendState.success}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={resending}
            onClick={() =>
              startResending(async () => {
                setResendState(null);
                setResendState(await resendVerificationAction(confirmedEmail));
              })
            }
          >
            {resending && <Loader2 className="h-4 w-4 animate-spin" />}
            {sendFailed ? "Try sending again" : "Resend verification email"}
          </Button>
        </div>

        <Button variant="ghost" asChild className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={() => track("signup_started", { email })}
    >
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {state.error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          placeholder="janedoe"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        {username && !usernameValid && (
          <p className="text-xs text-red-500">
            3–20 characters. Letters, numbers, and underscores only.
          </p>
        )}
      </div>
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
        {email && !emailValid && <p className="text-xs text-red-500">Enter a valid email address.</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {password && (
          <ul className="mt-2 space-y-1">
            {passwordRules.map((rule) => {
              const ok = rule.test(password);
              return (
                <li
                  key={rule.id}
                  className={`flex items-center gap-1.5 text-xs ${
                    ok ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"
                  }`}
                >
                  {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  {rule.label}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="pt-1 text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
          Sign in
        </Link>
      </p>
    </form>
  );
}

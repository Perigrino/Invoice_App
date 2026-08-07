"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";
import { signupAction, resendVerificationAction, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { passwordRules } from "@/lib/validations/auth";

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

  const usernameValid = /^[a-zA-Z0-9_]{3,20}$/.test(username);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (state.success) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
          {state.success}
        </p>
        <div className="space-y-2">
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
                setResendState(await resendVerificationAction(email));
              })
            }
          >
            {resending && <Loader2 className="h-4 w-4 animate-spin" />}
            Resend verification email
          </Button>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
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

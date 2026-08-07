"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { resendVerificationAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function ResendVerificationButton({ email }: { email: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [resending, startResending] = useTransition();

  const resend = () => {
    setMessage(null);
    startResending(async () => {
      const r = await resendVerificationAction(email);
      setMessage(r.success ?? r.error ?? "");
    });
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={resending || !email}
        onClick={resend}
      >
        {resending && <Loader2 className="h-4 w-4 animate-spin" />}
        Resend verification email
      </Button>
      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
          {message}
        </p>
      )}
    </div>
  );
}

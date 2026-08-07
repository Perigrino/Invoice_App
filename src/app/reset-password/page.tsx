import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password for your account">
      <Suspense fallback={<div className="h-24" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}

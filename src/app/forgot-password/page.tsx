import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/invoices");

  return (
    <AuthShell title="Forgot your password?" subtitle="We'll email you a link to reset it">
      <ForgotPasswordForm />
    </AuthShell>
  );
}

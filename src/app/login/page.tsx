import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/invoices");

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your InvoiceFlow account">
      <LoginForm />
    </AuthShell>
  );
}

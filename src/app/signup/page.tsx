import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export default async function SignupPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/invoices");

  return (
    <AuthShell title="Create your account" subtitle="Start invoicing in minutes">
      <SignupForm />
    </AuthShell>
  );
}

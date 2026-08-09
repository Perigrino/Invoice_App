import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { revokeTokens, verifyToken } from "@/lib/tokens";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResendVerificationButton } from "@/components/auth/verify-email-resend";
import { VerifyEmailTracker } from "@/components/auth/verify-email-tracker";
import { Button } from "@/components/ui/button";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token, email } = await searchParams;
  const valid =
    !!token && !!email && (await verifyToken(email.toLowerCase(), token));

  if (valid) {
    await prisma.user.updateMany({
      where: { email: email.toLowerCase(), emailVerified: null },
      data: { emailVerified: new Date() },
    });
    await revokeTokens(email.toLowerCase());
  }

  return (
    <AuthShell
      title={valid ? "Email confirmed" : "Couldn't confirm your email"}
      subtitle={
        valid
          ? "Your account is ready. Sign in to get started."
          : "This link is invalid or has expired."
      }
    >
      {valid ? (
        <div className="space-y-4">
          <VerifyEmailTracker valid={valid} />
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <Button asChild className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <XCircle className="mx-auto h-12 w-12 text-red-400" />
          <ResendVerificationButton email={email ?? ""} />
        </div>
      )}
    </AuthShell>
  );
}

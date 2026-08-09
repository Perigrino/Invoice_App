import { Resend } from "resend";
import { render } from "@react-email/render";
import { PasswordResetEmail } from "@/components/emails/password-reset-email";
import { VerificationEmail } from "@/components/emails/verification-email";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

async function sendEmail(
  to: string,
  subject: string,
  react: React.ReactElement
): Promise<void> {
  if (!resend) {
    throw new Error("RESEND_API_KEY is not set.");
  }
  const html = await render(react);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "InvoiceFlow <noreply@mail.invoiceflow.app>",
    to,
    subject,
    html,
  });
  if (error) throw new Error(error.message);
}

export function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  return sendEmail(
    to,
    "Reset your InvoiceFlow password",
    <PasswordResetEmail resetUrl={resetUrl} />
  );
}

export function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  return sendEmail(
    to,
    "Confirm your InvoiceFlow email",
    <VerificationEmail verifyUrl={verifyUrl} />
  );
}

import { render } from "@react-email/render";
import { PasswordResetEmail } from "@/components/emails/password-reset-email";
import { VerificationEmail } from "@/components/emails/verification-email";

const DEADSIMPLE_API_KEY = process.env.DEADSIMPLE_API_KEY;
const DEADSIMPLE_INBOX_ID = process.env.DEADSIMPLE_INBOX_ID;

const DEADSIMPLE_API_URL = "https://api.deadsimple.email";

function requireConfig() {
  if (!DEADSIMPLE_API_KEY) {
    throw new Error("DEADSIMPLE_API_KEY must be set.");
  }
  if (!DEADSIMPLE_INBOX_ID) {
    throw new Error("DEADSIMPLE_INBOX_ID must be set.");
  }
}

function foldLines(html: string): string {
  const folded = html.replace(/></g, ">\n<");
  if (process.env.NODE_ENV !== "production") {
    for (const line of folded.split("\n")) {
      if (line.length > 998) {
        console.warn(
          `[email] rendered line exceeds RFC 5322 998-char limit (${line.length} chars).`
        );
      }
    }
  }
  return folded;
}

async function sendEmail(
  to: string,
  subject: string,
  react: React.ReactElement
): Promise<void> {
  requireConfig();
  const [html, text] = await Promise.all([
    render(react).then(foldLines),
    render(react, { plainText: true }),
  ]);

  const res = await fetch(
    `${DEADSIMPLE_API_URL}/v1/inboxes/${DEADSIMPLE_INBOX_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEADSIMPLE_API_KEY}`,
      },
      body: JSON.stringify({
        to,
        subject,
        html_body: html,
        text_body: text,
      }),
    }
  );

  if (!res.ok) {
    let message = `Dead Simple API error (${res.status})`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) message += `: ${body.error.message}`;
    } catch {
      // non-JSON error body — keep the status-only message
    }
    throw new Error(message);
  }
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

import { NextResponse } from "next/server";
import { findSharedInvoice, renderSharedInvoicePdf } from "@/lib/share-invoice";
import { consume } from "@/lib/rate-limit";

/**
 * PDF rendering is the expensive half of a share link, so it is capped per
 * token. Not cached: a link can be revoked, and a cached PDF would keep being
 * served after the revocation.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const invoice = await findSharedInvoice(token);
  if (!invoice) {
    return new NextResponse("This link is no longer available.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const perToken = await consume(`share:pdf:token:${invoice.id}`, 30, 60);
  if (!perToken.allowed) {
    return new NextResponse("Too many requests.", {
      status: 429,
      headers: { "Retry-After": String(perToken.retryAfterSeconds), "Cache-Control": "no-store" },
    });
  }

  try {
    const buffer = await renderSharedInvoicePdf(invoice);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Shared PDF render failed:", error);
    return new NextResponse("Could not render this invoice.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

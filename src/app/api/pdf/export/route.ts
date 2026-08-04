import { NextResponse } from "next/server";
import { assemblePdfData } from "@/lib/pdf/assemble";
import { generateInvoicePdfBuffer } from "@/lib/pdf/generate-pdf";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const invoice = body?.invoice;
    if (
      !invoice ||
      typeof invoice.invoiceNumber !== "string" ||
      typeof invoice.clientName !== "string" ||
      !Array.isArray(invoice.lineItems)
    ) {
      return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
    }

    const buffer = await generateInvoicePdfBuffer(assemblePdfData(body));

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF export failed:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}

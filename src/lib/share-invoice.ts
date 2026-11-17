import type { Invoice, InvoiceLineItem, Client, Setting, Company } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fromCents } from "@/lib/money";
import { assemblePdfData, type PdfExportPayload } from "@/lib/pdf/assemble";
import { generateInvoicePdfBuffer } from "@/lib/pdf/generate-pdf";
import { isShareToken } from "@/lib/share";

export type SharedInvoice = Invoice & {
  lineItems: InvoiceLineItem[];
  client: Client | null;
  workspace: { company: Company | null; settings: Setting | null };
};

/**
 * Looks up a shared invoice by token. A revoked link has no token and an
 * expired one fails the date check, so both simply stop resolving — there is
 * no separate check at read time.
 */
export async function findSharedInvoice(token: string): Promise<SharedInvoice | null> {
  if (!isShareToken(token)) return null;
  return prisma.invoice.findFirst({
    where: {
      shareToken: token,
      OR: [{ shareExpiresAt: null }, { shareExpiresAt: { gt: new Date() } }],
    },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      client: true,
      workspace: { include: { company: true, settings: true } },
    },
  });
}

export function sharedPdfPayload(invoice: SharedInvoice): PdfExportPayload {
  const { settings, company } = invoice.workspace;
  return {
    invoice: {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate?.toISOString() ?? null,
      invoiceType: invoice.invoiceType,
      clientName: invoice.client?.fullName ?? "",
      clientEmail: invoice.client?.email ?? undefined,
      clientPhone: invoice.client?.phone ?? undefined,
      clientAddress: invoice.client?.address ?? undefined,
      lineItems: invoice.lineItems.map((line) => ({
        description: line.description,
        price: fromCents(line.priceCents),
        quantity: line.quantity,
      })),
      subtotal: fromCents(invoice.subtotalCents),
      discountAmount: fromCents(invoice.discountCents),
      taxAmount: fromCents(invoice.taxCents),
      total: fromCents(invoice.totalCents),
      notes: invoice.notes ?? undefined,
    },
    currency: settings?.currency,
    paperSize: settings?.paperSize,
    template: settings?.template,
    accentColor: settings?.pdfAccentColor,
    secondaryColor: settings?.pdfSecondaryColor,
    settingsNotes: settings?.notes || undefined,
    logo: settings?.logo || company?.logo || undefined,
    company: company
      ? {
          name: company.name ?? undefined,
          address: company.address ?? undefined,
          email: company.email ?? undefined,
          phone: company.phone ?? undefined,
        }
      : undefined,
  };
}

export async function renderSharedInvoicePdf(invoice: SharedInvoice): Promise<Uint8Array> {
  return generateInvoicePdfBuffer(assemblePdfData(sharedPdfPayload(invoice)));
}

/** Best-effort counter; a failed increment must never break the page. */
export async function recordShareView(invoiceId: string): Promise<void> {
  try {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { shareViews: { increment: 1 }, shareLastViewedAt: new Date() },
    });
  } catch {
    // Ignored: view counts are informational.
  }
}

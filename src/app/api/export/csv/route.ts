import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceId } from "@/lib/workspace";
import { fromCents } from "@/lib/money";

/**
 * One row per invoice, in the shape an accountant asks for: dates, client,
 * currency and the money columns. Cents are converted at the boundary so the
 * numbers here match what the invoice prints.
 */
const COLUMNS = [
  "Invoice",
  "Type",
  "Status",
  "Issued",
  "Due",
  "Client",
  "Currency",
  "Subtotal",
  "Discount",
  "Tax",
  "Total",
  "Balance due",
];

function cell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function isoDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export async function GET() {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }

  const [invoices, settings] = await Promise.all([
    prisma.invoice.findMany({
      where: { workspaceId },
      include: { client: true },
      orderBy: { issueDate: "desc" },
    }),
    prisma.setting.findUnique({ where: { workspaceId }, select: { currency: true } }),
  ]);

  const currency = settings?.currency ?? "GHS";
  const lines = [COLUMNS.join(",")];

  for (const invoice of invoices) {
    lines.push(
      [
        invoice.invoiceNumber,
        invoice.invoiceType,
        invoice.status,
        isoDate(invoice.issueDate),
        isoDate(invoice.dueDate),
        invoice.client?.fullName || invoice.client?.company || "",
        currency,
        fromCents(invoice.subtotalCents).toFixed(2),
        fromCents(invoice.discountCents).toFixed(2),
        fromCents(invoice.taxCents).toFixed(2),
        fromCents(invoice.totalCents).toFixed(2),
        fromCents(invoice.balanceDueCents).toFixed(2),
      ]
        .map(cell)
        .join(",")
    );
  }

  return new NextResponse(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

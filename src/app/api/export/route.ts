import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceId } from "@/lib/workspace";
import { serializeInvoice } from "@/lib/invoice-mapping";
import { EXPORT_VERSION } from "@/lib/exchange";

/**
 * Everything in the caller's workspace as one JSON file. Without accounts this
 * is the only way to keep a copy of the data, so it must stay complete.
 */
export async function GET() {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace unavailable" }, { status: 400 });
  }

  try {
    const [company, settings, clients, invoices] = await Promise.all([
      prisma.company.findUnique({ where: { workspaceId } }),
      prisma.setting.findUnique({ where: { workspaceId } }),
      prisma.client.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } }),
      prisma.invoice.findMany({
        where: { workspaceId },
        include: { client: true, lineItems: { orderBy: { sortOrder: "asc" } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const file = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      company: company ? strip(company, ["id", "workspaceId"]) : null,
      settings: settings ? strip(settings, ["id", "workspaceId"]) : null,
      clients: clients.map((client) => strip(client, ["id", "workspaceId", "createdAt", "updatedAt"])),
      invoices: invoices.map((invoice) => {
        const clientIndex = invoice.clientId
          ? clients.findIndex((client) => client.id === invoice.clientId)
          : -1;
        const { createdAt, updatedAt, client, lineItems, ...rest } = serializeInvoice(invoice);
        void createdAt;
        void updatedAt;
        void client;
        return {
          ...strip(rest, ["id", "workspaceId", "clientId"]),
          clientIndex: clientIndex >= 0 ? clientIndex : null,
          lineItems: lineItems.map((item) => strip(item, ["id", "invoiceId", "sortOrder"])),
        };
      }),
    };

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(file, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="invoiceflow-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}

function strip(record: Record<string, unknown>, keys: string[]) {
  const copy: Record<string, unknown> = { ...record };
  for (const key of keys) delete copy[key];
  return copy;
}

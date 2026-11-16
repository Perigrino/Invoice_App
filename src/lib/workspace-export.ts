import "server-only";
import { prisma } from "@/lib/prisma";
import {
  buildExportFile,
  toExportedClient,
  toExportedInvoice,
  type ExportFile,
} from "@/lib/exchange";

function strip(record: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...record };
  for (const key of keys) delete copy[key];
  return copy;
}

/**
 * Everything in the workspace in the export format: the download, and the
 * payload of every snapshot.
 */
export async function loadWorkspaceExport(workspaceId: string): Promise<ExportFile> {
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

  return buildExportFile({
    company: company ? strip(company, ["id", "workspaceId"]) : null,
    settings: settings ? strip(settings, ["id", "workspaceId"]) : null,
    clients: clients.map((client) => toExportedClient(client)),
    invoices: invoices.map((invoice) => toExportedInvoice(invoice, clients)),
  });
}

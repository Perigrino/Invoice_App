import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toCents } from "@/lib/money";
import { validateExportFile } from "@/lib/exchange";
import { loadWorkspaceExport } from "@/lib/workspace-export";
import { replaceWorkspace } from "@/lib/workspace-replace";

/** Enough to undo a bad day's work without letting backups pile up. */
export const MAX_SNAPSHOTS = 10;

export interface SnapshotCounts {
  clients: number;
  invoices: number;
  lineItems: number;
}

export interface SnapshotSummary {
  id: string;
  createdAt: string;
  counts: SnapshotCounts;
  sizeBytes: number;
  totalCents: number;
}

function summarize(snapshot: {
  id: string;
  createdAt: Date;
  counts: Prisma.JsonValue;
  sizeBytes: number;
  totalCents: number;
}): SnapshotSummary {
  return {
    id: snapshot.id,
    createdAt: snapshot.createdAt.toISOString(),
    counts: snapshot.counts as unknown as SnapshotCounts,
    sizeBytes: snapshot.sizeBytes,
    totalCents: snapshot.totalCents,
  };
}

export async function listSnapshots(workspaceId: string): Promise<SnapshotSummary[]> {
  const rows = await prisma.snapshot.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, counts: true, sizeBytes: true, totalCents: true },
  });
  return rows.map(summarize);
}

export async function createSnapshot(workspaceId: string): Promise<SnapshotSummary> {
  const file = await loadWorkspaceExport(workspaceId);
  const data = JSON.stringify(file);
  const counts: SnapshotCounts = {
    clients: file.clients.length,
    invoices: file.invoices.length,
    lineItems: file.invoices.reduce((sum, invoice) => sum + invoice.lineItems.length, 0),
  };

  const snapshot = await prisma.snapshot.create({
    data: {
      workspaceId,
      data,
      counts: counts as unknown as Prisma.InputJsonValue,
      sizeBytes: Buffer.byteLength(data),
      totalCents: file.invoices.reduce((sum, invoice) => sum + toCents(invoice.total), 0),
    },
    select: { id: true, createdAt: true, counts: true, sizeBytes: true, totalCents: true },
  });

  const stale = await prisma.snapshot.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    skip: MAX_SNAPSHOTS,
    select: { id: true },
  });
  if (stale.length) {
    await prisma.snapshot.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
  }

  return summarize(snapshot);
}

export async function deleteSnapshot(workspaceId: string, id: string): Promise<boolean> {
  const deleted = await prisma.snapshot.deleteMany({ where: { id, workspaceId } });
  return deleted.count === 1;
}

export interface SnapshotPreview {
  snapshot: { createdAt: string; counts: SnapshotCounts; totalCents: number };
  current: { invoices: number; clients: number };
  /** Invoices that exist now and are not in the snapshot: a restore removes them. */
  lostInvoices: string[];
  lostCount: number;
  /** Invoices the snapshot brings back that are not here now. */
  addedCount: number;
}

/**
 * What a restore would do, without doing it. Both sides are counted from the
 * same data a restore would read, so the preview cannot disagree with it.
 */
export async function previewSnapshot(
  workspaceId: string,
  id: string
): Promise<SnapshotPreview | null> {
  const snapshot = await prisma.snapshot.findFirst({
    where: { id, workspaceId },
    select: { data: true, createdAt: true, counts: true, totalCents: true },
  });
  if (!snapshot) return null;

  const parsed = validateExportFile(JSON.parse(snapshot.data));
  if (!parsed.ok) return null;

  const currentInvoices = await prisma.invoice.findMany({
    where: { workspaceId },
    select: { invoiceNumber: true },
  });
  const currentClients = await prisma.client.count({ where: { workspaceId } });

  const snapshotNumbers = new Set(parsed.file.invoices.map((invoice) => invoice.invoiceNumber));
  const currentNumbers = new Set(currentInvoices.map((invoice) => invoice.invoiceNumber));
  const lost = currentInvoices
    .map((invoice) => invoice.invoiceNumber)
    .filter((number) => !snapshotNumbers.has(number))
    .sort();
  const added = parsed.file.invoices.filter((invoice) => !currentNumbers.has(invoice.invoiceNumber));

  return {
    snapshot: {
      createdAt: snapshot.createdAt.toISOString(),
      counts: parsed.counts,
      totalCents: snapshot.totalCents,
    },
    current: { invoices: currentInvoices.length, clients: currentClients },
    lostInvoices: lost.slice(0, 10),
    lostCount: lost.length,
    addedCount: added.length,
  };
}

export async function restoreSnapshot(workspaceId: string, id: string): Promise<boolean> {
  const snapshot = await prisma.snapshot.findFirst({
    where: { id, workspaceId },
    select: { data: true },
  });
  if (!snapshot) return false;

  const parsed = validateExportFile(JSON.parse(snapshot.data));
  if (!parsed.ok) return false;

  await replaceWorkspace(workspaceId, parsed.file);
  return true;
}

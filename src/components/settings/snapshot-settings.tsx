"use client";

import { useEffect, useState } from "react";
import { Archive, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Counts {
  clients: number;
  invoices: number;
  lineItems: number;
}

interface Snapshot {
  id: string;
  createdAt: string;
  counts: Counts;
  sizeBytes: number;
  totalCents: number;
}

interface Preview {
  snapshot: { createdAt: string; counts: Counts; totalCents: number };
  current: { invoices: number; clients: number };
  lostInvoices: string[];
  lostCount: number;
  addedCount: number;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function describe(counts: Counts): string {
  return `${plural(counts.invoices, "invoice")} · ${plural(counts.clients, "client")}`;
}

function bytes(size: number): string {
  return size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`;
}

/**
 * Backups are the undo for import and restore: both replace the workspace, so
 * there has to be a way to take a copy first and a way to put it back.
 */
export function SnapshotSettings() {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [previewOf, setPreviewOf] = useState<Snapshot | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/snapshots", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { snapshots: Snapshot[] }) => {
        if (active) setSnapshots(body.snapshots);
      })
      .catch(() => {
        if (active) setError("Could not load your backups.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function backUpNow() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/snapshots", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? String(res.status));
      setSnapshots((current) => [body.snapshot as Snapshot, ...(current ?? [])]);
    } catch {
      setError("Could not create a backup.");
    } finally {
      setBusy(false);
    }
  }

  async function openPreview(snapshot: Snapshot) {
    setPreviewOf(snapshot);
    setPreview(null);
    setPreviewError(null);
    try {
      const res = await fetch(`/api/snapshots/${snapshot.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setPreview(await res.json());
    } catch {
      setPreviewError("Could not read this backup.");
    }
  }

  async function restore() {
    if (!previewOf) return;
    setRestoring(true);
    setPreviewError(null);
    try {
      const res = await fetch(`/api/snapshots/${previewOf.id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? String(res.status));
      }
      window.location.reload();
    } catch {
      setPreviewError("Restore failed. Nothing was changed.");
      setRestoring(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/snapshots/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      setSnapshots((current) => (current ?? []).filter((snapshot) => snapshot.id !== id));
    } catch {
      setError("Could not delete that backup.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          A backup is a full copy of this workspace, kept so an import or a restore can be
          undone. The newest ten are kept.
        </p>
        <Button type="button" variant="outline" disabled={busy} onClick={backUpNow}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
          Back up now
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {snapshots === null && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading backups…</p>
      )}

      {snapshots?.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          No backups yet. Take one before importing a file or restoring.
        </p>
      )}

      {snapshots && snapshots.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {snapshots.map((snapshot) => (
            <li key={snapshot.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {when(snapshot.createdAt)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {describe(snapshot.counts)} · {bytes(snapshot.sizeBytes)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant="outline" onClick={() => openPreview(snapshot)}>
                  <RotateCcw className="mr-1 h-4 w-4" /> Restore
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete backup from ${when(snapshot.createdAt)}`}
                  className="text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  onClick={() => remove(snapshot.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={previewOf !== null} onOpenChange={(open) => { if (!open) setPreviewOf(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Restore this backup?</DialogTitle>
            <DialogDescription>
              {previewOf ? `Taken ${when(previewOf.createdAt)}.` : ""} This replaces everything
              currently in the workspace — the same operation as an import.
            </DialogDescription>
          </DialogHeader>

          {!preview && !previewError && (
            <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Comparing…
            </div>
          )}

          {preview && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-900">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Invoices</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {preview.current.invoices} → {preview.snapshot.counts.invoices}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Clients</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {preview.current.clients} → {preview.snapshot.counts.clients}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Line items</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {preview.snapshot.counts.lineItems}
                  </p>
                </div>
              </div>

              {preview.lostCount > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                  <p className="font-medium">
                    {plural(preview.lostCount, "invoice")} here now are not in this backup and
                    will be removed:
                  </p>
                  <p className="mt-1 break-words text-xs">
                    {preview.lostInvoices.join(", ")}
                    {preview.lostCount > preview.lostInvoices.length
                      ? ` and ${preview.lostCount - preview.lostInvoices.length} more`
                      : ""}
                  </p>
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-300">
                  Every invoice in the workspace is in this backup, so nothing is lost.
                </p>
              )}

              {preview.addedCount > 0 && (
                <p className="text-gray-500 dark:text-gray-400">
                  {plural(preview.addedCount, "invoice")} from the backup will reappear.
                </p>
              )}
            </div>
          )}

          {previewError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {previewError}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setPreviewOf(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={restore} disabled={!preview || restoring}>
              {restoring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {restoring ? "Restoring…" : "Restore backup"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

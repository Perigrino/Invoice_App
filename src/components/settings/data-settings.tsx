"use client";

import { useRef, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceRecoveryCard } from "@/components/settings/recovery";
import { SnapshotSettings } from "@/components/settings/snapshot-settings";

interface Counts {
  clients: number;
  invoices: number;
  lineItems: number;
}

function describe(counts: Counts): string {
  return `${counts.invoices} invoice${counts.invoices === 1 ? "" : "s"}, ${counts.clients} client${
    counts.clients === 1 ? "" : "s"
  }`;
}

/**
 * Export and import. There are no accounts, so this file is the only copy of
 * the data a user can keep — and the only way to move a workspace to another
 * browser.
 */
export function DataSettings() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmKey, setConfirmKey] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete this workspace and everything in it? Your invoices, clients and settings are removed for good. There is no account to restore them from."
      )
    ) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/workspace", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: confirmKey }),
      });
      if (res.ok) {
        window.location.assign("/");
        return;
      }
      const body = await res.json().catch(() => ({}));
      setDeleteError(body.error || "Could not delete this workspace.");
    } catch {
      setDeleteError("Could not delete this workspace. Check your connection.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleImport(file: File) {
    setBusy(true);
    setError(null);
    setStatus("Checking the file…");

    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        setError("That file is not valid JSON.");
        setStatus(null);
        return;
      }

      const check = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: parsed, dryRun: true }),
      });
      const checkBody = await check.json();

      if (!check.ok) {
        const issues: string[] = Array.isArray(checkBody.issues) ? checkBody.issues : [];
        setError(
          issues.length
            ? issues.slice(0, 5).join(" · ")
            : checkBody.error || "That file could not be imported."
        );
        setStatus(null);
        return;
      }

      const counts = checkBody.counts as Counts;
      const confirmed = window.confirm(
        `Replace this workspace with ${describe(counts)}?\n\nEverything currently here is deleted. Export first if you want to keep it.`
      );
      if (!confirmed) {
        setStatus("Import cancelled. Nothing was changed.");
        return;
      }

      const applied = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: parsed, confirm: true }),
      });
      if (!applied.ok) {
        const body = await applied.json().catch(() => ({}));
        setError(body.error || "Import failed.");
        setStatus(null);
        return;
      }

      setStatus("Imported. Reloading…");
      window.location.reload();
    } catch {
      setError("Import failed. Nothing was changed.");
      setStatus(null);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recover this workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkspaceRecoveryCard />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backups</CardTitle>
        </CardHeader>
        <CardContent>
          <SnapshotSettings />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Download everything in this workspace — clients, invoices, settings and
            company details — as one JSON file. The CSV is the invoice list on its own,
            for an accountant.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => window.location.assign("/api/export")}>
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
            <Button type="button" variant="outline" onClick={() => window.location.assign("/api/export/csv")}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Importing replaces this workspace with the contents of the file. Use it to
            restore a backup or move a workspace to another browser.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {busy ? "Working…" : "Choose a JSON file"}
          </Button>

          {status && <p className="text-sm text-gray-500 dark:text-gray-400">{status}</p>}
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-red-200 dark:border-red-900/60">
        <CardHeader>
          <CardTitle className="text-base text-red-700 dark:text-red-400">Delete workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Removes everything in this workspace — invoices, clients, settings and backups —
            and cannot be undone. Type your recovery key to confirm.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="delete-confirm-key" className="sr-only">
              Recovery key
            </label>
            <input
              id="delete-confirm-key"
              value={confirmKey}
              onChange={(event) => {
                setConfirmKey(event.target.value);
                if (deleteError) setDeleteError(null);
              }}
              placeholder="K7QM-3XPD-9TZR-4HWV-8NB2"
              autoComplete="off"
              spellCheck={false}
              className="h-10 flex-1 rounded-lg border border-gray-200 bg-white px-3 font-mono text-sm tracking-wider text-gray-900 outline-none placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/30 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-600"
            />
            <Button
              type="button"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
              onClick={handleDelete}
              disabled={deleting || !confirmKey.trim()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleting ? "Deleting…" : "Delete workspace"}
            </Button>
          </div>
          {deleteError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {deleteError}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

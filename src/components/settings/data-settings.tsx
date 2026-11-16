"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceRecoveryCard } from "@/components/settings/recovery";

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
          <CardTitle className="text-base">Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Download everything in this workspace — clients, invoices, settings and
            company details — as one JSON file.
          </p>
          <Button type="button" variant="outline" onClick={() => window.location.assign("/api/export")}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
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
    </div>
  );
}

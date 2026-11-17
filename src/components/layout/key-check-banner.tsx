"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notifyWriteFailure } from "@/store/toast-store";

/**
 * A quiet reminder, shown once a workspace has invoices and has not confirmed
 * its key for a while. Losing the key is losing everything, so the app has to
 * ask at least occasionally whether the person still has it.
 */
export function KeyCheckBanner() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/workspace", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { needsKeyCheck?: boolean } | null) => {
        if (active && body?.needsKeyCheck) setVisible(true);
      })
      .catch(() => {
        // The reminder is optional; a failed read just means no reminder.
      });
    return () => {
      active = false;
    };
  }, []);

  if (!visible) return null;

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/workspace/verify", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      setVisible(false);
    } catch (error) {
      notifyWriteFailure("Could not record that just now.", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <KeyRound className="h-4 w-4 shrink-0" />
      <p className="flex-1">
        Do you still have your recovery key? It is the only way back into these
        invoices.
      </p>
      <Link
        href="/settings"
        className="rounded px-2 py-1 text-xs font-medium underline underline-offset-2 hover:bg-amber-100 dark:hover:bg-amber-900/40"
      >
        View key
      </Link>
      <Button type="button" size="sm" variant="outline" onClick={confirm} disabled={busy}>
        {busy ? "Saving…" : "I still have it"}
      </Button>
    </div>
  );
}

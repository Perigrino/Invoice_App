"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorkspaceRecoveryInfo {
  recoveryKey: string;
  url: string;
}

function useRecoveryInfo() {
  const [info, setInfo] = useState<WorkspaceRecoveryInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/workspace", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: WorkspaceRecoveryInfo) => {
        if (active) setInfo(body);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return { info, failed };
}

/**
 * Dismissal lives in localStorage, per workspace. Read through
 * `useSyncExternalStore` so the server and first client render agree and no
 * state is set from an effect.
 */
const dismissalListeners = new Set<() => void>();

function notifyDismissal() {
  for (const listener of dismissalListeners) listener();
}

function useDismissed(recoveryKey: string | null): boolean {
  const storageKey = recoveryKey ? `invoiceflow_recovery_seen:${recoveryKey}` : "";
  const subscribe = useCallback((onChange: () => void) => {
    dismissalListeners.add(onChange);
    window.addEventListener("storage", onChange);
    return () => {
      dismissalListeners.delete(onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const getSnapshot = useCallback(() => {
    if (!storageKey) return true;
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return true;
    }
  }, [storageKey]);
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

function dismiss(recoveryKey: string) {
  try {
    window.localStorage.setItem(`invoiceflow_recovery_seen:${recoveryKey}`, "1");
  } catch {
    // Private mode: the banner simply comes back next time.
  }
  notifyDismissal();
}

function useCopy() {
  const [copied, setCopied] = useState<"key" | "link" | null>(null);
  const copy = useCallback(async (text: string, which: "key" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard access can be denied; the text stays selectable on screen.
    }
  }, []);
  return { copied, copy };
}

/**
 * Shown above the invoice list until dismissed: the one moment a new workspace
 * needs its key, right after the first save. Dismissal is per workspace, so a
 * recovered or new workspace shows it again.
 */
export function RecoveryBanner() {
  const { info } = useRecoveryInfo();
  const { copied, copy } = useCopy();
  const dismissed = useDismissed(info?.recoveryKey ?? null);

  if (!info || dismissed) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/40">
      <div className="flex flex-wrap items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Save your recovery key
          </p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            There are no accounts. This key is the only way back to your invoices if
            you clear cookies or switch browsers.
          </p>
          <p className="mt-2 select-all font-mono text-base tracking-wider text-amber-900 dark:text-amber-100">
            {info.recoveryKey}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => copy(info.recoveryKey, "key")}>
            {copied === "key" ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
            {copied === "key" ? "Copied" : "Copy key"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => dismiss(info.recoveryKey)}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The permanent version, in Settings → Data: the key and a bookmarkable link
 * that adopts this workspace in any other browser.
 */
export function WorkspaceRecoveryCard() {
  const { info, failed } = useRecoveryInfo();
  const { copied, copy } = useCopy();

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Recovery key</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Keep this somewhere safe. Anyone with the key or the link below can open this
          workspace, so treat it like a password.
        </p>
      </div>

      {failed && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Could not load the recovery key.
        </p>
      )}

      {info && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <code className="select-all rounded-lg bg-gray-100 px-3 py-2 font-mono text-base tracking-wider text-gray-900 dark:bg-gray-800 dark:text-gray-100">
              {info.recoveryKey}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={() => copy(info.recoveryKey, "key")}>
              {copied === "key" ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
              {copied === "key" ? "Copied" : "Copy key"}
            </Button>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Bookmark this link</p>
            <p className="break-all text-sm text-gray-500 dark:text-gray-400">{info.url}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => copy(info.url, "link")}>
              {copied === "link" ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
              {copied === "link" ? "Copied" : "Copy link"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

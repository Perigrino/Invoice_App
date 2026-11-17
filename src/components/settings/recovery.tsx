"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RECOVERY_PENDING_EVENT,
  clearRecoveryPending,
  isRecoveryPending,
  isRecoverySeen,
  markRecoverySeen,
} from "@/lib/recovery-notice";
import { Check, Copy, Download, KeyRound, RefreshCw } from "lucide-react";
import { downloadRecoveryCard } from "@/lib/recovery-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface WorkspaceRecoveryInfo {
  recoveryKey: string;
  url: string;
}

async function fetchRecoveryInfo(): Promise<WorkspaceRecoveryInfo> {
  const res = await fetch("/api/workspace", { cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

function useRecoveryInfo() {
  const [info, setInfo] = useState<WorkspaceRecoveryInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchRecoveryInfo()
      .then((body) => {
        if (active) setInfo(body);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return { info, failed, setInfo };
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
 * Shown once, immediately after the first saved invoice, and it does not go
 * away until the key has been copied or explicitly acknowledged. Dismissal is
 * per workspace, so a recovered workspace asks again.
 */
export function RecoveryKeyGate() {
  const [info, setInfo] = useState<WorkspaceRecoveryInfo | null>(null);
  const [open, setOpen] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      if (!isRecoveryPending()) return;
      fetchRecoveryInfo()
        .then((body) => {
          if (cancelled) return;
          if (isRecoverySeen(body.recoveryKey)) {
            clearRecoveryPending();
            return;
          }
          setInfo(body);
          setOpen(true);
        })
        .catch(() => {
          // Retried on the next save; never blocks the app.
        });
    };

    check();
    window.addEventListener(RECOVERY_PENDING_EVENT, check);
    return () => {
      cancelled = true;
      window.removeEventListener(RECOVERY_PENDING_EVENT, check);
    };
  }, []);

  const acknowledge = () => {
    if (info) markRecoverySeen(info.recoveryKey);
    setOpen(false);
    // Dismissal must not depend on the exit animation finishing: this dialog
    // blocks the page, and a throttled or hidden tab never fires animationend,
    // which would leave it rendered over an unusable app.
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => setInfo(null), 300);
  };

  const copy = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.recoveryKey);
      acknowledge();
    } catch {
      // Clipboard denied: the key stays on screen and "I've saved it" is the way out.
    }
  };

  if (!info) return null;

  return (
    <Dialog open={open} onOpenChange={() => { /* acknowledged only */ }}>
      <DialogContent
        className="sm:max-w-md [&>button.absolute]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Save your recovery key
          </DialogTitle>
          <DialogDescription>
            Your invoice is saved. There are no accounts, so this key is the only way
            back to your invoices if you clear cookies or switch browsers.
          </DialogDescription>
        </DialogHeader>

        <p className="select-all rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center font-mono text-lg tracking-wider text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
          {info?.recoveryKey ?? "…"}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={copy} disabled={!info}>
            <Copy className="mr-2 h-4 w-4" />
            Copy key
          </Button>
          <Button type="button" onClick={acknowledge} disabled={!info}>
            I&rsquo;ve saved it
          </Button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          You can find it again in Settings → Data.
        </p>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The permanent version, in Settings → Data: the key and a bookmarkable link
 * that adopts this workspace in any other browser.
 */
export function WorkspaceRecoveryCard() {
  const { info, failed, setInfo } = useRecoveryInfo();
  const { copied, copy } = useCopy();
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const rotate = async () => {
    setRotating(true);
    setRotateError(null);
    try {
      const res = await fetch("/api/workspace/rotate", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      setInfo(await res.json());
      setRotateOpen(false);
      setStatus("New key created. The old key no longer opens this workspace.");
    } catch {
      setRotateError("Could not create a new key. Your current key still works.");
    } finally {
      setRotating(false);
    }
  };

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

      {status && <p className="text-sm text-emerald-700 dark:text-emerald-400">{status}</p>}

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

          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
            <Button type="button" size="sm" variant="outline" onClick={() => downloadRecoveryCard(info)}>
              <Download className="mr-1 h-4 w-4" />
              Download card
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setRotateError(null);
                setRotateOpen(true);
              }}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              New key
            </Button>
          </div>
        </>
      )}

      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Replace your recovery key?</DialogTitle>
            <DialogDescription>
              A new key is generated and the current one stops working immediately. Useful if
              the old key was seen by someone else — the trade is that every place you saved it
              needs updating.
            </DialogDescription>
          </DialogHeader>
          {rotateError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{rotateError}</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setRotateOpen(false)} disabled={rotating}>
              Keep the current key
            </Button>
            <Button type="button" onClick={rotate} disabled={rotating}>
              {rotating ? "Creating…" : "Create a new key"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

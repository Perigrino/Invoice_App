"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Link2, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShareState {
  shared: boolean;
  url: string | null;
  createdAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  views: number;
  lastViewedAt: string | null;
}

const EXPIRY_OPTIONS = [
  { value: "", label: "No expiry" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
];

function ExpiryChoice({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
      Link expires
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm dark:border-gray-800 dark:bg-gray-950"
      >
        {EXPIRY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function daysAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) {
    if (diff < 60_000) return "just now";
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 60) return minutes === 1 ? "a minute ago" : `${minutes} minutes ago`;
    const hours = Math.floor(diff / 3_600_000);
    return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  }
  return days === 1 ? "a day ago" : `${days} days ago`;
}

/** Which expiry choice a link created with that many days left came from. */
function expiryChoice(expiresAt: string | null): string {
  if (!expiresAt) return "";
  const daysLeft = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000;
  const match = EXPIRY_OPTIONS.filter((option) => option.value !== "").find(
    (option) => Math.abs(Number(option.value) - daysLeft) < 1
  );
  return match?.value ?? "";
}

export function ShareDialog({
  invoiceId,
  invoiceNumber,
  open,
  onOpenChange,
}: {
  invoiceId: string | null;
  invoiceNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<ShareState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [days, setDays] = useState("");

  // The parent remounts this dialog per invoice (`key`), so there is no stale
  // state to clear here; the fetch itself decides what to show. State is only
  // touched from the promise callback, never synchronously during the effect.
  useEffect(() => {
    if (!open || !invoiceId) return;
    let cancelled = false;
    fetch(`/api/invoices/${invoiceId}/share`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: ShareState) => {
        if (cancelled) return;
        setState(body);
        setDays(expiryChoice(body.expiresAt));
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this invoice's link.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, invoiceId]);

  const mutate = async (method: "POST" | "DELETE") => {
    if (!invoiceId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/share`, {
        method,
        ...(method === "POST"
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ days: days === "" ? null : Number(days) }),
            }
          : {}),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState(await res.json());
      setCopied(false);
    } catch {
      setError(method === "POST" ? "Could not create a link." : "Could not revoke the link.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!state?.url) return;
    try {
      await navigator.clipboard.writeText(state.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard blocked — select the link and copy it manually.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share {invoiceNumber}</DialogTitle>
          <DialogDescription>
            A read-only page with the invoice and its PDF. No account needed — anyone
            with the link can open it, so only send it to your client.
          </DialogDescription>
        </DialogHeader>

        {!state && !error && (
          <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {state?.shared && state.url && (
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
                <Link2 className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
                  {state.url}
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={copy} aria-label="Copy link">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {state.views === 0
                  ? "Not opened yet."
                  : `Opened ${state.views} ${state.views === 1 ? "time" : "times"}, last ${daysAgo(state.lastViewedAt)}.`}
                {state.expiresAt
                  ? ` Expires ${new Date(state.expiresAt).toLocaleDateString()}.`
                  : " No expiry."}
              </p>
            </div>

            <ExpiryChoice value={days} onChange={setDays} />

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={state.url} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="mr-1 h-4 w-4" /> Open
                </a>
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => mutate("POST")} disabled={busy}>
                <RefreshCw className="mr-1 h-4 w-4" /> New link
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                onClick={() => mutate("DELETE")}
                disabled={busy}
              >
                <X className="mr-1 h-4 w-4" /> Revoke
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              &ldquo;New link&rdquo; replaces this one — the old link stops working immediately.
            </p>
          </div>
        )}

        {state && !state.shared && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {state.revokedAt
                ? `This invoice was shared until ${new Date(state.revokedAt).toLocaleDateString()}. Create a new link to send it again.`
                : "This invoice is not shared yet."}
            </p>
            <ExpiryChoice value={days} onChange={setDays} />
            <Button type="button" onClick={() => mutate("POST")} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Link2 className="mr-1 h-4 w-4" />}
              Create share link
            </Button>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { exportInvoicePdf, type PdfExportParams } from "@/lib/pdf/export-invoice";
import { Loader2 } from "lucide-react";

const PAPER_ASPECT: Record<string, string> = {
  A4: "210 / 297",
  A3: "297 / 420",
  LETTER: "8.5 / 11",
  LEGAL: "8.5 / 14",
};

const FADE_MS = 300;
const LOAD_FALLBACK_MS = 1200;

function paperAspect(paperSize?: string): string {
  return PAPER_ASPECT[(paperSize || "A3").toUpperCase()] || "210 / 297";
}

interface LivePdfPreviewProps {
  params: PdfExportParams;
  debounceMs?: number;
}

export function LivePdfPreview({ params, debounceMs = 400 }: LivePdfPreviewProps) {
  const [current, setCurrent] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [pendingReady, setPendingReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlsRef = useRef<Set<string>>(new Set());
  const currentRef = useRef<string | null>(null);
  const pendingRef = useRef<string | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  const revoke = useCallback((url: string | null | undefined) => {
    if (url && urlsRef.current.delete(url)) URL.revokeObjectURL(url);
  }, []);

  const showNext = useCallback(
    (next: string) => {
      urlsRef.current.add(next);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
      if (!currentRef.current) {
        currentRef.current = next;
        setCurrent(next);
        return;
      }
      const prev = pendingRef.current;
      pendingRef.current = next;
      if (prev) revoke(prev);
      setPending(next);
      setPendingReady(false);
      fadeTimerRef.current = window.setTimeout(() => setPendingReady(true), LOAD_FALLBACK_MS);
    },
    [revoke]
  );

  const paramKey = useMemo(() => JSON.stringify(params), [params]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setError(null);
      setLoading(true);
      try {
        const buffer = await exportInvoicePdf(params);
        if (cancelled) return;
        const blob = new Blob([buffer.slice()], { type: "application/pdf" });
        const next = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(next);
          return;
        }
        showNext(next);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to generate PDF");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey, debounceMs]);

  const handlePendingLoad = useCallback(() => {
    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    setPendingReady(true);
  }, []);

  useEffect(() => {
    if (!pendingReady || !pendingRef.current) return;
    const timer = window.setTimeout(() => {
      const prev = currentRef.current;
      const next = pendingRef.current;
      currentRef.current = next;
      pendingRef.current = null;
      setCurrent(next);
      setPending(null);
      revoke(prev);
    }, FADE_MS);
    return () => window.clearTimeout(timer);
  }, [pendingReady, revoke]);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current.clear();
    };
  }, []);

  const aspect = paperAspect(params.paperSize);

  return (
    <div className="relative mx-auto w-full">
      <div
        className="w-full overflow-hidden rounded-sm bg-white shadow-xl ring-1 ring-black/5 dark:shadow-black/40"
        style={{ aspectRatio: aspect }}
      >
        {current ? (
          <>
            <object
              data={current}
              type="application/pdf"
              aria-label="Invoice PDF preview"
              className="absolute inset-0 h-full w-full"
              style={{
                opacity: pending && pendingReady ? 0 : 1,
                transition: `opacity ${FADE_MS}ms ease`,
              }}
            />
            {pending && (
              <object
                data={pending}
                type="application/pdf"
                onLoad={handlePendingLoad}
                className="absolute inset-0 h-full w-full"
                style={{
                  opacity: pendingReady ? 1 : 0,
                  transition: `opacity ${FADE_MS}ms ease`,
                }}
              />
            )}
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-sm text-gray-400">
            {error ? (
              <p className="max-w-[80%] text-center text-red-500">{error}</p>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                <span>Generating preview…</span>
              </>
            )}
          </div>
        )}
      </div>
      {loading && current && !error && (
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs text-gray-500 shadow-sm ring-1 ring-black/5 backdrop-blur">
          <Loader2 className="h-3 w-3 animate-spin" />
          Updating…
        </div>
      )}
    </div>
  );
}

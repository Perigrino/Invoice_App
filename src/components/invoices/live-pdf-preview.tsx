"use client";

import { useEffect, useMemo, useState } from "react";
import { exportInvoicePdf, type PdfExportParams } from "@/lib/pdf/export-invoice";
import { cachedPdf, pdfParamsKey, rememberPdf } from "@/lib/pdf/preview-cache";
import { Loader2 } from "lucide-react";
import { PdfPages } from "./pdf-pages";

const PAPER_ASPECT: Record<string, string> = {
  A4: "210 / 297",
  A3: "297 / 420",
  LETTER: "8.5 / 11",
  LEGAL: "8.5 / 14",
};

function paperAspect(paperSize?: string): string {
  return PAPER_ASPECT[(paperSize || "A3").toUpperCase()] || "210 / 297";
}

/** A finished render, together with the params it was drawn from. */
interface Drawn {
  key: string;
  bytes: Uint8Array;
}

interface LivePdfPreviewProps {
  params: PdfExportParams;
  debounceMs?: number;
}

export function LivePdfPreview({ params, debounceMs = 400 }: LivePdfPreviewProps) {
  const paramKey = useMemo(() => pdfParamsKey(params), [params]);
  const [drawn, setDrawn] = useState<Drawn | null>(() => {
    const hit = cachedPdf(paramKey);
    return hit ? { key: paramKey, bytes: hit } : null;
  });
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);

  // A configuration already drawn this session swaps in immediately: React
  // re-runs this render before painting, so there is no spinner frame and no
  // request. The bytes stay on screen until the next render is ready.
  if (drawn?.key !== paramKey) {
    const remembered = cachedPdf(paramKey);
    if (remembered) setDrawn({ key: paramKey, bytes: remembered });
  }

  const pending = drawn?.key !== paramKey;
  const error = failure?.key === paramKey ? failure.message : null;

  useEffect(() => {
    if (cachedPdf(paramKey)) return;

    // A newer parameter set must not be overwritten by an older, slower render.
    const controller = new AbortController();
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const buffer = await exportInvoicePdf(params, controller.signal);
        if (cancelled) return;
        rememberPdf(paramKey, buffer);
        setFailure(null);
        setDrawn({ key: paramKey, bytes: buffer });
      } catch (cause) {
        const aborted = cause instanceof DOMException && cause.name === "AbortError";
        if (cancelled || aborted) return;
        setFailure({ key: paramKey, message: cause instanceof Error ? cause.message : "Failed to generate PDF" });
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey, debounceMs]);

  return (
    <div className="relative mx-auto w-full">
      {drawn ? (
        <PdfPages data={drawn.bytes} />
      ) : (
        <div
          className="flex w-full flex-col items-center justify-center gap-2 rounded-sm bg-white p-6 text-sm text-gray-400 shadow-xl ring-1 ring-black/5 dark:shadow-black/40"
          style={{ aspectRatio: paperAspect(params.paperSize) }}
        >
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
      {pending && drawn && !error && (
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs text-gray-500 shadow-sm ring-1 ring-black/5 backdrop-blur">
          <Loader2 className="h-3 w-3 animate-spin" />
          Updating…
        </div>
      )}
      {error && drawn && (
        <p role="alert" className="mt-2 text-center text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

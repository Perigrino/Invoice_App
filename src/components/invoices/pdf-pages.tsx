"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

/**
 * The browser's own PDF viewer is a plugin Chromium builds other than Chrome
 * do not ship — Electron and several mobile browsers show nothing at all for
 * `<object type="application/pdf">`. These are the same bytes the download
 * button saves; only the way they are painted differs.
 *
 * Pages are drawn at a fixed logical width and scaled down by CSS. Measuring
 * the container instead would feed back on itself: a taller canvas can add a
 * scrollbar, which narrows the container, which asks for another render.
 */
const LOGICAL_WIDTH = 900;

export function PdfPages({
  data,
  onFirstRender,
  className,
}: {
  data: Uint8Array;
  onFirstRender?: () => void;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;

    const draw = async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      doc = await pdfjs.getDocument({
        // pdf.js takes ownership of the buffer it is given.
        data: data.slice(),
        useSystemFonts: true,
        isEvalSupported: false,
      }).promise;
      if (cancelled || !doc) return;

      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const pages: HTMLCanvasElement[] = [];
      for (let number = 1; number <= doc.numPages; number += 1) {
        const page = await doc.getPage(number);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (LOGICAL_WIDTH / base.width) * ratio });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.className = "block h-auto w-full rounded-sm bg-white shadow-sm ring-1 ring-black/5";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `Invoice page ${number} of ${doc.numPages}`);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("This browser cannot draw the preview.");
        await page.render({ canvasContext: context, viewport }).promise;
        if (cancelled) return;
        pages.push(canvas);
      }

      if (cancelled) return;
      // Swap in one step so the previous render stays visible until this one
      // is complete.
      host.replaceChildren(...pages);
      setError(null);
      onFirstRender?.();
    };

    draw().catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not draw the preview.");
    });

    return () => {
      cancelled = true;
      // A destroy during an in-flight render rejects; it is expected here.
      const destroyed = doc?.destroy();
      if (destroyed) void destroyed.catch(() => {});
    };
  }, [data, onFirstRender]);

  return (
    <div className={className}>
      <div ref={hostRef} data-pdf-pages className="space-y-3" />
      {error && (
        <p role="alert" className="px-4 py-3 text-center text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

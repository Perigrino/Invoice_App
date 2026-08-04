"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_TEMPLATE_CONFIGS, getDefaultTemplateConfig } from "@/lib/templates/presets";
import type { TemplateConfig } from "@/lib/templates/types";
import type { PreviewInvoiceData, PreviewProps } from "./preview/types";
import { px } from "./preview/types";
import { PreviewModern } from "./preview/preview-modern";
import { PreviewBusiness } from "./preview/preview-business";
import { PreviewMinimal } from "./preview/preview-minimal";
import { PreviewProfessional } from "./preview/preview-professional";
import { PreviewElegant } from "./preview/preview-elegant";

const PAGE_W_PX = 210 * 3.7795;
const PAGE_H_PX = 297 * 3.7795;

export function PreviewPage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.55);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(2, el.clientWidth / PAGE_W_PX));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full">
      <div
        style={{
          width: PAGE_W_PX,
          height: PAGE_H_PX,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          overflow: "hidden",
          background: "#ffffff",
          color: "#111827",
        }}
      >
        {children}
      </div>
      <div style={{ height: PAGE_H_PX * scale }} aria-hidden />
    </div>
  );
}

const PREVIEW_COMPONENTS: Record<
  TemplateConfig["base"],
  (props: PreviewProps) => ReactNode
> = {
  modern: PreviewModern,
  business: PreviewBusiness,
  minimal: PreviewMinimal,
  professional: PreviewProfessional,
  elegant: PreviewElegant,
};

export function InvoicePdfPreview({
  data,
  config,
}: {
  data: PreviewInvoiceData;
  config?: TemplateConfig;
}) {
  const resolved = config ? config : getDefaultTemplateConfig("modern");
  const { base } = resolved;
  const Comp = (PREVIEW_COMPONENTS[base] ||
    PREVIEW_COMPONENTS.modern) as (props: PreviewProps) => ReactNode;

  return (
    <PreviewPage>
      <Comp data={data} config={resolved} />
    </PreviewPage>
  );
}

export const TEMPLATE_NAME: Record<TemplateConfig["base"], string> = {
  modern: "Modern",
  business: "Business",
  minimal: "Minimal",
  professional: "Professional",
  elegant: "Elegant",
};

export { DEFAULT_TEMPLATE_CONFIGS };
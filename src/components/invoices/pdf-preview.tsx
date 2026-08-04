"use client";

import { mergeTemplateConfig } from "@/lib/templates/presets";
import type { TemplateType } from "@/types";
import type { PreviewInvoiceData } from "./template-editor/preview/types";
import { PreviewModern } from "./template-editor/preview/preview-modern";
import { PreviewBusiness } from "./template-editor/preview/preview-business";
import { PreviewMinimal } from "./template-editor/preview/preview-minimal";
import { PreviewProfessional } from "./template-editor/preview/preview-professional";
import { PreviewElegant } from "./template-editor/preview/preview-elegant";

const COMPONENT_MAP: Record<TemplateType, React.ComponentType<{ data: PreviewInvoiceData; config: ReturnType<typeof mergeTemplateConfig> }>> = {
  modern: PreviewModern,
  business: PreviewBusiness,
  minimal: PreviewMinimal,
  professional: PreviewProfessional,
  elegant: PreviewElegant,
};

interface InvoicePdfPreviewProps {
  data: PreviewInvoiceData;
  template: TemplateType;
  className?: string;
}

export function InvoicePdfPreview({ data, template, className }: InvoicePdfPreviewProps) {
  const config = mergeTemplateConfig({ base: template });
  const Preview = COMPONENT_MAP[template] || COMPONENT_MAP.modern;

  return (
    <div className={className}>
      <Preview data={data} config={config} />
    </div>
  );
}

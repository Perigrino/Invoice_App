import type { TemplateConfig, TemplateFont, TemplateSpacing } from "./types";
import type { TemplateType } from "@/types";

export const TEMPLATE_ORDER: TemplateType[] = [
  "modern",
  "business",
  "minimal",
  "professional",
  "elegant",
];

function baseConfig(
  base: TemplateType,
  accentColor: string,
  secondaryColor: string,
  font: TemplateFont,
  spacing: TemplateSpacing = "normal"
): TemplateConfig {
  return {
    base,
    accentColor,
    secondaryColor,
    font,
    fontSize: 12,
    spacing,
    components: {
      logo: true,
      companyName: true,
      companyContact: true,
      clientBlock: true,
      metadata: true,
      priceColumn: true,
      qtyColumn: true,
      subtotal: true,
      discount: true,
      total: true,
      notes: true,
      signature: false,
      footer: false,
    },
    styles: {
      tableHeaderFill: true,
      zebraRows: true,
      totalsFill: true,
      title: "INVOICE",
    },
  };
}

export const DEFAULT_TEMPLATE_CONFIGS: Record<TemplateType, TemplateConfig> = {
  // Current default design: colored header, zebra rows, colored total bar.
  modern: baseConfig("modern", "#00BCD4", "#059669", "courier"),

  // Corporate letterhead: strong navy accent, no fills, underline rules.
  business: {
    ...baseConfig("business", "#1E40AF", "#047857", "sans"),
    styles: {
      tableHeaderFill: false,
      zebraRows: true,
      totalsFill: true,
      title: "INVOICE",
    },
  },

  // Quiet, minimal: no fills, hairline dividers only, neutral slate.
  minimal: {
    ...baseConfig("minimal", "#334155", "#475569", "sans"),
    styles: {
      tableHeaderFill: false,
      zebraRows: false,
      totalsFill: false,
      title: "INVOICE",
    },
  },

  // Formal structured: sidebar accent, filled header, boxed totals.
  professional: baseConfig("professional", "#4F46E5", "#0F766E", "sans"),

  // Elegant: serif, relaxed spacing, centered ornament, no filled header.
  elegant: {
    ...baseConfig("elegant", "#92400E", "#78350F", "serif", "relaxed"),
    styles: {
      tableHeaderFill: false,
      zebraRows: false,
      totalsFill: true,
      title: "INVOICE",
    },
  },
};

export function getDefaultTemplateConfig(base: TemplateType = "modern"): TemplateConfig {
  const preset = DEFAULT_TEMPLATE_CONFIGS[base] || DEFAULT_TEMPLATE_CONFIGS.modern;
  return JSON.parse(JSON.stringify(preset)) as TemplateConfig;
}

export function mergeTemplateConfig(
  config: Partial<TemplateConfig> | undefined | null,
  base: TemplateType = "modern"
): TemplateConfig {
  const preset = getDefaultTemplateConfig(config?.base || base);
  if (!config) return preset;
  return {
    ...preset,
    ...config,
    base: config.base || preset.base,
    components: { ...preset.components, ...(config.components || {}) },
    styles: { ...preset.styles, ...(config.styles || {}) },
  };
}
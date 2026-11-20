import type { TemplateConfig, TemplateSpacing } from "./types";
import type { TemplateType } from "@/types";

/**
 * The two designs the Mac app ships (PDFTemplate.swift), and the only two the
 * web app offers.
 */
export const TEMPLATE_ORDER: TemplateType[] = ["dark", "light"];

export const TEMPLATE_LABELS: Record<TemplateType, string> = {
  dark: "Dark",
  light: "Light",
};

/**
 * The five designs this app used before it adopted the Mac app's two. Settings
 * rows and saved invoices still carry these names, so anything stored under one
 * lands on Light — every retired design had a light page.
 */
const LEGACY_TEMPLATES: Record<string, TemplateType> = {
  modern: "light",
  business: "light",
  minimal: "light",
  professional: "light",
  elegant: "light",
};

export function normalizeTemplate(value?: string | null): TemplateType {
  if (value === "dark" || value === "light") return value;
  return (value && LEGACY_TEMPLATES[value]) || "light";
}

function baseConfig(
  base: TemplateType,
  accentColor: string,
  secondaryColor: string,
  spacing: TemplateSpacing = "normal"
): TemplateConfig {
  return {
    base,
    accentColor,
    secondaryColor,
    // Menlo 9 on the Mac; Courier at 9pt is its closest base-14 match.
    font: "courier",
    fontSize: 9,
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
      footer: true,
    },
    styles: {
      tableHeaderFill: true,
      zebraRows: false,
      totalsFill: false,
      // Empty means the document names itself from the invoice type.
      title: "",
      logoSize: "medium",
    },
  };
}

export const DEFAULT_TEMPLATE_CONFIGS: Record<TemplateType, TemplateConfig> = {
  // Near-black page, dim body text, bright values — PDFGenerator's DarkTheme.
  dark: baseConfig("dark", "#60A5FA", "#059669"),

  // Warm white page, dark body text — PDFGenerator's LightTheme.
  light: baseConfig("light", "#60A5FA", "#059669"),
};

export function getDefaultTemplateConfig(base: string = "light"): TemplateConfig {
  const preset = DEFAULT_TEMPLATE_CONFIGS[normalizeTemplate(base)];
  return JSON.parse(JSON.stringify(preset)) as TemplateConfig;
}

export function mergeTemplateConfig(
  config: Partial<TemplateConfig> | undefined | null,
  base: string = "light"
): TemplateConfig {
  const preset = getDefaultTemplateConfig(config?.base || base);
  if (!config) return preset;
  return {
    ...preset,
    ...config,
    base: normalizeTemplate(config.base || preset.base),
    components: { ...preset.components, ...(config.components || {}) },
    styles: { ...preset.styles, ...(config.styles || {}) },
  };
}

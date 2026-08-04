import type { TemplateType } from "@/types";

export type TemplateFont = "courier" | "sans" | "serif";

export type TemplateSpacing = "compact" | "normal" | "relaxed";

export interface TemplateComponents {
  logo: boolean;
  companyName: boolean;
  companyContact: boolean;
  clientBlock: boolean;
  metadata: boolean;
  priceColumn: boolean;
  qtyColumn: boolean;
  subtotal: boolean;
  discount: boolean;
  total: boolean;
  notes: boolean;
  signature: boolean;
  footer: boolean;
}

export interface TemplateStyles {
  tableHeaderFill: boolean;
  zebraRows: boolean;
  totalsFill: boolean;
  title: string;
}

export interface TemplateConfig {
  base: TemplateType;
  accentColor: string;
  secondaryColor: string;
  font: TemplateFont;
  fontSize: number;
  spacing: TemplateSpacing;
  components: TemplateComponents;
  styles: TemplateStyles;
}

export type TemplateConfigKey = keyof TemplateConfig;
export type TemplateComponentsKey = keyof TemplateComponents;
export type TemplateStylesKey = keyof TemplateStyles;

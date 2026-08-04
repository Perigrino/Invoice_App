import type { TemplateComponentsKey, TemplateFont, TemplateSpacing } from "./types";

export interface ComponentOption {
  key: TemplateComponentsKey;
  label: string;
}

export const COMPONENT_OPTIONS: ComponentOption[] = [
  { key: "logo", label: "Company logo" },
  { key: "companyName", label: "Company name" },
  { key: "companyContact", label: "Company contact" },
  { key: "clientBlock", label: "Client details" },
  { key: "metadata", label: "Invoice number & dates" },
  { key: "priceColumn", label: "Price column" },
  { key: "qtyColumn", label: "Quantity column" },
  { key: "subtotal", label: "Subtotal" },
  { key: "discount", label: "Discount" },
  { key: "total", label: "Total" },
  { key: "notes", label: "Notes" },
  { key: "signature", label: "Signature line" },
  { key: "footer", label: "Footer" },
];

export const FONT_OPTIONS: { value: TemplateFont; label: string }[] = [
  { value: "courier", label: "Courier (monospace)" },
  { value: "sans", label: "Helvetica (sans-serif)" },
  { value: "serif", label: "Times (serif)" },
];

export const SPACING_OPTIONS: { value: TemplateSpacing; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "relaxed", label: "Relaxed" },
];

export const PREDEFINED_COLORS = [
  "#00BCD4",
  "#059669",
  "#1E40AF",
  "#4F46E5",
  "#7C3AED",
  "#DB2777",
  "#EA580C",
  "#92400E",
  "#334155",
  "#0F172A",
];
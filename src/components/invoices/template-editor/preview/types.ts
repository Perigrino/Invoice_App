import type { TemplateConfig } from "@/lib/templates/types";

export interface PreviewLineItem {
  description: string;
  price: number;
  quantity: number;
  total: number;
}

export interface PreviewInvoiceData {
  invoiceNumber: string;
  invoiceType?: string;
  issueDate: string;
  dueDate: string;
  clientName: string;
  clientAddress?: string;
  clientEmail?: string;
  clientPhone?: string;
  companyName: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  logo?: string;
  lineItems: PreviewLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  notes?: string;
  currency: string;
}

export interface PreviewProps {
  data: PreviewInvoiceData;
  config: TemplateConfig;
}

export function formatMoney(amount: number, currency = "GHS") {
  const formatted = Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${formatted} ${currency}`;
}

export function fontFamily(config: TemplateConfig) {
  if (config.font === "serif") return "Georgia, 'Times New Roman', Times, serif";
  if (config.font === "sans") return "Helvetica, Arial, sans-serif";
  return "'Courier New', Courier, monospace";
}

export function px(mm: number) {
  return `${(mm * 3.7795).toFixed(2)}px`;
}

export function pt(value: number) {
  return `${value}pt`;
}

export function mixWhite(hex: string, ratio: number): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return mixWhite("#00BCD4", ratio);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mr = Math.round(r + (255 - r) * ratio);
  const mg = Math.round(g + (255 - g) * ratio);
  const mb = Math.round(b + (255 - b) * ratio);
  return `rgb(${mr}, ${mg}, ${mb})`;
}

import type { TemplateConfig } from "@/lib/templates/types";

export interface PDFLineItem {
  description: string;
  price: number;
  quantity: number;
  total: number;
}

export interface PDFData {
  invoiceNumber: string;
  invoiceType: string;
  paperSize: string;
  issueDate: string;
  dueDate: string;
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress: string;
  lineItems: PDFLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  notes?: string;
  currency?: string;
  logo?: string;
  templateConfig?: TemplateConfig;
}

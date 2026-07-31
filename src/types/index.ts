export type InvoiceStatus =
  | "draft"
  | "pending"
  | "paid"
  | "overdue"
  | "cancelled";

export type InvoiceType = "invoice" | "proforma";

export type CurrencyCode =
  | "USD"
  | "EUR"
  | "GBP"
  | "GHS"
  | "CAD"
  | "NGN"
  | "ZAR";

export type SeparatorType = "comma" | "dot" | "space";

export type SignPlacement = "before" | "after";

export type DateFormat =
  | "MM/DD/YYYY"
  | "DD/MM/YYYY"
  | "YYYY-MM-DD"
  | "MMMM DD, YYYY";

export type PaperSize = "A4" | "A3" | "Letter" | "Legal";

export type TemplateType =
  | "business"
  | "modern"
  | "minimal"
  | "professional"
  | "elegant";

export type SoundOption = "default" | "chime" | "bell" | "silent";

export type Language = "en" | "fr" | "es" | "ar";

export interface LineItem {
  id: string;
  description: string;
  price: number;
  quantity: number;
}

export interface InvoiceFormData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date | undefined;
  status: InvoiceStatus;
  invoiceType: InvoiceType;
  clientId: string;
  lineItems: LineItem[];
  notes: string;
  discount: number;
}

export interface ClientFormData {
  fullName: string;
  company: string;
  email: string;
  phone: string;
  address: string;
}

export interface CompanySettings {
  fullName: string;
  name: string;
  logo: string;
  address: string;
  email: string;
  phone: string;
  website: string;
}

export interface AppSettings {
  logo: string;
  notes: string;
  currency: CurrencyCode;
  separator: SeparatorType;
  decimalPlaces: number;
  signPlacement: SignPlacement;
  dateFormat: DateFormat;
  pdfDirectory: string;
  template: TemplateType;
  paperSize: PaperSize;
  pdfAccentColor: string;
  pdfSecondaryColor: string;
  showInvoiceId: boolean;
  showDueDate: boolean;
  showCurrency: boolean;
  showDiscount: boolean;
  showNote: boolean;
  language: Language;
  sound: SoundOption;
  openPdfAfterExport: boolean;
  autoSave: boolean;
  darkMode: boolean;
}

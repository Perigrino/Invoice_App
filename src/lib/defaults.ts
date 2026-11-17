import type { AppSettings, CompanySettings } from "@/types";

/**
 * What a new workspace starts with. These used to live only in the client
 * stores, which meant the server knew nothing about a workspace until someone
 * opened Settings — so PDFs, share pages and exports had to guess (and
 * guessed USD). Now the same values are written when the workspace row is
 * created, and the stores read them for their initial state.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  logo: "",
  notes: "",
  currency: "GHS",
  separator: "comma",
  decimalPlaces: 2,
  signPlacement: "before",
  dateFormat: "MM/DD/YYYY",
  pdfDirectory: "/exports",
  template: "modern",
  paperSize: "A3",
  pdfAccentColor: "#00BCD4",
  pdfSecondaryColor: "#059669",
  showInvoiceId: true,
  showDueDate: true,
  showCurrency: true,
  showDiscount: true,
  showNote: true,
  language: "en",
  sound: "default",
  openPdfAfterExport: true,
  autoSave: true,
  darkMode: false,
};

export const DEFAULT_COMPANY: CompanySettings = {
  fullName: "",
  name: "",
  logo: "",
  address: "",
  email: "",
  phone: "",
  website: "",
};

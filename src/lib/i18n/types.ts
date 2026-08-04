export interface Translations {
  // Nav
  invoices: string;
  clients: string;
  settings: string;
  // Invoice form
  createInvoice: string;
  editDraft: string;
  createNewInvoice: string;
  updateAndSaveDraft: string;
  invoiceDetails: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  invoiceType: string;
  invoice: string;
  proformaInvoice: string;
  client: string;
  selectClient: string;
  noResultsFound: string;
  productsServices: string;
  addItem: string;
  description: string;
  price: string;
  qty: string;
  total: string;
  notes: string;
  notesPlaceholder: string;
  // Summary
  summary: string;
  subtotal: string;
  balanceDue: string;
  // Sidebar
  pdfTemplate: string;
  saveInvoice: string;
  saveChanges: string;
  previewExportPdf: string;
  livePreview: string;
  // Invoice list
  manageInvoices: string;
  searchInvoices: string;
  newInvoice: string;
  amount: string;
  issued: string;
  due: string;
  duplicate: string;
  exportPdf: string;
  viewPdf: string;
  delete: string;
  noInvoicesYet: string;
  createFirstInvoice: string;
  createInvoiceBtn: string;
  // Settings
  sound: string;
  language: string;
  preferences: string;
  autoSave: string;
  autoSaveDesc: string;
  darkMode: string;
  darkModeDesc: string;
  // PDF preview
  pdfPreview: string;
  previewBeforeDownload: string;
  close: string;
  downloadPdf: string;
  generating: string;
  // Notes prompt
  useDefaultNote: string;
  addNoteExport: string;
  addNoteToExport: string;
  addNoteToExportDesc: string;
  setDefaultNote: string;
  notNow: string;
  useNoteAndExport: string;
  addNote: string;
  // Errors
  cannotExportYet: string;
  selectClientError: string;
  addLineItemError: string;
  addNoteError: string;
  selectClientToContinue: string;
  pleaseAddNote: string;
}

export type Locale = "en" | "fr" | "es" | "ar";

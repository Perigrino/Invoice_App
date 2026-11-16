/**
 * The JSON interchange format for a whole workspace: what "download my data"
 * produces and what an import accepts. Pure data — no Prisma, no cookies — so
 * the rules can be tested directly.
 *
 * Money is written in decimal currency units (the same shape the API returns),
 * with cents recovered exactly by `toCents` on import.
 */

import { toCents } from "@/lib/money";

export const EXPORT_VERSION = 1;

/** Guards against a file that is small enough to upload but huge once expanded. */
const MAX_CLIENTS = 5_000;
const MAX_INVOICES = 20_000;
const MAX_LINE_ITEMS = 500;

export interface ExportedLineItem {
  description: string;
  price: number;
  quantity: number;
  discount: number;
  tax: number;
  total: number;
}

export interface ExportedInvoice {
  invoiceNumber: string;
  invoiceType: string;
  /** Position in `clients`, so a round trip keeps the link without ids. */
  clientIndex: number | null;
  status: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  balanceDue: number;
  notes: string | null;
  issueDate: string;
  dueDate: string | null;
  lineItems: ExportedLineItem[];
}

export interface ExportedClient {
  fullName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
}

export interface ExportFile {
  version: number;
  exportedAt: string;
  company: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  clients: ExportedClient[];
  invoices: ExportedInvoice[];
}

export interface ExportCounts {
  clients: number;
  invoices: number;
  lineItems: number;
}

export type Validation =
  | { ok: true; file: ExportFile; counts: ExportCounts }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function num(value: unknown, fallback = 0): number {
  // `Number(null)` and `Number("")` are 0, which would silently turn a missing
  // quantity into zero rather than the documented default.
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function date(value: unknown, fallback: string | null): string | null {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

/** Only columns the schema has: an unknown key would fail the insert. */
const SETTING_KEYS = [
  "currency", "separator", "decimalPlaces", "signPlacement", "dateFormat",
  "pdfDirectory", "template", "paperSize", "pdfAccentColor", "pdfSecondaryColor",
  "logo", "notes", "showInvoiceId", "showDueDate", "showCurrency", "showDiscount",
  "showTax", "showNote", "language", "sound", "muteNotifications",
  "openPdfAfterExport", "autoSave", "darkMode",
] as const;

const COMPANY_KEYS = ["name", "logo", "address", "email", "phone", "website", "taxId"] as const;

function pick(source: Record<string, unknown> | null, keys: readonly string[]) {
  if (!source) return null;
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) picked[key] = value;
  }
  return picked;
}

/**
 * Validates an uploaded file and returns the normalised version. Problems are
 * reported as a list rather than throwing on the first one, so the UI can show
 * everything that is wrong with a hand-edited file.
 */
export function validateExportFile(raw: unknown): Validation {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ["File is not a JSON object"] };

  if (raw.version !== EXPORT_VERSION) {
    return {
      ok: false,
      errors: [`Unsupported version ${String(raw.version)} (expected ${EXPORT_VERSION})`],
    };
  }

  if (!Array.isArray(raw.clients)) errors.push("`clients` must be an array");
  if (!Array.isArray(raw.invoices)) errors.push("`invoices` must be an array");
  if (errors.length) return { ok: false, errors };

  const rawClients = raw.clients as unknown[];
  const rawInvoices = raw.invoices as unknown[];

  if (rawClients.length > MAX_CLIENTS) errors.push(`Too many clients (max ${MAX_CLIENTS})`);
  if (rawInvoices.length > MAX_INVOICES) errors.push(`Too many invoices (max ${MAX_INVOICES})`);

  const clients: ExportedClient[] = [];
  rawClients.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`clients[${index}] is not an object`);
      return;
    }
    if (!str(entry.fullName)?.trim()) errors.push(`clients[${index}].fullName is required`);
    clients.push({
      fullName: str(entry.fullName)?.trim() ?? "",
      company: str(entry.company),
      email: str(entry.email),
      phone: str(entry.phone),
      address: str(entry.address),
      taxId: str(entry.taxId),
    });
  });

  let lineItemCount = 0;
  const invoices: ExportedInvoice[] = [];
  rawInvoices.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`invoices[${index}] is not an object`);
      return;
    }
    if (!str(entry.invoiceNumber)?.trim()) {
      errors.push(`invoices[${index}].invoiceNumber is required`);
    }
    const rawItems = Array.isArray(entry.lineItems) ? entry.lineItems : [];
    if (rawItems.length > MAX_LINE_ITEMS) {
      errors.push(`invoices[${index}] has more than ${MAX_LINE_ITEMS} line items`);
    }

    const lineItems: ExportedLineItem[] = rawItems
      .filter(isRecord)
      .map((item) => ({
        description: str(item.description) ?? "",
        price: num(item.price),
        quantity: num(item.quantity, 1),
        discount: num(item.discount),
        tax: num(item.tax),
        total: num(item.total),
      }));
    lineItemCount += lineItems.length;

    invoices.push({
      invoiceNumber: str(entry.invoiceNumber)?.trim() ?? "",
      invoiceType: str(entry.invoiceType) ?? "invoice",
      clientIndex:
        typeof entry.clientIndex === "number" && Number.isInteger(entry.clientIndex)
          ? entry.clientIndex
          : null,
      status: str(entry.status) ?? "draft",
      subtotal: num(entry.subtotal),
      discount: num(entry.discount),
      tax: num(entry.tax),
      total: num(entry.total),
      balanceDue: num(entry.balanceDue),
      notes: str(entry.notes),
      issueDate: date(entry.issueDate, new Date().toISOString())!,
      dueDate: date(entry.dueDate, null),
      lineItems,
    });
  });

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    file: {
      version: EXPORT_VERSION,
      exportedAt: str(raw.exportedAt) ?? new Date().toISOString(),
      company: pick(isRecord(raw.company) ? raw.company : null, COMPANY_KEYS),
      settings: pick(isRecord(raw.settings) ? raw.settings : null, SETTING_KEYS),
      clients,
      invoices,
    },
    counts: { clients: clients.length, invoices: invoices.length, lineItems: lineItemCount },
  };
}

/** Cents for a line price, so an import cannot drift by a rounding step. */
export function priceCents(price: number): number {
  return toCents(price);
}

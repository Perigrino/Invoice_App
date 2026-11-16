import type { SavedClient } from "@/store/client-store";
import type { SavedInvoice } from "@/store/invoice-store";
import type { AppSettings, CompanySettings, LineItem } from "@/types";

/**
 * A failed write. Reads treat a failure as "no data"; writes must not, because
 * a write that silently did nothing looks exactly like success to the user.
 */
export class ApiError extends Error {
  constructor(readonly status: number) {
    super(messageFor(status));
    this.name = "ApiError";
  }
}

function messageFor(status: number): string {
  if (status === 403) return "The request was blocked. Reload the page and try again.";
  if (status === 404) return "It no longer exists on the server.";
  if (status === 413) return "That is too large for the server to accept.";
  if (status === 429) return "Too many changes at once. Wait a moment and try again.";
  if (status >= 500) return "The server could not save that. Nothing was changed.";
  return `The server rejected that (${status}).`;
}

/** One sentence a user can act on, whatever went wrong. */
export function describeWriteError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Could not reach the server. Check your connection — nothing was saved.";
}

export async function fetchApi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) throw new ApiError(res.status);
  return (await res.json()) as T;
}

interface RawLineItem {
  id: string;
  description: string;
  price: number;
  quantity: number;
}

interface RawClient {
  id: string;
  fullName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
}

interface RawInvoice {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  clientId: string | null;
  client: Pick<RawClient, "fullName" | "company"> | null;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  balanceDue: number;
  notes: string | null;
  issueDate: string;
  dueDate: string | null;
  lineItems: RawLineItem[];
  createdAt: string;
}

export function mapClient(raw: RawClient): SavedClient {
  return {
    id: raw.id,
    fullName: raw.fullName || "",
    company: raw.company || "",
    email: raw.email || "",
    phone: raw.phone || "",
    address: raw.address || "",
    createdAt: raw.createdAt,
  };
}

export function mapInvoice(raw: RawInvoice): SavedInvoice {
  return {
    id: raw.id,
    invoiceNumber: raw.invoiceNumber,
    clientId: raw.clientId || "",
    clientName: raw.client?.fullName || raw.client?.company || "",
    status: raw.status as SavedInvoice["status"],
    invoiceType: raw.invoiceType as SavedInvoice["invoiceType"],
    subtotal: raw.subtotal,
    discount: raw.discount,
    total: raw.total,
    balanceDue: raw.balanceDue,
    notes: raw.notes || "",
    issueDate: raw.issueDate,
    dueDate: raw.dueDate,
    lineItems: raw.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      price: item.price,
      quantity: item.quantity,
    })) as LineItem[],
    createdAt: raw.createdAt,
  };
}

/* Reads: a failure means "nothing to show", which the stores already handle. */

export async function fetchClients(): Promise<SavedClient[] | null> {
  try {
    return (await fetchApi<RawClient[]>("/api/clients")).map(mapClient);
  } catch (error) {
    console.error("Could not load clients:", error);
    return null;
  }
}

export async function fetchInvoices(): Promise<SavedInvoice[] | null> {
  try {
    return (await fetchApi<RawInvoice[]>("/api/invoices")).map(mapInvoice);
  } catch (error) {
    console.error("Could not load invoices:", error);
    return null;
  }
}

export async function fetchSettings(): Promise<Partial<AppSettings> | null> {
  try {
    return await fetchApi<Partial<AppSettings>>("/api/settings");
  } catch (error) {
    console.error("Could not load settings:", error);
    return null;
  }
}

export async function fetchCompany(): Promise<CompanySettings | null> {
  try {
    return await fetchApi<CompanySettings>("/api/company");
  } catch (error) {
    console.error("Could not load company:", error);
    return null;
  }
}

/* Writes: every one throws, so a caller cannot mistake failure for success. */

export async function createClient(client: SavedClient): Promise<void> {
  await fetchApi<{ id: string }>("/api/clients", {
    method: "POST",
    body: JSON.stringify(client),
  });
}

export async function updateClient(id: string, client: Partial<SavedClient>): Promise<void> {
  await fetchApi<{ id: string }>(`/api/clients/${id}`, {
    method: "PUT",
    body: JSON.stringify(client),
  });
}

export async function deleteClient(id: string): Promise<void> {
  await fetchApi<{ success: boolean }>(`/api/clients/${id}`, { method: "DELETE" });
}

/**
 * The server assigns the invoice number and recomputes totals, so the saved
 * record is returned and used to correct the optimistic local copy.
 */
export async function createInvoice(invoice: SavedInvoice): Promise<SavedInvoice> {
  return mapInvoice(
    await fetchApi<RawInvoice>("/api/invoices", {
      method: "POST",
      body: JSON.stringify(invoice),
    })
  );
}

export async function updateInvoice(id: string, invoice: SavedInvoice): Promise<SavedInvoice> {
  return mapInvoice(
    await fetchApi<RawInvoice>(`/api/invoices/${id}`, {
      method: "PUT",
      body: JSON.stringify(invoice),
    })
  );
}

export async function deleteInvoice(id: string): Promise<void> {
  await fetchApi<{ success: boolean }>(`/api/invoices/${id}`, { method: "DELETE" });
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  await fetchApi<{ id: string }>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export async function saveCompany(company: Partial<CompanySettings>): Promise<void> {
  await fetchApi<{ id: string }>("/api/company", {
    method: "PUT",
    body: JSON.stringify(company),
  });
}

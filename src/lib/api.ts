import type { SavedClient } from "@/store/client-store";
import type { SavedInvoice } from "@/store/invoice-store";
import type { AppSettings, CompanySettings, LineItem } from "@/types";

export async function fetchApi<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    if (!res.ok) {
      if (res.status === 401) return null;
      throw new Error(`Request failed: ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error("API request failed:", url, e);
    return null;
  }
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

export async function fetchClients(): Promise<SavedClient[]> {
  const data = await fetchApi<RawClient[]>("/api/clients");
  return (data || []).map(mapClient);
}

export async function createClient(client: SavedClient): Promise<boolean> {
  const res = await fetchApi<{ id: string }>("/api/clients", {
    method: "POST",
    body: JSON.stringify(client),
  });
  return Boolean(res);
}

export async function updateClient(id: string, client: Partial<SavedClient>): Promise<boolean> {
  const res = await fetchApi<{ id: string }>(`/api/clients/${id}`, {
    method: "PUT",
    body: JSON.stringify(client),
  });
  return Boolean(res);
}

export async function deleteClient(id: string): Promise<boolean> {
  const res = await fetchApi<{ success: boolean }>(`/api/clients/${id}`, {
    method: "DELETE",
  });
  return Boolean(res);
}

export async function fetchInvoices(): Promise<SavedInvoice[]> {
  const data = await fetchApi<RawInvoice[]>("/api/invoices");
  return (data || []).map(mapInvoice);
}

export async function createInvoice(invoice: SavedInvoice): Promise<boolean> {
  const res = await fetchApi<{ id: string }>("/api/invoices", {
    method: "POST",
    body: JSON.stringify(invoice),
  });
  return Boolean(res);
}

export async function updateInvoice(id: string, invoice: SavedInvoice): Promise<boolean> {
  const res = await fetchApi<{ id: string }>(`/api/invoices/${id}`, {
    method: "PUT",
    body: JSON.stringify(invoice),
  });
  return Boolean(res);
}

export async function deleteInvoice(id: string): Promise<boolean> {
  const res = await fetchApi<{ success: boolean }>(`/api/invoices/${id}`, {
    method: "DELETE",
  });
  return Boolean(res);
}

export async function fetchSettings(): Promise<Partial<AppSettings> | null> {
  return await fetchApi<Partial<AppSettings>>("/api/settings");
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<boolean> {
  const res = await fetchApi<{ id: string }>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  return Boolean(res);
}

export async function fetchCompany(): Promise<CompanySettings | null> {
  return await fetchApi<CompanySettings>("/api/company");
}

export async function saveCompany(company: Partial<CompanySettings>): Promise<boolean> {
  const res = await fetchApi<{ id: string }>("/api/company", {
    method: "PUT",
    body: JSON.stringify(company),
  });
  return Boolean(res);
}

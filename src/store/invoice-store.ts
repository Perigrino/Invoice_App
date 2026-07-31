import { create } from "zustand";
import type { InvoiceFormData, LineItem, InvoiceStatus, InvoiceType } from "@/types";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import {
  fetchInvoices,
  createInvoice as apiCreateInvoice,
  updateInvoice as apiUpdateInvoice,
  deleteInvoice as apiDeleteInvoice,
} from "@/lib/api";

export interface SavedInvoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  status: InvoiceStatus;
  invoiceType: InvoiceType;
  subtotal: number;
  discount: number;
  total: number;
  balanceDue: number;
  notes: string;
  issueDate: string;
  dueDate: string | null;
  lineItems: LineItem[];
  createdAt: string;
}

interface InvoiceState {
  invoices: SavedInvoice[];
  currentInvoice: InvoiceFormData | null;
  isDirty: boolean;
  _hydrated: boolean;
  hydrate: () => Promise<void>;
  saveInvoice: (data: InvoiceFormData, clientName: string) => SavedInvoice;
  updateInvoice: (id: string, data: InvoiceFormData, clientName: string) => SavedInvoice | null;
  deleteInvoice: (id: string) => void;
  duplicateInvoice: (id: string) => void;
  setCurrentInvoice: (invoice: InvoiceFormData | null) => void;
  addLineItem: (item: LineItem) => void;
  removeLineItem: (id: string) => void;
  updateLineItem: (id: string, data: Partial<LineItem>) => void;
  duplicateLineItem: (id: string) => void;
  reorderLineItems: (items: LineItem[]) => void;
  setDirty: (dirty: boolean) => void;
  reset: () => void;
}

function persist(invoices: SavedInvoice[]) {
  saveToStorage("invoices", invoices);
}

function uid() {
  return Math.random().toString(36).substring(2, 9);
}

export const useInvoiceStore = create<InvoiceState>((set, get) => ({
  invoices: [],
  currentInvoice: null,
  isDirty: false,
  _hydrated: false,

  hydrate: async () => {
    const local = loadFromStorage<SavedInvoice[]>("invoices", []);
    const remote = await fetchInvoices();
    const data = remote && remote.length > 0 ? remote : local;
    set({ invoices: data, _hydrated: true });
  },

  saveInvoice: (data, clientName) => {
    const saved: SavedInvoice = {
      id: uid(),
      invoiceNumber: data.invoiceNumber,
      clientId: data.clientId,
      clientName,
      status: data.status,
      invoiceType: data.invoiceType,
      subtotal: data.lineItems.reduce((s, i) => s + i.price * i.quantity, 0),
      discount: data.discount,
      total: data.lineItems.reduce((s, i) => s + i.price * i.quantity, 0),
      balanceDue: data.lineItems.reduce((s, i) => s + i.price * i.quantity, 0),
      notes: data.notes || "",
      issueDate: data.issueDate.toISOString(),
      dueDate: data.dueDate?.toISOString() || null,
      lineItems: data.lineItems,
      createdAt: new Date().toISOString(),
    };
    const updated = [saved, ...get().invoices];
    persist(updated);
    set({ invoices: updated, currentInvoice: null, isDirty: false });
    apiCreateInvoice(saved);
    return saved;
  },

  updateInvoice: (id, data, clientName) => {
    const existing = get().invoices.find((invoice) => invoice.id === id);
    if (!existing) return null;

    const subtotal = data.lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const updatedInvoice: SavedInvoice = {
      ...existing,
      invoiceNumber: data.invoiceNumber,
      clientId: data.clientId,
      clientName,
      status: data.status,
      invoiceType: data.invoiceType,
      subtotal,
      discount: data.discount,
      total: subtotal,
      balanceDue: subtotal,
      notes: data.notes || "",
      issueDate: data.issueDate.toISOString(),
      dueDate: data.dueDate?.toISOString() || null,
      lineItems: data.lineItems,
    };
    const updated = get().invoices.map((invoice) =>
      invoice.id === id ? updatedInvoice : invoice
    );
    persist(updated);
    set({ invoices: updated, currentInvoice: null, isDirty: false });
    apiUpdateInvoice(id, updatedInvoice);
    return updatedInvoice;
  },

  deleteInvoice: (id) => {
    const updated = get().invoices.filter((inv) => inv.id !== id);
    persist(updated);
    set({ invoices: updated });
    apiDeleteInvoice(id);
  },

  duplicateInvoice: (id) => {
    const target = get().invoices.find((inv) => inv.id === id);
    if (!target) return;
    const dup: SavedInvoice = {
      ...target,
      id: uid(),
      invoiceNumber: `${target.invoiceNumber}-copy`,
      createdAt: new Date().toISOString(),
    };
    const updated = [dup, ...get().invoices];
    persist(updated);
    set({ invoices: updated });
    apiCreateInvoice(dup);
  },

  setCurrentInvoice: (invoice) =>
    set({ currentInvoice: invoice, isDirty: false }),

  addLineItem: (item) =>
    set((state) => ({
      currentInvoice: state.currentInvoice
        ? { ...state.currentInvoice, lineItems: [...state.currentInvoice.lineItems, item] }
        : null,
      isDirty: true,
    })),

  removeLineItem: (id) =>
    set((state) => ({
      currentInvoice: state.currentInvoice
        ? { ...state.currentInvoice, lineItems: state.currentInvoice.lineItems.filter((i) => i.id !== id) }
        : null,
      isDirty: true,
    })),

  updateLineItem: (id, data) =>
    set((state) => ({
      currentInvoice: state.currentInvoice
        ? { ...state.currentInvoice, lineItems: state.currentInvoice.lineItems.map((i) => (i.id === id ? { ...i, ...data } : i)) }
        : null,
      isDirty: true,
    })),

  duplicateLineItem: (id) =>
    set((state) => {
      if (!state.currentInvoice) return {};
      const item = state.currentInvoice.lineItems.find((i) => i.id === id);
      if (!item) return {};
      return {
        currentInvoice: {
          ...state.currentInvoice,
          lineItems: [...state.currentInvoice.lineItems, { ...item, id: uid() }],
        },
        isDirty: true,
      };
    }),

  reorderLineItems: (items) =>
    set((state) => ({
      currentInvoice: state.currentInvoice ? { ...state.currentInvoice, lineItems: items } : null,
      isDirty: true,
    })),

  setDirty: (dirty) => set({ isDirty: dirty }),
  reset: () => set({ currentInvoice: null, isDirty: false }),
}));

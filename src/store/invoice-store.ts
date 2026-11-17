import { create } from "zustand";
import type { InvoiceFormData, LineItem, InvoiceStatus, InvoiceType } from "@/types";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import { beginWrite, isLatestWrite } from "@/lib/latest-write";
import {
  fetchInvoices,
  createInvoice as apiCreateInvoice,
  updateInvoice as apiUpdateInvoice,
  deleteInvoice as apiDeleteInvoice,
} from "@/lib/api";
import { notifyWriteFailure } from "@/store/toast-store";

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
  /** Set when the server refused a write: the row exists only in this browser. */
  syncError?: boolean;
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

/**
 * The server owns the invoice number and the totals, so once it answers the
 * optimistic row is corrected in place (the local id stays, because routes and
 * the editor address invoices by it). A superseded write is ignored: a newer
 * one is already in flight and will describe the row itself.
 */
function updateRow(id: string, change: (invoice: SavedInvoice) => SavedInvoice) {
  const invoices = useInvoiceStore
    .getState()
    .invoices.map((invoice) => (invoice.id === id ? change(invoice) : invoice));
  persist(invoices);
  useInvoiceStore.setState({ invoices });
}

function reconcile(id: string, token: number): (synced: SavedInvoice | null) => void {
  return (synced) => {
    if (!synced || !isLatestWrite(id, token)) return;
    updateRow(id, (invoice) => {
      const corrected: SavedInvoice = {
        ...invoice,
        invoiceNumber: synced.invoiceNumber,
        subtotal: synced.subtotal,
        discount: synced.discount,
        total: synced.total,
        balanceDue: synced.balanceDue,
      };
      // Saved again, so the "only in this browser" mark no longer applies.
      delete corrected.syncError;
      return corrected;
    });
  };
}

/** Keeps the row (the user's typing may not exist anywhere else) but marks it. */
function markSyncFailed(id: string) {
  updateRow(id, (invoice) => ({ ...invoice, syncError: true }));
}

function writeFailed(action: string, id: string, token: number) {
  return (error: unknown) => {
    // A newer write for this row has already superseded this one; its outcome
    // is what the user should hear about, not this stale failure.
    if (!isLatestWrite(id, token)) return;
    markSyncFailed(id);
    notifyWriteFailure(action, error);
  };
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
    const subtotal = data.lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const saved: SavedInvoice = {
      id: uid(),
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
      createdAt: new Date().toISOString(),
    };
    const updated = [saved, ...get().invoices];
    persist(updated);
    set({ invoices: updated, currentInvoice: null, isDirty: false });
    const token = beginWrite(saved.id);
    apiCreateInvoice(saved)
      .then(reconcile(saved.id, token))
      .catch(writeFailed("This invoice was not saved to the server.", saved.id, token));
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
    const token = beginWrite(id);
    apiUpdateInvoice(id, updatedInvoice)
      .then(reconcile(id, token))
      .catch(writeFailed("Your changes were not saved to the server.", id, token));
    return updatedInvoice;
  },

  deleteInvoice: (id) => {
    const previous = get().invoices;
    const index = previous.findIndex((inv) => inv.id === id);
    if (index === -1) return;
    const removed = previous[index];
    const token = beginWrite(id);
    const updated = previous.filter((inv) => inv.id !== id);
    persist(updated);
    set({ invoices: updated });
    apiDeleteInvoice(id).catch((error) => {
      // Put it back, but only this one row and only into the list as it is
      // now: newer invoices created in the meantime must survive the rollback.
      if (isLatestWrite(id, token)) {
        const current = get().invoices;
        if (!current.some((inv) => inv.id === id)) {
          const restored = [...current];
          restored.splice(Math.min(index, restored.length), 0, removed);
          persist(restored);
          set({ invoices: restored });
        }
      }
      notifyWriteFailure("This invoice was not deleted.", error);
    });
  },

  duplicateInvoice: (id) => {
    const target = get().invoices.find((inv) => inv.id === id);
    if (!target) return;
    const dup: SavedInvoice = {
      ...target,
      id: uid(),
      // The server assigns the real number for a duplicate.
      invoiceNumber: "",
      createdAt: new Date().toISOString(),
    };
    const updated = [dup, ...get().invoices];
    persist(updated);
    set({ invoices: updated });
    const token = beginWrite(dup.id);
    apiCreateInvoice(dup)
      .then(reconcile(dup.id, token))
      .catch(writeFailed("The duplicate was not saved to the server.", dup.id, token));
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

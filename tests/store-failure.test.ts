import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInvoiceStore, type SavedInvoice } from "@/store/invoice-store";
import { useClientStore } from "@/store/client-store";
import { useSettingsStore } from "@/store/settings-store";
import { useToastStore } from "@/store/toast-store";
import type { InvoiceFormData } from "@/types";

function failWith(status: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ error: "nope" }), { status }))
  );
}

function formData(): InvoiceFormData {
  return {
    invoiceNumber: "INV-26-0001",
    issueDate: new Date("2026-01-01T00:00:00.000Z"),
    dueDate: undefined,
    status: "pending",
    invoiceType: "invoice",
    clientId: "",
    lineItems: [{ id: "line_1", description: "Work", price: 100, quantity: 1 }],
    notes: "",
    discount: 0,
  } as InvoiceFormData;
}

function savedInvoice(overrides: Partial<SavedInvoice> = {}): SavedInvoice {
  return {
    id: "inv_1",
    invoiceNumber: "INV-26-0001",
    clientId: "",
    clientName: "",
    status: "pending",
    invoiceType: "invoice",
    subtotal: 100,
    discount: 0,
    total: 100,
    balanceDue: 100,
    notes: "",
    issueDate: "2026-01-01T00:00:00.000Z",
    dueDate: null,
    lineItems: [{ id: "line_1", description: "Work", price: 100, quantity: 1 }],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  useToastStore.setState({ notices: [] });
  useInvoiceStore.setState({ invoices: [] });
  useClientStore.setState({ clients: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a refused save", () => {
  it("is reported and the invoice is marked, not presented as saved", async () => {
    failWith(500);
    useInvoiceStore.getState().saveInvoice(formData(), "Acme");

    await vi.waitFor(() => {
      expect(useInvoiceStore.getState().invoices[0]?.syncError).toBe(true);
    });
    expect(useToastStore.getState().notices[0]?.message).toContain(
      "This invoice was not saved to the server."
    );
    expect(useInvoiceStore.getState().invoices).toHaveLength(1);
  });

  it("marks an update the server rejected", async () => {
    useInvoiceStore.setState({ invoices: [savedInvoice()] });
    failWith(429);
    useInvoiceStore.getState().updateInvoice("inv_1", formData(), "Acme");

    await vi.waitFor(() => {
      expect(useInvoiceStore.getState().invoices[0]?.syncError).toBe(true);
    });
    expect(useToastStore.getState().notices[0]?.message).toContain("Too many changes");
  });

  it("puts a failed delete back", async () => {
    useInvoiceStore.setState({ invoices: [savedInvoice(), savedInvoice({ id: "inv_2" })] });
    failWith(500);
    useInvoiceStore.getState().deleteInvoice("inv_1");

    expect(useInvoiceStore.getState().invoices).toHaveLength(1);
    await vi.waitFor(() => {
      expect(useInvoiceStore.getState().invoices).toHaveLength(2);
    });
    expect(useToastStore.getState().notices[0]?.message).toContain(
      "This invoice was not deleted."
    );
  });
});

describe("other refused writes", () => {
  it("removes a client the server never stored", async () => {
    failWith(500);
    useClientStore.getState().addClient({
      fullName: "Acme",
      company: "",
      email: "",
      phone: "",
      address: "",
    });

    expect(useClientStore.getState().clients).toHaveLength(1);
    await vi.waitFor(() => {
      expect(useClientStore.getState().clients).toHaveLength(0);
    });
    expect(useToastStore.getState().notices[0]?.message).toContain(
      "This client was not saved."
    );
  });

  it("reports a settings write that failed", async () => {
    failWith(403);
    useSettingsStore.getState().updateSettings({ currency: "EUR" });

    await vi.waitFor(() => {
      expect(useToastStore.getState().notices[0]?.message).toContain(
        "Your settings were not saved."
      );
    });
  });
});

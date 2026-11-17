import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInvoiceStore, type SavedInvoice } from "@/store/invoice-store";
import { useClientStore } from "@/store/client-store";
import { useSettingsStore } from "@/store/settings-store";
import { useToastStore } from "@/store/toast-store";
import type { InvoiceFormData } from "@/types";

type Pending = {
  resolve: (body: unknown) => void;
  reject: (error: unknown) => void;
};

/** fetch that answers nothing until the test says so. */
function deferredFetch(): Pending[] {
  const pending: Pending[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve, reject) =>
          pending.push({
            resolve: (body) =>
              resolve(new Response(JSON.stringify(body ?? {}), { status: 200 })),
            reject,
          })
        )
    )
  );
  return pending;
}

function rawInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv_1",
    invoiceNumber: "INV-26-0001",
    invoiceType: "invoice",
    clientId: null,
    client: null,
    status: "pending",
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

describe("writes that overlap", () => {
  it("ignores a failure an already-started newer write has superseded", async () => {
    const calls = deferredFetch();
    const saved = useInvoiceStore.getState().saveInvoice(formData(), "Acme");
    useInvoiceStore.getState().updateInvoice(saved.id, formData(), "Acme");
    await vi.waitFor(() => expect(calls).toHaveLength(2));

    calls[1].resolve(rawInvoice({ id: saved.id, invoiceNumber: "INV-26-0009" }));
    await vi.waitFor(() => {
      expect(useInvoiceStore.getState().invoices[0].invoiceNumber).toBe("INV-26-0009");
    });

    calls[0].reject(new Error("offline"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(useInvoiceStore.getState().invoices[0].syncError).toBeUndefined();
    expect(useToastStore.getState().notices).toHaveLength(0);
  });

  it("keeps a newer client edit when an older one fails afterwards", async () => {
    useClientStore.setState({
      clients: [
        {
          id: "c1",
          fullName: "Before",
          company: "",
          email: "",
          phone: "",
          address: "",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const calls = deferredFetch();
    useClientStore.getState().updateClient("c1", { fullName: "First" });
    useClientStore.getState().updateClient("c1", { fullName: "Second" });
    await vi.waitFor(() => expect(calls).toHaveLength(2));

    calls[1].resolve({ id: "c1" });
    calls[0].reject(new Error("offline"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(useClientStore.getState().clients[0].fullName).toBe("Second");
  });

  it("restores a failed delete without dropping invoices created meanwhile", async () => {
    useInvoiceStore.setState({ invoices: [savedInvoice(), savedInvoice({ id: "inv_2" })] });
    const calls = deferredFetch();
    useInvoiceStore.getState().deleteInvoice("inv_1");
    useInvoiceStore.getState().saveInvoice(formData(), "Newer");
    await vi.waitFor(() => expect(calls).toHaveLength(2));

    calls[0].reject(new Error("offline"));
    await vi.waitFor(() => {
      expect(useInvoiceStore.getState().invoices.some((inv) => inv.id === "inv_1")).toBe(true);
    });

    const ids = useInvoiceStore.getState().invoices.map((inv) => inv.id);
    expect(ids).toContain("inv_2");
    expect(ids).toHaveLength(3);
  });

  it("restores a failed client delete without dropping clients added meanwhile", async () => {
    useClientStore.setState({
      clients: [
        {
          id: "c1",
          fullName: "Acme",
          company: "",
          email: "",
          phone: "",
          address: "",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const calls = deferredFetch();
    useClientStore.getState().deleteClient("c1");
    useClientStore.getState().addClient({
      fullName: "Added later",
      company: "",
      email: "",
      phone: "",
      address: "",
    });
    await vi.waitFor(() => expect(calls).toHaveLength(2));

    calls[0].reject(new Error("offline"));
    await vi.waitFor(() => {
      expect(useClientStore.getState().clients.some((c) => c.id === "c1")).toBe(true);
    });

    const names = useClientStore.getState().clients.map((c) => c.fullName);
    expect(names).toEqual(["Acme", "Added later"]);
  });

  it("clears the unsaved mark by removing it, not by setting it false", async () => {
    useInvoiceStore.setState({ invoices: [savedInvoice()] });
    const calls = deferredFetch();
    useInvoiceStore.getState().updateInvoice("inv_1", formData(), "Acme");
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0].reject(new Error("offline"));
    await vi.waitFor(() => {
      expect(useInvoiceStore.getState().invoices[0].syncError).toBe(true);
    });

    useInvoiceStore.getState().updateInvoice("inv_1", formData(), "Acme");
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    calls[1].resolve(rawInvoice({ id: "inv_1" }));
    await vi.waitFor(() => {
      expect(useInvoiceStore.getState().invoices[0].syncError).toBeUndefined();
    });
    expect("syncError" in useInvoiceStore.getState().invoices[0]).toBe(false);
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

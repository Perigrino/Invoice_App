import { describe, expect, it } from "vitest";
import {
  buildExportFile,
  toExportedClient,
  toExportedInvoice,
  validateExportFile,
  type ExportFile,
} from "@/lib/exchange";
import { recalculate, toCents } from "@/lib/money";
import type { InvoiceRow } from "@/lib/invoice-mapping";

function invoiceRow(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  const row: InvoiceRow = {
    id: "inv_1",
    invoiceNumber: "INV-26-0001",
    invoiceType: "invoice",
    clientId: "client_1",
    status: "pending",
    subtotalCents: 0,
    discountPercent: 0,
    discountCents: 0,
    taxPercent: 0,
    taxCents: 0,
    totalCents: 0,
    balanceDueCents: 0,
    notes: "Thanks for your business",
    issueDate: new Date("2026-01-15T00:00:00.000Z"),
    dueDate: new Date("2026-02-14T00:00:00.000Z"),
    createdAt: new Date("2026-01-15T09:00:00.000Z"),
    updatedAt: new Date("2026-01-15T09:00:00.000Z"),
    lineItems: [
      {
        id: "line_1",
        description: "Consulting",
        priceCents: 120_055,
        quantity: 2,
        discountPercent: 0,
        taxPercent: 0,
        totalCents: 240_110,
        sortOrder: 0,
      },
      {
        id: "line_2",
        description: "Retainer",
        priceCents: 1,
        quantity: 3,
        discountPercent: 0,
        taxPercent: 0,
        totalCents: 3,
        sortOrder: 1,
      },
    ],
    ...overrides,
  };

  // Totals as the server would have computed them, so the fixture is not a lie.
  const totals = recalculate({
    lineItems: row.lineItems.map((item) => ({
      price: item.priceCents / 100,
      quantity: item.quantity,
      discountPercent: item.discountPercent,
      taxPercent: item.taxPercent,
    })),
    discountPercent: row.discountPercent,
    taxPercent: row.taxPercent,
  });

  return {
    ...row,
    subtotalCents: totals.subtotalCents,
    totalCents: totals.totalCents,
    balanceDueCents: totals.totalCents,
  };
}

function workspaceFile(): ExportFile {
  const clients = [
    { id: "client_1", fullName: "Acme Ltd", company: "Acme", email: "ap@acme.test", phone: null, address: "1 Main St", taxId: null },
    { id: "client_2", fullName: "Globex", company: null, email: null, phone: "555", address: null, taxId: "TAX-9" },
  ];

  const rows: InvoiceRow[] = [
    invoiceRow(),
    invoiceRow({
      id: "inv_2",
      invoiceNumber: "INV-26-0002",
      clientId: null,
      notes: null,
      dueDate: null,
      lineItems: [
        {
          id: "line_3",
          description: "Setup",
          priceCents: 19_99,
          quantity: 1,
          discountPercent: 0,
          taxPercent: 0,
          totalCents: 19_99,
          sortOrder: 0,
        },
      ],
    }),
    invoiceRow({ id: "inv_3", invoiceNumber: "INV-26-0003", clientId: "client_2" }),
  ];

  return buildExportFile({
    company: { id: "c1", workspaceId: "ws", name: "Studio", logo: null, address: "2 Road" },
    settings: { id: "s1", workspaceId: "ws", currency: "EUR", template: "light", darkMode: true, unknownColumn: "drop me" },
    clients: clients.map(toExportedClient),
    invoices: rows.map((row) => toExportedInvoice(row, clients)),
  });
}

describe("export file", () => {
  it("keeps the shape the validator accepts", () => {
    const file = workspaceFile();
    const validation = validateExportFile(JSON.parse(JSON.stringify(file)));
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.counts).toEqual({ clients: 2, invoices: 3, lineItems: 5 });
  });

  it("drops columns the schema does not have and keeps the ones it does", () => {
    const file = workspaceFile();
    expect(file.settings).not.toHaveProperty("unknownColumn");
    expect(file.settings).toMatchObject({ currency: "EUR", template: "light" });
    expect(file.company).toMatchObject({ name: "Studio" });
    expect(file.company).not.toHaveProperty("workspaceId");
  });
});

describe("validation", () => {
  it("rejects a file whose invoice numbers repeat, before any write", () => {
    const file = workspaceFile();
    const duplicated = {
      ...file,
      invoices: [file.invoices[0], { ...file.invoices[2], invoiceNumber: file.invoices[0].invoiceNumber }],
    };
    const validation = validateExportFile(JSON.parse(JSON.stringify(duplicated)));
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.errors.join(" ")).toContain("Duplicate invoice number INV-26-0001");
  });
});

describe("round trip", () => {
  it("keeps client links as positions, including a missing client", () => {
    const file = workspaceFile();
    expect(file.invoices.map((invoice) => invoice.clientIndex)).toEqual([0, null, 1]);

    const validation = validateExportFile(JSON.parse(JSON.stringify(file)));
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.file.invoices.map((invoice) => invoice.clientIndex)).toEqual([0, null, 1]);
  });

  it("survives JSON and returns the same numbers", () => {
    const file = workspaceFile();
    const validation = validateExportFile(JSON.parse(JSON.stringify(file)));
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.file.invoices).toEqual(file.invoices);
    expect(validation.file.clients).toEqual(file.clients);
  });

  it("recovers cents exactly, so an import totals to the same amount", () => {
    const file = workspaceFile();
    const validation = validateExportFile(JSON.parse(JSON.stringify(file)));
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    for (const [index, invoice] of validation.file.invoices.entries()) {
      const totals = recalculate({
        lineItems: invoice.lineItems.map((item) => ({
          price: item.price,
          quantity: item.quantity,
          discountPercent: item.discountPercent,
          taxPercent: item.taxPercent,
        })),
        discountPercent: invoice.discountPercent,
        taxPercent: invoice.taxPercent,
      });
      expect(totals.totalCents).toBe(toCents(invoice.total));
      // And the file's own total matches what the export put there.
      expect(toCents(file.invoices[index].total)).toBe(totals.totalCents);
    }
  });

  it("keeps a one-cent line at one cent", () => {
    const file = workspaceFile();
    const retainer = file.invoices[0].lineItems[1];
    expect(retainer.price).toBe(0.01);
    expect(toCents(retainer.price)).toBe(1);
  });

  it("is stable through a second round trip", () => {
    const first = workspaceFile();
    const validated = validateExportFile(JSON.parse(JSON.stringify(first)));
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const second = buildExportFile({
      company: validated.file.company,
      settings: validated.file.settings,
      clients: validated.file.clients,
      invoices: validated.file.invoices,
    });
    expect(second.invoices).toEqual(first.invoices);
    expect(second.clients).toEqual(first.clients);
    expect(second.settings).toEqual(first.settings);
  });
});

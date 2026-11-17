import { test, expect, type Page } from "@playwright/test";

/**
 * The smoke suite walks the anonymous-workspace paths the way a first-time
 * visitor does: a cookie becomes a workspace, an invoice is saved, shared,
 * downloaded, recovered, rotated, exported, converted and finally deleted.
 * Assertions are on what the server and the rendered page actually report,
 * not on internal state.
 */

/** The list renders a desktop table and a mobile card; match the shown one. */
function shown(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true }).first();
}

async function workspace(page: Page) {
  const response = await page.request.get("/api/workspace");
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { recoveryKey: string; url: string };
}

test.describe.configure({ mode: "serial" });

test("anonymous workspace end to end", async ({ page, browser }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /invoice/i }).first()).toBeVisible();

  await page.goto("/invoices/new");
  await expect(page.getByRole("button", { name: /save/i }).first()).toBeVisible();

  const me = await workspace(page);
  expect(me.recoveryKey).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){4}$/);

  // Tax is part of the stored totals now, not a label next to them.
  const created = await page.request.post("/api/invoices", {
    data: {
      invoiceType: "invoice",
      status: "pending",
      notes: "e2e smoke",
      tax: 10,
      lineItems: [
        { description: "Consulting", price: 100, quantity: 2, discountPercent: 0, taxPercent: 0 },
      ],
    },
  });
  expect(created.ok()).toBeTruthy();
  const invoice = (await created.json()) as {
    id: string;
    invoiceNumber: string;
    subtotal: number;
    tax: number;
    taxAmount: number;
    total: number;
  };
  expect(invoice.subtotal).toBe(200);
  expect(invoice.total).toBe(220);
  expect(invoice.tax).toBe(10);
  expect(invoice.taxAmount).toBe(20);

  await page.goto("/invoices");
  await expect(shown(page, invoice.invoiceNumber)).toBeVisible();

  // Share with an expiry, then open the public page and download the PDF.
  const shared = await page.request.post(`/api/invoices/${invoice.id}/share`, {
    data: { days: 30 },
  });
  expect(shared.ok()).toBeTruthy();
  const link = (await shared.json()) as { url: string; expiresAt: string | null };
  expect(link.expiresAt).toBeTruthy();
  expect(new Date(link.expiresAt as string).getTime()).toBeGreaterThan(Date.now());

  const publicPage = await browser.newPage();
  await publicPage.goto(link.url);
  await expect(shown(publicPage, invoice.invoiceNumber)).toBeVisible();

  const pdf = await publicPage.request.get(`${new URL(link.url).pathname}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect(pdf.headers()["content-disposition"]).toContain("attachment");
  await publicPage.close();

  // A proforma converts into a fresh invoice and is left in place.
  const proforma = await page.request.post("/api/invoices", {
    data: {
      invoiceType: "proforma",
      status: "draft",
      lineItems: [{ description: "Advance", price: 50, quantity: 1 }],
    },
  });
  const source = (await proforma.json()) as { id: string; invoiceNumber: string };
  const converted = await page.request.post(`/api/invoices/${source.id}/convert`);
  expect(converted.ok()).toBeTruthy();
  const copy = (await converted.json()) as { id: string; invoiceType: string; invoiceNumber: string };
  expect(copy.invoiceType).toBe("invoice");
  expect(copy.invoiceNumber).not.toBe(source.invoiceNumber);

  const csv = await page.request.get("/api/export/csv");
  expect(csv.ok()).toBeTruthy();
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const csvBody = await csv.text();
  expect(csvBody.split("\n")[0]).toContain("Invoice");
  expect(csvBody).toContain(invoice.invoiceNumber);

  // Rotating keeps the workspace and retires the old key.
  const rotated = await page.request.post("/api/workspace/rotate");
  expect(rotated.ok()).toBeTruthy();
  const next = (await rotated.json()) as { recoveryKey: string };
  expect(next.recoveryKey).not.toBe(me.recoveryKey);

  // A browser with no workspace of its own adopts the rotated key.
  const fresh = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const visitor = await fresh.newPage();
  await visitor.goto(`/w/${next.recoveryKey}`);
  await expect(shown(visitor, invoice.invoiceNumber)).toBeVisible({
    timeout: 30_000,
  });
  await fresh.close();

  // Deleting needs the current key; the wrong one changes nothing.
  const refused = await page.request.delete("/api/workspace", { data: { key: me.recoveryKey } });
  expect(refused.status()).toBe(403);
  const removed = await page.request.delete("/api/workspace", { data: { key: next.recoveryKey } });
  expect(removed.ok()).toBeTruthy();

  // The browser's next visit starts from an empty workspace, not the old data.
  const gone = await page.request.get("/api/invoices");
  expect(gone.ok()).toBeTruthy();
  expect(await gone.json()).toHaveLength(0);
});

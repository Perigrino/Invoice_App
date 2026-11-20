import { test, expect, type Page } from "@playwright/test";

/**
 * The smoke suite creates invoices through the API, so it never touches the
 * editor's own save path — the one that decides whether a filled-in form
 * reaches the server or is left sitting in the browser. This walks that path
 * the way an invoice is actually made: fill the form, press Save, land on the
 * list and find the row that came back from the server.
 */

/** The editor renders a desktop table and a mobile card per line item. */
function field(page: Page, placeholder: string) {
  return page.getByPlaceholder(placeholder, { exact: true }).filter({ visible: true }).first();
}

/** The list renders a desktop table and a mobile card; match the shown one. */
function shown(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true }).first();
}

test("the editor saves an invoice through the UI", async ({ page }) => {
  await page.goto("/invoices/new");

  await field(page, "Item description").fill("UI save check");
  await field(page, "0.00").fill("100");
  await field(page, "1").fill("2");
  await page.getByLabel("Tax (%)").fill("10");

  // The summary the user reads before saving: 2 × 100 plus 10% tax.
  await expect(shown(page, "GH₵220.00")).toBeVisible();

  await page.getByRole("button", { name: "Save Invoice", exact: true }).click();
  await page.waitForURL("**/invoices");

  // The first saved invoice is where the recovery key is handed over.
  await page.getByRole("button", { name: /saved it/i }).click();

  // The row has to be the server's copy: the number is assigned on write, and
  // the totals are recomputed there, so none of this can come from the form.
  const response = await page.request.get("/api/invoices");
  expect(response.ok()).toBeTruthy();
  const invoices = (await response.json()) as Array<{
    invoiceNumber: string;
    subtotal: number;
    taxPercent: number;
    taxAmount: number;
    total: number;
  }>;
  expect(invoices).toHaveLength(1);
  expect(invoices[0]).toMatchObject({
    subtotal: 200,
    taxPercent: 10,
    taxAmount: 20,
    total: 220,
  });

  await expect(shown(page, invoices[0].invoiceNumber)).toBeVisible();
  await expect(shown(page, "GH₵220.00")).toBeVisible();
  // A refused write keeps the row and labels it; a saved one never shows this.
  await expect(page.getByText("Not saved")).toHaveCount(0);
});

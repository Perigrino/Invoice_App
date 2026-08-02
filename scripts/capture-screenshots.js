const { chromium } = require("playwright");
const path = require("path");

const BASE = "http://localhost:3000";
const OUT = path.resolve(__dirname, "..", "screenshots");
const EMAIL = "demo@invoiceflow.app";
const PASSWORD = "DemoPass123!";

const invoices = [
  {
    invoiceNumber: "AG-482916-26",
    clientName: "Acme Corporation",
    status: "paid",
    subtotal: 2450,
    discount: 0,
    tax: 147,
    total: 2597,
    notes: "Payment received in full. Thank you for your business!",
    issueDate: "2026-07-01",
    dueDate: "2026-07-15",
    lineItems: [
      { description: "Web Development - Phase 1", price: 1500, quantity: 1, total: 1500 },
      { description: "UI/UX Design Package", price: 600, quantity: 1, total: 600 },
      { description: "Hosting Setup & Migration", price: 350, quantity: 1, total: 350 },
    ],
  },
  {
    invoiceNumber: "GL-771204-26",
    clientName: "Globex LLC",
    status: "pending",
    subtotal: 1299,
    discount: 100,
    tax: 71.94,
    total: 1270.94,
    notes: "Net 30 terms. Please remit by the due date.",
    issueDate: "2026-07-20",
    dueDate: "2026-08-19",
    lineItems: [
      { description: "Brand Identity Package", price: 799, quantity: 1, total: 799 },
      { description: "Logo Concepts (3 variations)", price: 500, quantity: 1, total: 500 },
    ],
  },
  {
    invoiceNumber: "IN-903317-26",
    clientName: "Initech",
    status: "draft",
    subtotal: 3200,
    discount: 0,
    tax: 192,
    total: 3392,
    notes: "Awaiting final scope approval.",
    issueDate: "2026-07-28",
    dueDate: "2026-08-27",
    lineItems: [
      { description: "Mobile App Development - MVP", price: 2500, quantity: 1, total: 2500 },
      { description: "API Integration Services", price: 700, quantity: 1, total: 700 },
    ],
  },
];

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(BASE + "/auth/signin");
  await page.goto(BASE + "/auth/signup");
  await page.fill('input[name="name"]', "Demo User");
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|\/invoices/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  console.log("signed up");

  const clients = [
    { fullName: "Sarah Mitchell", company: "Acme Corporation", email: "sarah@acme.com", phone: "+1 555-0142", address: "100 Market Street, San Francisco, CA" },
    { fullName: "David Chen", company: "Globex LLC", email: "david@globex.io", phone: "+1 555-0197", address: "500 Innovation Drive, Austin, TX" },
    { fullName: "Priya Sharma", company: "Initech", email: "priya@initech.co", phone: "+1 555-0133", address: "25 Silicon Way, Seattle, WA" },
  ];
  for (const c of clients) {
    const res = await page.evaluate(async (data) => {
      const r = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return { ok: r.ok, status: r.status };
    }, c);
    console.log("client:", res.ok ? "ok" : "FAIL " + res.status);
  }

  for (const inv of invoices) {
    const res = await page.evaluate(async (data) => {
      const r = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return { ok: r.ok, status: r.status, body: await r.json().catch(() => null) };
    }, inv);
    console.log("invoice:", res.ok ? "ok" : "FAIL " + res.status + JSON.stringify(res.body));
  }

  await page.evaluate(async () => {
    const r = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currency: "USD",
        separator: "comma",
        decimalPlaces: 2,
        signPlacement: "before",
        dateFormat: "MM/DD/YYYY",
        paperSize: "A4",
        pdfAccentColor: "#00BCD4",
        pdfSecondaryColor: "#059669",
      }),
    });
    return r.ok;
  });
  console.log("settings set");

  await page.goto(BASE + "/invoices");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "invoices.png"), fullPage: true });
  console.log("captured invoices.png");

  await page.goto(BASE + "/clients");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "clients.png"), fullPage: true });
  console.log("captured clients.png");

  await page.goto(BASE + "/invoices/new");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "invoice-editor.png"), fullPage: true });
  console.log("captured invoice-editor.png");

  await page.goto(BASE + "/settings");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "settings.png"), fullPage: true });
  console.log("captured settings.png");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

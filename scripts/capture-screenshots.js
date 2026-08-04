const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.resolve(__dirname, "..", "screenshots");

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const LOGO = `data:image/png;base64,${fs.readFileSync(path.join(OUT, "logo.png")).toString("base64")}`;

const clients = [
  {
    id: "cl-acme",
    fullName: "Sarah Mitchell",
    company: "Acme Corporation",
    email: "sarah@acme.com",
    phone: "+1 555-0142",
    address: "100 Market Street, San Francisco, CA",
    createdAt: "2026-07-01T09:00:00.000Z",
  },
  {
    id: "cl-globex",
    fullName: "David Chen",
    company: "Globex LLC",
    email: "david@globex.io",
    phone: "+1 555-0197",
    address: "500 Innovation Drive, Austin, TX",
    createdAt: "2026-07-05T09:00:00.000Z",
  },
  {
    id: "cl-initech",
    fullName: "Priya Sharma",
    company: "Initech",
    email: "priya@initech.co",
    phone: "+1 555-0133",
    address: "25 Silicon Way, Seattle, WA",
    createdAt: "2026-07-10T09:00:00.000Z",
  },
];

const invoices = [
  {
    id: "inv-acme",
    invoiceNumber: "AG-482916-26",
    clientId: "cl-acme",
    clientName: "Acme Corporation",
    status: "paid",
    invoiceType: "invoice",
    subtotal: 2450,
    discount: 0,
    total: 2597,
    balanceDue: 0,
    notes: "Payment received in full. Thank you for your business!",
    issueDate: "2026-07-01T00:00:00.000Z",
    dueDate: "2026-07-15T00:00:00.000Z",
    createdAt: "2026-07-01T10:00:00.000Z",
    lineItems: [
      { id: "li-1", description: "Web Development – Phase 1", price: 1500, quantity: 1 },
      { id: "li-2", description: "UI/UX Design Package", price: 600, quantity: 1 },
      { id: "li-3", description: "Hosting Setup & Migration", price: 350, quantity: 1 },
    ],
  },
  {
    id: "inv-globex",
    invoiceNumber: "GL-771204-26",
    clientId: "cl-globex",
    clientName: "Globex LLC",
    status: "pending",
    invoiceType: "invoice",
    subtotal: 1299,
    discount: 100,
    total: 1270.94,
    balanceDue: 1270.94,
    notes: "Net 30 terms. Please remit by the due date.",
    issueDate: "2026-07-20T00:00:00.000Z",
    dueDate: "2026-08-19T00:00:00.000Z",
    createdAt: "2026-07-20T10:00:00.000Z",
    lineItems: [
      { id: "li-4", description: "Brand Identity Package", price: 799, quantity: 1 },
      { id: "li-5", description: "Logo Concepts (3 variations)", price: 500, quantity: 1 },
    ],
  },
  {
    id: "inv-initech",
    invoiceNumber: "IN-0031-26",
    clientId: "cl-initech",
    clientName: "Initech",
    status: "draft",
    invoiceType: "proforma",
    subtotal: 3200,
    discount: 0,
    total: 3392,
    balanceDue: 3392,
    notes: "Awaiting final scope approval.",
    issueDate: "2026-07-28T00:00:00.000Z",
    dueDate: "2026-08-27T00:00:00.000Z",
    createdAt: "2026-07-28T10:00:00.000Z",
    lineItems: [
      { id: "li-6", description: "Mobile App Development – MVP", price: 2500, quantity: 1 },
      { id: "li-7", description: "API Integration Services", price: 700, quantity: 1 },
    ],
  },
];

const settings = {
  logo: LOGO,
  notes: "",
  currency: "USD",
  separator: "comma",
  decimalPlaces: 2,
  signPlacement: "before",
  dateFormat: "MM/DD/YYYY",
  pdfDirectory: "/exports",
  template: "modern",
  paperSize: "A4",
  pdfAccentColor: "#00BCD4",
  pdfSecondaryColor: "#059669",
  showInvoiceId: true,
  showDueDate: true,
  showCurrency: true,
  showDiscount: true,
  showTax: true,
  showNote: true,
  language: "en",
  sound: "default",
  openPdfAfterExport: true,
  autoSave: true,
  darkMode: false,
};

const company = {
  fullName: "InvoiceFlow Studios",
  name: "InvoiceFlow",
  logo: LOGO,
  address: "123 Commerce Ave, Suite 400",
  email: "hello@invoiceflow.app",
  phone: "+1 555-2300",
  website: "https://invoiceflow.app",
};

const profiles = [
  { id: "default", name: "Default", createdAt: "2026-07-01T00:00:00.000Z" },
  { id: "prof-axe", name: "Axe & Anchor Co.", createdAt: "2026-07-02T00:00:00.000Z" },
  { id: "prof-river", name: "Riverline Media", createdAt: "2026-07-03T00:00:00.000Z" },
];

const SEED = {
  "invoiceflow_profiles": profiles,
  "invoiceflow_active_profile": "default",
  "invoiceflow_p_default_clients": clients,
  "invoiceflow_p_default_invoices": invoices,
  "invoiceflow_p_default_settings": settings,
  "invoiceflow_p_default_company": company,
};

async function seed(page) {
  await page.evaluate((data) => {
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }, SEED);
}

async function expandLayout(page) {
  await page.evaluate(() => {
    document.documentElement.style.overflow = "visible";
    document.body.style.overflow = "visible";
    document.querySelectorAll("div").forEach((el) => {
      const c = typeof el.className === "string" ? el.className : "";
      if (c.includes("h-screen")) {
        el.style.height = "auto";
        el.style.overflow = "visible";
      }
      if (c.includes("flex-col") && c.includes("overflow-hidden")) {
        el.style.height = "auto";
        el.style.overflow = "visible";
      }
    });
    const main = document.querySelector("main");
    if (main) {
      main.style.height = main.scrollHeight + "px";
      main.style.overflow = "visible";
      main.style.maxHeight = "none";
    }
  });
}

async function shoot(page, url, file, opts) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(opts?.wait || 900);
  await expandLayout(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  console.log("captured", file);
}

async function capturePdf() {
  const body = {
    invoice: invoices[0],
    currency: "USD",
    company: {
      name: company.name,
      fullName: company.fullName,
      address: company.address,
      email: company.email,
      phone: company.phone,
    },
    logo: LOGO,
    settingsNotes: "",
    paperSize: "A4",
    accentColor: settings.pdfAccentColor,
    secondaryColor: settings.pdfSecondaryColor,
    template: "modern",
  };

  const res = await fetch(BASE + "/api/pdf/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("PDF export failed: " + res.status);

  const pdfPath = path.join(OUT, "invoice-preview.pdf");
  fs.writeFileSync(pdfPath, Buffer.from(await res.arrayBuffer()));
  console.log("generated", pdfPath);

  const pngPath = path.join(OUT, "pdf-preview.png");
  const { execFileSync } = require("child_process");
  execFileSync("sips", ["-s", "format", "png", pdfPath, "--out", pngPath]);
  console.log("converted", pngPath);
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.route(/\/api\/(settings|company|invoices|clients|profiles)/, (route) =>
    route.fulfill({ status: 404, body: "{}" })
  );

  await page.goto(BASE + "/invoices", { waitUntil: "networkidle" });
  await seed(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  await shoot(page, BASE + "/invoices", "invoices.png");
  await shoot(page, BASE + "/clients", "clients.png");
  await shoot(page, BASE + "/invoices/" + invoices[0].id, "invoice-editor.png", { wait: 3500 });
  await shoot(page, BASE + "/settings", "settings.png");

  await browser.close();
  await capturePdf();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
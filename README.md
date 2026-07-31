# InvoiceFlow — Modern Invoice Generator

InvoiceFlow is a full-featured invoice generation app built with Next.js. Create, manage, and export professional invoices with ease.

## Features

- **Invoice Management** — Create, edit, duplicate, and delete invoices. Each invoice supports line items, custom notes, and discount.
- **Client Management** — Store and manage your client contacts with full details (name, company, email, phone, address).
- **Multi-Profile** — Switch between multiple business profiles, each with its own isolated data (clients, invoices, settings).
- **PDF Export** — Export invoices to PDF with a clean, professional layout. Supports A3, A4, Letter, and Legal paper sizes.
- **Invoice Types** — Choose between standard **Invoice** or **Proforma Invoice** — the PDF title updates accordingly.
- **Auto Invoice Numbers** — When you select a client, the invoice number auto-generates as `CLI-482916-26` (client initials + random digits + year).
- **Dark Mode** — Full dark mode support. Toggle from the sidebar, topbar, or settings.
- **Currency Support** — Multiple currencies (USD, EUR, GBP, GHS, CAD, NGN, ZAR) with configurable format (separator, decimal places, sign placement).
- **Paper Size** — Choose A3, A4, Letter, or Legal for PDF exports.
- **Per-Profile Settings** — Each profile has its own company logo, business details, and default invoice notes.
- **Local-First Storage** — All data persists in your browser via localStorage. No account required.
- **Responsive UI** — Collapsible sidebar, data tables, gradient accents, and smooth transitions.

## Tech Stack

- **Framework** — Next.js (App Router)
- **Styling** — Tailwind CSS v4 + Shadcn/ui
- **State** — Zustand with localStorage persistence
- **PDF** — jsPDF
- **Theming** — next-themes

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
```

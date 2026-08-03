# InvoiceFlow — Modern Invoice Generator

InvoiceFlow is a full-featured invoice generation app built with Next.js. Create, manage, and export professional invoices with ease.

## Screenshots

| Invoices | Clients |
|---|---|
| ![Invoices](screenshots/invoices.png) | ![Clients](screenshots/clients.png) |

| Invoice Editor | Settings |
|---|---|
| ![Invoice Editor](screenshots/invoice-editor.png) | ![Settings](screenshots/settings.png) |

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
- **Per-Profile Settings** — Each profile has its own company logo, business details, default invoice notes, and PDF colors.
- **No Login Required** — Open the app and start invoicing. No account or sign-in needed.
- **Local-First Storage** — All data persists in your browser via localStorage. Optional server sync via Prisma/Postgres when a database is configured.
- **Responsive UI** — Collapsible sidebar, data tables, gradient accents, and smooth transitions.

## Updates

### v1.1 — User Accounts & Authentication (removed in v1.5)
- ~~Custom authentication (JWT sessions via `jose`, bcrypt password hashing).~~
- ~~Sign up / sign in pages with server-side validation.~~
- ~~Account-scoped data, route protection, admin roles, and admin panel.~~

### v1.2 — Per-Profile PDF Colors
- Each profile can define its own **Accent Color** (invoice title, table header, underline) and **Secondary Color** (totals section and highlight) used in exported PDFs.
- Settings added under Settings → Profiles, with preset swatches, a color picker, and hex input.

### v1.3 — Export Validation
- An invoice can no longer be exported without a **client selected**, **at least one line item**, and a **note**.
- A warning banner highlights which fields need attention, and the offending sections are outlined in red.
- If no note is entered but the active profile has a saved **default note**, you'll be prompted to use it for the export.
- If no default note exists, you're guided to add one or set a default note in Settings.

### v1.4 — PDF Layout Polish
- Row text in the item table (description, price, qty, total) is now vertically centered so the alternating row shade never overlaps the text.
- Notes are centered on the PDF.

### v1.5 — No-Login Experience
- Removed authentication entirely — no sign up, sign in, or logout.
- The app opens directly to the invoice dashboard; all auth UI, admin panel, and account settings were removed.
- API sync (when a database is configured) now uses a single implicit owner instead of per-user accounts; without a database the app runs fully on localStorage.

## Tech Stack

- **Framework** — Next.js (App Router)
- **Styling** — Tailwind CSS v4 + Shadcn/ui
- **State** — Zustand with localStorage persistence + optional server sync
- **Database** — PostgreSQL + Prisma ORM (optional; app works without it)
- **PDF** — jsPDF
- **Theming** — next-themes

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> No `.env` or database is required. The app runs entirely in the browser using localStorage. To enable optional server sync, set `DATABASE_URL`, run `npx prisma db push`, and restart the dev server.

## Build

```bash
npm run build
```

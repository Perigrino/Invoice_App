# InvoiceFlow — Modern Invoice Generator

A simple, no-fuss invoice app: pick a profile, create an invoice, and export it as a clean PDF — done. Built with Next.js.

## Screenshots

| Invoices | Clients |
|---|---|
| ![Invoices](screenshots/invoices.png) | ![Clients](screenshots/clients.png) |

| Invoice Editor | Settings |
|---|---|
| ![Invoice Editor](screenshots/invoice-editor.png) | ![Settings](screenshots/settings.png) |

| Generated PDF |
|---|
| ![Generated PDF](screenshots/pdf-preview.png) |

## Features

- **Invoices** — Create, edit, duplicate, and delete; line items, notes, and auto-generated invoice numbers.
- **Clients** — Manage contacts with name, company, email, phone, and address.
- **Multi-Profile** — Switch between business profiles with isolated data and per-profile logo, details, notes, and PDF colors.
- **PDF Export** — 5 templates (Modern, Minimal, Business, Professional, Elegant) with A3/A4/Letter/Legal sizes and custom accent colors.
- **Live Preview** — The editor renders the real PDF live as you type.
- **Searchable Client Picker** — Find clients by name, company, email, phone, or address.
- **i18n** — English, Spanish, French, and Arabic.
- **Dark Mode** — Full dark mode with multiple currencies and configurable formats.
- **No Login / Local-First** — No account needed; data persists in localStorage, with optional Prisma/Postgres sync.

## Updates

- **v1.6** — PDF templates fully working, live PDF preview, searchable client picker, direct PDF download, centered notes, and i18n.
- **v1.5** — Removed authentication; app opens straight to the dashboard.
- **v1.4** — PDF layout polish: vertically centered table rows, centered notes.
- **v1.3** — Export validation: require client, line items, and note before exporting.
- **v1.2** — Per-profile PDF accent and secondary colors.

## Tech Stack

- **Framework** — Next.js (App Router)
- **Styling** — Tailwind CSS v4 + Shadcn/ui
- **State** — Zustand with localStorage persistence + optional server sync
- **Database** — PostgreSQL + Prisma ORM (optional; app works without it)
- **PDF** — @json-render/react-pdf
- **Theming** — next-themes

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No `.env` or database required — to enable optional server sync, set `DATABASE_URL`, run `npx prisma db push`, and restart the dev server.

## Build

```bash
npm run build
```

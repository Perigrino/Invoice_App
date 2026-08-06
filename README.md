# InvoiceFlow — Modern Invoice Generator

A no-fuss invoice app: pick a profile, create an invoice, and export it as a clean PDF — done. Built with Next.js.

**Live now:** [InvoiceFlow](https://invoiceflow-ivory-rho.vercel.app). Fully mobile-friendly.

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

- **Accounts** — Sign up, sign in, and sign out with your own account. Your clients, invoices, and settings are isolated per user.
- **Invoices** — Create, edit, duplicate, and delete; line items, notes, and auto-generated invoice numbers.
- **Clients** — Manage contacts with name, company, email, phone, and address.
- **Multi-Profile** — Switch between business profiles with isolated data and per-profile logo, details, notes, and PDF colors.
- **PDF Export** — 5 templates (Modern, Minimal, Business, Professional, Elegant) with A3/A4/Letter/Legal sizes and custom accent colors.
- **Live Preview** — The editor renders the real PDF live as you type.
- **Searchable Client Picker** — Find clients by name, company, email, phone, or address.
- **Mobile-friendly** — Drawer navigation, card-based lists, a stacked line-item editor, and bottom-sheet dialogs. Works great on any screen.
- **i18n** — English, Spanish, French, and Arabic.
- **Dark Mode** — Full dark mode with multiple currencies and configurable formats.

## Updates

- **v1.8** — Mobile-friendly redesign: drawer navigation, card-based lists, a stacked line-item editor, and bottom-sheet dialogs on phones.
- **v1.7** — Accounts & per-user data (Auth.js v5 sign up / sign in / sign out), deployed live to Vercel.
- **v1.6** — PDF templates fully working, live PDF preview, searchable client picker, direct PDF download, centered notes, and i18n.
- **v1.5** — Removed authentication; app opens straight to the dashboard.
- **v1.4** — PDF layout polish: vertically centered table rows, centered notes.
- **v1.3** — Export validation: require client, line items, and note before exporting.
- **v1.2** — Per-profile PDF accent and secondary colors.

## Tech Stack

- **Framework** — Next.js (App Router)
- **Styling** — Tailwind CSS v4 + Shadcn/ui
- **State** — Zustand with localStorage persistence + per-user server sync
- **Database** — PostgreSQL + Prisma ORM (required for accounts)
- **Auth** — Auth.js v5 (credentials + Prisma adapter)
- **PDF** — @json-render/react-pdf
- **Theming** — next-themes

## Getting Started

```bash
npm install
cp .env.example .env   # set DATABASE_URL, DIRECT_URL, AUTH_SECRET
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up for an account. Your clients, invoices, and settings are stored per user in Postgres.

Or try the live app: [InvoiceFlow](https://invoiceflow-ivory-rho.vercel.app).

## Build

```bash
npm run build
```

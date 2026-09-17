# InvoiceFlow Native macOS App — Design Spec

## Overview

Rebuild InvoiceFlow as a native macOS app using SwiftUI, SwiftData, and PDFKit. Local-only persistence via SQLite (SwiftData). No authentication, no server, no remote dependencies.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | SwiftUI (macOS 14+) |
| Persistence | SwiftData (SQLite) |
| PDF Generation | PDFKit + Core Graphics |
| Architecture | MVVM with @Observable |

## Data Models

### Invoice
- `id: UUID`
- `invoiceNumber: String`
- `invoiceType: String` ("invoice" | "proforma")
- `clientId: UUID?` (optional relationship)
- `status: String` ("draft" | "pending" | "paid" | "overdue" | "cancelled")
- `lineItems: [InvoiceLineItem]`
- `subtotal: Double`
- `discount: Double`
- `tax: Double`
- `total: Double`
- `balanceDue: Double`
- `notes: String?`
- `issueDate: Date`
- `dueDate: Date?`
- `createdAt: Date`
- `updatedAt: Date`

### InvoiceLineItem
- `id: UUID`
- `invoice: Invoice` (inverse relationship)
- `description: String`
- `price: Double`
- `quantity: Double`
- `discount: Double`
- `tax: Double`
- `total: Double`
- `sortOrder: Int`

### Client
- `id: UUID`
- `fullName: String`
- `company: String?`
- `email: String?`
- `phone: String?`
- `address: String?`
- `taxId: String?`
- `invoices: [Invoice]`
- `createdAt: Date`
- `updatedAt: Date`

### Company
- `id: UUID`
- `name: String?`
- `logo: Data?` (image data)
- `address: String?`
- `email: String?`
- `phone: String?`
- `website: String?`
- `taxId: String?`

### Setting
- `id: UUID`
- `profileName: String`
- `currency: String` (default "USD")
- `separator: String` ("comma" | "dot" | "space")
- `decimalPlaces: Int` (0-4)
- `signPlacement: String` ("before" | "after")
- `dateFormat: String`
- `template: String` ("modern" | "business" | "minimal" | "professional" | "elegant")
- `paperSize: String` ("A3" | "A4" | "Letter" | "Legal")
- `pdfAccentColor: String` (hex)
- `pdfSecondaryColor: String` (hex)
- `notes: String`
- `showInvoiceId: Bool`
- `showDueDate: Bool`
- `showCurrency: Bool`
- `showDiscount: Bool`
- `showTax: Bool`
- `showNote: Bool`
- `language: String` ("en" | "fr" | "es" | "ar")
- `darkMode: Bool`
- `isActive: Bool` (current profile flag)

## Landing Page

**Concept: Dark Invoice** — Deep navy (#0F172A) background, invoice paper mockup floating center-stage with a subtle shadow. The invoice IS the landing page.

- Animated invoice paper with line items fading in one by one
- Invoice number, line items with prices, and total displayed
- Subtle glow/shadow behind the invoice card
- "Get Started" button below in glass style
- Transitions to main app with a smooth scale + fade animation

## App Structure

```
InvoiceFlow/
├── InvoiceFlowApp.swift
├── Models/
│   ├── Invoice.swift
│   ├── InvoiceLineItem.swift
│   ├── Client.swift
│   ├── Company.swift
│   └── Setting.swift
├── Views/
│   ├── ContentView.swift
│   ├── Invoices/
│   │   ├── InvoiceListView.swift
│   │   ├── InvoiceDetailView.swift
│   │   └── InvoiceFormView.swift
│   ├── Clients/
│   │   ├── ClientListView.swift
│   │   └── ClientFormView.swift
│   ├── Settings/
│   │   ├── SettingsView.swift
│   │   ├── ProfileSettingsView.swift
│   │   ├── InvoiceSettingsView.swift
│   │   ├── CurrencySettingsView.swift
│   │   └── GeneralSettingsView.swift
│   └── Components/
│       ├── StatusBadge.swift
│       ├── LineItemRow.swift
│       └── EmptyStateView.swift
├── PDF/
│   ├── PDFGenerator.swift
│   └── Templates/
│       ├── ModernTemplate.swift
│       ├── BusinessTemplate.swift
│       ├── MinimalTemplate.swift
│       ├── ProfessionalTemplate.swift
│       └── ElegantTemplate.swift
└── Utilities/
    ├── CurrencyFormatter.swift
    └── DateHelper.swift
```

## Navigation

Sidebar with three sections:
- **Invoices** — list with search, status filter, actions (edit, duplicate, export PDF, delete)
- **Clients** — list with search, actions (edit, delete)
- **Settings** — tabbed (Profiles, Invoice, Currency, General)

## PDF Templates

All 5 templates generated natively via PDFKit:
1. **Modern** — clean layout, accent color header, subtle lines
2. **Business** — formal, table-heavy, company branding prominent
3. **Minimal** — whitespace-focused, thin typography
4. **Professional** — structured, signature line, detailed line items
5. **Elegant** — decorative, secondary color accents, refined spacing

Each template respects: paper size, accent/secondary colors, field visibility toggles, logo, company info.

## Currency Support

7 currencies: USD, EUR, GBP, GHS, CAD, NGN, ZAR
- Configurable separator (comma/dot/space)
- Sign placement (before/after amount)
- Decimal places (0-4)

## i18n

4 languages: English, French, Spanish, Arabic
- SwiftUI LocalizedStringKey for all user-facing strings
- Bundle-based string tables

## Multi-Profile Settings

- Multiple named profiles with independent settings
- One profile marked `isActive` at a time
- Switch profiles from sidebar or settings
- Company info shared across profiles

## Dark Mode

- System appearance tracking via @Environment(\.colorScheme)
- All templates adapt to light/dark
- PDF output matches current appearance

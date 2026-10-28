# InvoiceFlow

Native macOS invoicing app for freelancers who want their money data to belong to them — local-first, offline, and fast. This brief is for the **v2 rebuild** (v0.2.0 → 0.3.0): re-architecture for reliability and money-safe data, plus the researched feature bar, styled by the shipped Airpisode prototype.

## Replaces
Invoicing in web SaaS (FreshBooks/QBO tier) and the capped native option (Billings Pro); existing InvoiceFlow v0.2.0 codebase.

## Main jobs
1. Create and send a fast, professional invoice (⌘N keyboard-first, single scrolling form, remembered defaults) — the one job the app must ace.
2. Track what's owed: payment records, partial payments, statuses (Outstanding/Overdue/Partially Paid/Paid), status click-through lists.
3. Own the data forever: local SwiftData store with explicit transaction saves, rolling backups, one-click export/CSV lifeline.

## Data
- `Invoice`: number, type (invoice/estimate→conversion), client, dates, terms, discount/credit/deposit/schedule block, taxes, **`Decimal` money fields** (migrated from Double, versioned schema), status, payments[], attachments
- `InvoiceLineItem`: item ref, name, description, qty, rate, up to 2 taxes per line
- `Payment`: amount, date, method, note (new — balance math flows from payments, not status flags)
- `RecurringProfile`: generator template (schedule + defaults), never a copied invoice
- `Client`, `Company`, `Item` (library for autofill), `Setting`

## Shape
Existing Xcode project (`InvoiceFlow.xcodeproj`, bundle `com.invoiceflow.app`, macOS 14+, SwiftData, unsandboxed). One window, sidebar (214px): Dashboard hub (Create New first, Outstanding + aging, click-through), Invoices/Estimates/Recurring, Clients, Reports, Settings. Local data. Works offline. No accounts, no sync in v2.

## System hooks
⌘N new invoice; ⌘⇧E/⌘⇧I backup Export/Import (existing); UserNotifications due-date reminders (probe test for post-quit delivery); NSSharingServicePicker for PDF share; Quick Look preview.

## Reference
FreshBooks invoice editor (single scrolling form, payment-adjustments block, remembered terms), FreshBooks lists & dashboard (hover quick actions, widget grid), MoneyWorks (⌘N type-ahead entry with create-on-the-fly, sequential numbering, single-document backup/rollback model). None installed; help pages cited in docs/research/.

## Look
**Own parts, styled by the Airpisode prototype** (`prototype/index.html`): near-black canvas with corner accent glows, glass cards, capsule chips, Silk motion (280/450/600ms, 12px fade-up, hover 1.006), five invoice-owned gradient palettes (Lagoon default, Cobalt, Citrus, Ember, Bloom — not purple/magenta), dark default with light shipping, desaturated status washes, per-client name hue, days-to-due gradient tile. Sidebar at 214px. App icon unchanged.

## Not in version one
- CloudKit/sync (decided: local-first; versioned-schema exit ramp documented)
- Online payment processing, hosted client portal (shareable PDF/links instead)
- Time tracking, expenses→invoice
- Late-fee automation, event discussions/audit log
- Pricing/licensing changes

## Agent-decided (from research)
Defer CloudKit sync · Double→Decimal versioned migration · explicit `transaction{}` saves on every write path (closes crash-at-quit data gap) · UserNotifications over EventKit · reports = basic (outstanding/paid/overdue summary).

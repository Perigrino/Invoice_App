# STORIES — InvoiceFlow v2 rebuild

Built from docs/BRIEF.md + docs/research/*.md. Status: todo. Every
acceptance line names its check: [snap] snapshot · [self] in-app self-test
· [unit] unit test · [manual] human tries it.

## Milestones

1. **M1 Money-safe core** — re-architecture: Decimal money, explicit saves, backups prove the "trust" promise; existing create-invoice loop still works each day.
2. **M2 Airpisode look** — the shipped prototype's design system as real SwiftUI parts (user's priority).
3. **M3 Payment chain** — payments records, partial balances, status engine + click-through.
4. **M4 Lifecycle** — estimates→invoice, recurring generator profiles.
5. **M5 Hub & speed** — dashboard widgets, list-as-hub quick actions, keyboard-first entry (FreshBooks + MoneyWorks patterns).
6. **M6 System & polish** — branded PDF templates, reminders, CSV export, basic reports, empty states.

No screens/INDEX.md exists yet; Screens name the snapshot pages improve-loop will create.

---

## M1 Money-safe core

### S-001 Migrate money fields from Double to Decimal with a versioned schema
As the user, I open the app after updating and my existing invoice totals read exactly as before.
Screens: 04-invoice-detail.png
Depends: none
Acceptance:
- [unit] A migration test loads a copied 0.2.0 store fixture and asserts subtotal/tax/total/balanceDue match stored values to the cent.
- [unit] SchemaMigrationPlan stages v1 (Double) → v2 (Decimal) without data loss for invoices, line items, company, payments.
- [self] App launches, creates and pays an invoice, quits and relaunches without a fatal error.
Status: todo

### S-002 Save every write path in a SwiftData transaction
As the user, my edits hit the store immediately, not at quit.
Acceptance:
- [unit] Injecting a process-kill between an invoice edit and quit retains the edit on next launch (simulated with transaction save + reload).
- [unit] RollingBackupService snapshot mid-session contains the just-saved edit.
- [self] Create→edit→force-quit→relaunch shows the edit.
Depends: S-001
Status: todo

### S-0010 Update persistence + backup test suites for the new model
As a developer, the test suites prove the re-architecture.
Acceptance:
- [unit] PersistenceTests broadened to cover payments, recurring profiles, and Decimal rounding; RollingBackupTests cover mid-transaction snapshots.
Depends: S-001, S-002
Status: todo

### S-003 Create an invoice end to end on the migrated model
As the user, I add a client, lines, discount, tax and see correct totals.
Screens: 03-invoice-form.png
Depends: S-001
Acceptance:
- [snap] Invoice form shows all money rendered via Decimal FormatStyle with the invoice's currency; percent line discount/taxes calculate like totals.
- [unit] recalculate() is cent-exact across 6 rounding cases.
- [self] ⌘N form → add 3 lines → totals correct → invoice appears in list.
UX:
- Flow: ⌘N / toolbar + / File > New Invoice -> client type-ahead focused -> add Line Items -> Return or "Save Draft" -> Draft row appears in list; Escape asks before discarding typed data ("Keep editing" / "Discard")
- Surface: editor page in the sidebar window (long, self-contained task that people keep open beside the list — "new window" row); Add Payment uses a sheet, per S-004
- States: empty "No Invoices Yet" + "New Invoice" button; money errors inline under the field ("Enter a rate."); due date defaults from Terms so nothing else is asked
- Words: "New Invoice", "Save Draft", "Amount Due", status chips Draft/Sent/Outstanding/Overdue/Partially Paid/Paid (GLOSSARY only)
- Access: full keyboard order Client → Lines → Save; every icon-only control has `.help("what it does (⌘N)")`; Reduce Motion fades replace slides
Status: todo

### S-004 Record a payment and watch balanceDue fall
As the user, I mark part or all of an invoice paid.
Screens: 04-invoice-detail.png
Acceptance:
- [unit] balanceDue = total − Σpayments; never negative.
- [self] Pay 50% → status "Partially Paid"; pay remainder → "Paid".
UX:
- Flow: hover quick action (coin), context menu "Add Payment…", detail "Add Payment…" -> sheet prefilled: amount = Balance Due, date = today, method popup -> "Record Payment" (Return) -> balance + status update in same frame; Escape cancels
- Surface: modal sheet on the invoice detail ("one short task that must finish or cancel before going on" row); sheet title names the task, "Add Payment"
- States: empty payments section shows "No Payments Yet" with "Add Payment…"; amount error inline "Enter an amount."; overpay blocked inline "Payment is larger than the balance due."
- Words: "Add Payment…", "Record Payment", "Payment" record fields Amount/Date/Method/Note; deleting a payment shows "Delete this Payment?" with "Delete" and "Cancel"
- Access: sheet is fully keyboard-operable; VoiceOver reads "Add Payment" sheet and prefilled amount; tooltip on hover coin action: "Record a payment (⏎)"
Depends: S-003, S-002
Status: todo

### S-005 Data survives restart and lives in the single store file
As the user, I quit and everything is still there.
Acceptance:
- [self] Restart keeps invoices, clients, payments, settings.
- [unit] Store path is the one document-like file; rolling backup chain restores it (existing BackupService flow re-verified).
Depends: S-001
Status: todo

## M2 Airpisode look

### S-010 Build the Airpisode design-token layer in SwiftUI
As the user, the app looks like the prototype, not a stock app.
Screens: 00-tokens.png
Acceptance:
- [snap] Tokens overlay page matches `prototype/index.html` tokens: canvas, glass cards, capsule chips, 5 gradient palettes (Lagoon default, Cobalt, Citrus, Ember, Bloom), dark default.
- [self] Light/dark both render; switch in Settings.
Depends: S-005
Status: todo

### S-011 Apply Silk motion (280/450/600ms, 12px fade-up, hover 1.006)
Acceptance:
- [snap] List rows fade-up 12px on appear at 280ms; card hover scale 1.006.
- [self] No motion marked as broken by reduced-accessibility toggle.
Depends: S-010
Status: todo

### S-012 Rebuild the invoice list in the prototype look
As the user, my invoice list reads as the prototype rows: status washes, per-client hue, days-to-due tile.
Screens: 01-invoices-list.png
Acceptance:
- [snap] Row matches prototype: status wash (Paid #63C79E/#1E9E6A, Due soon #E2B45F, Overdue #E2786F), deterministic per-client name hue, days-to-due gradient tile, 214px sidebar.
- [self] List scrolls and selects smoothly with Silk motion.
Depends: S-010
Status: todo

### S-013 Rebuild the invoice form/detail in the prototype look
Screens: 03-invoice-form.png, 04-invoice-detail.png
Acceptance:
- [snap] Form + detail on glass cards per prototype; buttons/chips capsule.
Depends: S-010
Status: todo

### S-014 Rebuild Dashboard/landing shell in the prototype look
Screens: 02-dashboard.png
Acceptance:
- [snap] Dashboard = prototype canvas with corner accent glows; widget slots laid out for M5 content.
- [manual] User prefers new look over old (Ask after build).
Depends: S-010
Status: todo

### S-015 Keep the green document app icon unchanged
Acceptance:
- [snap] Dock icon untouched in light and dark.
Status: todo

## M3 Payment chain

### S-020 Payment records list on invoice detail
As the user, I see each payment: amount, date, method, note.
Screens: 04-invoice-detail.png
Depends: S-004, S-013
Acceptance:
- [snap] Payments block lists entries; add-payment sheet writes a record.
- [unit] Deleting a payment recomputes balanceDue and status.
Status: todo

### S-021 Status engine: Draft/Sent/Outstanding/Overdue/Partially Paid/Paid
As the user, statuses reflect reality automatically.
Acceptance:
- [unit] Overdue = past due date with balance > 0; Paid when balance 0; Partially Paid between.
- [self] Status chip updates across list and detail everywhere.
Depends: S-004
Status: todo

### S-022 Status click-through filters on lists
As the user, I click a status chip and the list filters to it.
Screens: 01-invoices-list.png
Acceptance:
- [snap] Click-through from dashboard outstanding widget to filtered list (fake data). [unit] Filter predicate covers all statuses.
Depends: S-021
Status: todo

### S-023 Client + item libraries with autofill
As the user, typing a known client/item autocompletes from history.
Screens: 03-invoice-form.png
Acceptance:
- [self] Type-ahead suggests past clients and items with last-used rate; picking fills fields.
- [unit] Library stores Item with default rate, qty unit.
Depends: S-003
Status: todo

## M4 Lifecycle

### S-030 Convert an estimate to an invoice
As the user, I turn an estimate into an invoice with its lines, in one action.
Screens: 05-estimates-list.png
Acceptance:
- [unit] Conversion preserves line items, client, and settings; estimate keeps its own numbering (EST-…).
- [self] Context menu "Convert to invoice" on an accepted estimate.
Depends: S-021
Status: todo

### S-031 Recurring profiles as generator templates
As the user, a profile generates each period's invoice on schedule.
Screens: 06-recurring.png
Acceptance:
- [unit] Generator produces the next invoice from schedule (weekly/monthly/quarterly) without copying profile data into history.
- [self] Toggling a profile ON stamps next-run date; app generates on launch.
Depends: S-030
Status: todo

## M5 Hub & speed

### S-040 Dashboard: Create-New-first widget + Outstanding widget with aging
Screens: 02-dashboard.png
Acceptance:
- [snap] Create New… (invoice/client/estimate) first; Outstanding shows overdue/outstanding bars and aging buckets with click-through (S-022).
- [self] Ads or decorative widgets not shown.
Depends: S-022
Status: todo

### S-041 Hover quick actions on list rows
As the user, hovering an invoice row shows edit, duplicate, add payment, more.
Screens: 01-invoices-list.png
Acceptance:
- [snap] Hover reveals the four actions in row style.
- [self] Each action does its sentence: edits, duplicates with new number, opens add-payment, opens menu (archive, CSV…).
Depends: S-012, S-020
Status: todo

### S-042 Keyboard-first invoice editor: ⌘N, type-ahead Tab jumps, create-on-the-fly
As the user, I never touch the mouse to create an invoice.
Screens: 03-invoice-form.png
Acceptance:
- [self] ⌘N opens editor; Tab cycles fields with type-ahead client lookup; unknown client → ⏎ creates on the fly; ⏎ saves.
- [unit] Sequential invoice number auto-assigned with no gaps per company settings.
Depends: S-023, S-013
Status: todo

### S-043 Remembered defaults: terms, due-date mode, per-client settings
As the user, the next invoice opens with my last terms and due-date rule.
Acceptance:
- [self] Second invoice inherits terms from first; per-client PDF-copy checkbox persists.
- [unit] Setting stores last-used terms/due-date mode.
Depends: S-042
Status: todo

### S-044 Archive vs delete with recovery
As the user, archiving hides without destroying; delete offers recovery.
Acceptance:
- [self] Archive filters out of lists (visible toggle in Settings>Data); delete keeps a recoverable copy via rolling backup.
- [unit] Archived invoices excluded from reports/aging.
Depends: S-021
Status: todo

## M6 System & polish

### S-050 Branded PDF templates
As the user, I pick template/logo/accent per company and per client.
Screens: 07-pdf-preview.png
Acceptance:
- [snap] PDF preview in 3 variants (modern/compact/branded) with accent palette color (Lagoon default).
- [self] Generated by SwiftUI ImageRenderer pipeline; per-invoice override in per-invoice settings.
Depends: S-013
Status: todo

### S-051 Share a PDF and preview via Quick Look
Acceptance:
- [self] NSSharingServicePicker shares file; QL preview opens from detail (no entitlement needed).
- [manual] Share to Mail shows attachment.
Depends: S-050
Status: todo

### S-052 Due-date reminders via UserNotifications
As the user, upcoming and overdue invoices notify (app running).
Screens: 08-settings-reminders.png
Acceptance:
- [unit] Schedule math (days-before-due) exact. [self] Probe: 2-min test notification delivered. [manual] Permission prompt shown once.
Depends: S-021
Status: todo

### S-053 CSV export lifeline
As the user, I export invoices+clients+payments as CSV by date range.
Acceptance:
- [self] Export dialog runs on selection; opens in Numbers with correct columns.
- [unit] Decimal values round-trip.
Depends: S-010
Status: todo

### S-054 Basic reports: outstanding / paid / overdue summary
Screens: 09-reports.png
Acceptance:
- [snap] Reports page shows totals by status + aging, matching research bar.
- [unit] Numbers computed as Σ over invoices with Decimal math. [self] Excludes archived (S-044).
Depends: S-022, S-044
Status: todo

### S-055 Empty states + settings polish
Screens: 10-settings.png
Acceptance:
- [snap] Every list has an EmptyStateView with a primary action (created for the look, real in flows).
- [self] Settings cover palette, defaults (terms/due-date mode), data locations, restore-from-backup.
Depends: S-010
Status: todo

---

## Dropped (visible decisions)
- CloudKit/sync — decided: local-first; document versioned-schema exit ramp in platform.md.
- Online payment processing / hosted client portal — no payment processor; share links instead.
- Time tracking, expenses→invoice, late-fee automation, audit log.
- Pricing/licensing changes.

## Seed data
Snapshot pages show what a story creates: seed = 1 company (Lagoon accent), 3 clients (Paid/Due soon/Overdue status coverage), 6 invoices incl. draft+partially-paid+archived, 1 recurring profile, 1 payment each on 2 invoices, 1 estimate. Every seeded attribute must be creatable by a story.

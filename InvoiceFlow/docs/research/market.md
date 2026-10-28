# Market

Research for InvoiceFlow. Done 2026-10-28.
[V] verified in a source, [K] from knowledge, [U] unverified, test first.

Question: what makes the best invoicing app on the Mac?
Decision it informs: what to redesign (UI), re-architect (data/robustness), rebuild in InvoiceFlow's next version.

## Findings

- FreshBooks — Lite $23/mo (5 clients), Plus $43/mo (50), Premium $70/mo (unlimited); web-based; estimates, recurring, late fees, reminders, e-signatures, deposits, payments (cards/ACH/Apple Pay). [V](https://www.freshbooks.com/pricing)
- QuickBooks Online — Free ($0, 2 invoices/mo), Simple Start $38/mo, Essentials $85/mo, Plus $140/mo, Advanced $340/mo; full accounting, not just invoicing. [V](https://quickbooks.intuit.com/pricing/)
- Zoho Invoice — $0 forever free, no ads; invoices, quotes, recurring, reminders, expenses, timesheets, client portal, 30+ reports; native Mac app on the Mac App Store (Catalyst, updated Oct 2026). [V](https://www.zoho.com/invoice/pricing/), [V](https://apps.apple.com/us/app/zoho-invoice-invoicing-app/id1477507499?mt=12)
- Wave — Starter $0: unlimited invoices/estimates/bookkeeping; Pro $19/mo adds auto-late-payment reminders, bank import, receipt capture; payments monetized via 2.9% + fee. [V](https://www.waveapps.com/pricing)
- Harvest — free tier (1 seat, 2 projects, invoicing included), Teams from $11/seat/mo; time-tracking-first, invoices from tracked time; official Mac app download. [V](https://www.getharvest.com/pricing)
- Billings Pro (Marketcircle) — only true native Mac invoicing specialist; Freelance $5/user/mo capped at 5 invoices/estimates/statements; Professional $10/user/mo unlimited; estimates→invoice, time tracking, projects. [V](https://www.marketcircle.com/billingspro/pricing/)
- Invoice Simple — Essentials $6.99/mo (3 invoices/mo), Plus $14.99 (10), Premium $21.99 (unlimited); UX headline features: client/item autofill, read receipts, signature, reminders. iOS-first + web; no native Mac app. [V](https://www.invoicesimple.com/pricing-packages/)

## Market table

| App | Price (US) | Platform | Headline features |
|---|---|---|---|
| FreshBooks | $23–70/mo | Web + mobile | Recurring, reminders, late fees, payments, client caps |
| QuickBooks | $0–340/mo | Web | Full accounting, batch invoicing, AI features |
| Zoho Invoice | $0 | Native Mac (Catalyst) + iOS + web | Free, portal, templates, 30+ reports |
| Wave | $0 / $19/mo | Web + mobile | Unlimited invoices free, reminders (Pro) |
| Harvest | $0–14+/seat | Mac app + web | Time→invoice pipeline, estimates |
| Billings Pro | $5–10/user/mo | Native Mac + iOS | Estimates, time tracking, invoice caps at low tier |
| Invoice Simple | $7–22/mo | iOS + web | Autofill, read receipts, invoice-count caps |

## Decisions

1. Target the **native, local-first, offline-privacy niche** — every web competitor is online-first and every "free" one monetizes payments; InvoiceFlow's data-ownership + backup/export story is the unoccupied slot. [V from market table above]
2. The invoice **lifecycle beyond creation is the standard feature bar**: estimates, recurring, reminders, status/payment tracking, client/item libraries with autofill. InvoiceFlow's create+PDF core must add these to be credible. [V]
3. Price/cap structure: if InvoiceFlow ever charges, competitors cap features at low tiers — avoid invoice-count caps (the most resented cap pattern). [V]

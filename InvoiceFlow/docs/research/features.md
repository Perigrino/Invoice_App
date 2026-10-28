# Features

Research for InvoiceFlow. Done 2026-10-28.
[V] verified in a source, [K] from knowledge, [U] unverified, test first.

Question: what is the full feature surface of the leading invoicing tools?
Decision it informs: what to redesign (UI), re-architect (data/robustness), rebuild in InvoiceFlow's next version.

Leaders chosen: FreshBooks, QuickBooks Online, Zoho Invoice; Invoice Simple as light end. Zoho favored for feature depth (portal, projects, 30+ reports) [V](https://www.zoho.com/us/invoice/features/).

## Findings

- Estimates→invoices: all three convert estimates preserving line items. [V](https://quickbooks.intuit.com/accounting/invoicing/)
- Progress/partial billing: QBO progress invoicing splits an estimate into multiple invoices, auto-tracks paid vs owed per estimate. [V](https://quickbooks.intuit.com/learn-support/en-us/help-article/invoicing/set-send-progress-invoices-quickbooks-online/L0Ymm6WjR_US_en_US) Zoho portal supports partial/bulk payments [V]; FreshBooks deposits only, no multi-stage progress [K].
- Recurring: all three [V]; Zoho adds scheduled one-off future sends + auto-charge [V]; FreshBooks card-on-file auto-charge [V](https://www.freshbooks.com/invoice).
- Reminders/late fees: FreshBooks automates reminders + late fees [V]; Zoho automated reminders [V]; QBO reminders with AI-drafted nudges [V]; auto late fees unverified [U].
- Client portal: Zoho full portal (view/accept quotes, pay, timesheets, feedback) [V]; FreshBooks/QBO shareable invoice links only [K].
- Payments: QBO cards/ACH/Apple Pay/PayPal/Venmo [V]; FreshBooks cards/ACH/Apple Pay/Google Pay/BNPL [V]; Zoho 10+ gateways, credit-note refunds, offline payment recording [V].
- Time & expenses→invoice: all three [V]; one-click billing of unbilled hours (Zoho/FreshBooks) [V].
- Taxes: Zoho tax-compliant PDFs with breakdown [V]; FreshBooks auto tax calc [V]; QBO sales tax AI (Plus) [V].
- Multi-currency: QBO 100+ (Plus/Advanced) [V](https://worksbuddy.ai/blogs/what-are-the-best-multi-currency-invoicing-software-options-for-international-businesses); FreshBooks marketed but gaps reported [U](https://tech.co/accounting-software/freshbooks-pricing); Zoho supported [K].
- Templates/branding: Zoho template gallery + per-contact assignment + item-table styling [V]; FreshBooks logo/fonts/colors [V]; QBO templates + AI generator [V].
- Reports: Zoho ~30 + Analytics [V]; QBO tiered from P&L to custom dashboards [V]; FreshBooks financial reports [V].
- Backup: QBO Advanced data backup/restore only [V]; web-native tools don't emphasize export [U]. None promote full local export — differentiation for InvoiceFlow's backups. [K]

## Feature matrix

| Feature | FreshBooks | QBO | Zoho | Invoice Simple | Version one? |
|---|---|---|---|---|---|
| Estimate→invoice | ● | ● | ● | ● | Yes — natural next module |
| Partial/progress billing | ◐ deposits | ● | ◐ portal | ◐ deposits | Yes — payment records at minimum |
| Recurring invoices | ● | ● | ● | ◐ | Yes |
| Reminders / late fees | ● / ● | ● / U | ● / — | ● / — | Reminders yes; late fees later |
| Client portal | — | — | ● | — | No (native app; shareable links instead) |
| Online payments | ● | ● | ● | ● | No (no payment processor; "mark paid" recording only) |
| Time tracking | ● | ◐ | ● | — | No |
| Expenses→invoice | ● | ● | ● | — | No |
| VAT/GST configs | ● | ● | ● | — | Yes (multi-tax line items) |
| Multi-currency | ◐ U | ● | ● | no [K] | Partial (currency per invoice/company) |
| Templates/branding | ● | ● | ● | ● | Yes (PDF template variants) |
| Reports | ● | ● | ● | ◐ | Basic (outstanding/paid/overdue summary) |
| Client/item libraries + autofill | ● | ● | ● | ● | Yes |

## Decisions

1. **Re-architect data around a payment chain, not status flags**: invoices must hold payment records, partial balances, and estimate→N-invoice progress with automatic remaining math. This is QBO's core moat and InvoiceFlow's biggest gap. [V](QBO progress invoicing page)
2. **Rebuild recurring semantics**: recurring profiles are generator templates (schedule + options), never copies. [V]
3. **Redesign for the client-facing surface**: branded templates with per-client assignment, rich PDF, shareable links; skip a hosted portal. [V](Zoho features)

# Design

Research for InvoiceFlow. Done 2026-10-28.
[V] verified in a source, [K] from knowledge, [U] unverified, test first.

Question: how are the screens, interactions, and keyboard shortcuts of leading invoicing apps designed?
Decision it informs: what to redesign (UI), re-architect (data/robustness), rebuild in InvoiceFlow's next version.

## Findings

FreshBooks [V](https://support.freshbooks.com/hc/en-us/articles/216631328-How-do-I-create-an-invoice):
- Invoice editor = single scrolling form: business info → Billed To client (in-place edit/create) → issue date → due date (modes: on date of issue / after x days / custom; **terms remembered from last invoice**) → reference/PO → auto-computed Amount Due.
- Line items: "Add a Line" offers import unbilled time/expenses, pick existing item, or create new; drag handle left, trash right; up to 2 taxes per line.
- Totals zone: add discount (flat/%), apply credit, request deposit, payment schedule (instalments).
- Per-invoice settings: accept partial payments, style (template/logo/color/font), make recurring; notes not remembered.
- Statuses: Draft, Sent, Viewed, Outstanding, Overdue, Partially Paid, Paid, Disputed, Auto-Paid. [V](same help center)
- List-as-hub: [V](https://support.freshbooks.com/hc/en-us/articles/4404632032013) hover row reveals quick actions (edit, duplicate, add payment, "…"); checkboxes + bulk actions (print ≤50, mark sent ≤150, payment ≤30); archive vs delete-with-recovery; CSV export; audit log.
- Dashboard: widget grid, user-configurable (Edit Dashboard): Create New… button first; Outstanding Invoices (overdue/outstanding bars + accounts aging with click-through filters); P&L; revenue by client. [V](https://support.freshbooks.com/hc/en-us/articles/115015407988)
- Shortcuts: Shift+? opens help menu; Shift+I invoices, Shift+Space+I new invoice; Section+Space per section. [V](https://support.freshbooks.com/hc/en-us/articles/360033786391)

MoneyWorks (Mac-native, Cocoa) [V](https://www.cognito.co.nz/manual/moneyworks_debtors_entering_sales_invoices.html):
- ⌘N from transaction list opens invoice entry; sequential invoice number auto-assigned; Tab trades validation/choices lists (type-ahead debtor lookup, double-click select; unknown code → create record on the fly); Ctrl-Tab jumps to first detail line; keypad-Enter = save + keep entering ("Next").
- Due date auto-derived from per-debtor payment terms, overridable; auto-total from detail lines.
- Navigator = task-oriented home ("Day-to-day" view); transactions as customizable filterable list windows. [V](https://www.cognito.co.nz)
- Single-document database: "one MoneyWorks file — easy to back up, copy, clone, roll back"; configurable daily/weekly/monthly backup prompts. [V](https://www.cognito.co.nz/manual/...backing_up...) — the backup/robustness model worth borrowing.

QuickBooks Online [K]/[U — help center unreachable; test against a live account]: left-nav; single-page invoice editor with customer chooser + recent transactions, item grid, footer totals, "Save and send"/"Preview & PDF"; blue "Add" CTA bottom-center; statuses Paid/Open/Partially paid/Due/Overdue.

Invoice Simple [U — site unreachable]: mobile-first single-screen editor with template preview; weak Mac-native benchmark.

## Decisions

1. **Invoice editor as one scrolling form with a payment-adjustments block** (discount/credit/deposit/schedule) and **remembered defaults** (terms, due-date mode, per-client settings) — FreshBooks' pattern; beats a wizard. [V]
2. **List-as-hub pattern**: invoice/client lists carry hover quick actions, bulk actions with caps, archive-vs-delete semantics, and status→filtered-list click-through. This is the interaction backbone. [V]
3. Adopt MoneyWorks' Mac-native differentiators: ⌘N keyboard-first entry, Tab-driven record lookup with create-on-the-fly, sequential numbering, single-document backup/rollback model. [V]
4. Fit to our shipped prototype: the existing `prototype/index.html` (glass cards, dark-first, sidebar 214px, status washes, days-to-due tile) already matches the direction; add hover quick actions, keyboard entry, and a dashboard/hub screen that the prototype lacks. [K]

# InvoiceFlow Changelog

## 2.4.0 — 2026-11-01

### Fixes
- **Selection UI colors fixed** — Removed native `List(selection:)` that painted blue/gray rim behind glass cards; rows are now Buttons with custom pill chrome only
- **Invoice rows click-to-open** — Single click on any invoice row opens its detail sheet (was: click only selected, did nothing)
- **Client rows click-to-open** — Single click opens editor
- **"Draft" tile removed** — Invoices without a due date now show neutral "No due" tile instead of claiming "Draft" status
- **Dashboard page removed** — Per user request; app lands on Invoices tab
- **Tokens page removed** — Palette stays at saved/default Lagoon; no in-app switcher needed

### Optimizations
- Eliminated system selection highlight bleed-through across all lists (sidebar, invoices, clients)
- Removed multi-select state and associated header Export button from invoice list
- Simplified `InvoiceRow` and `ClientRow` by dropping `isSelected` prop and selection animations

### Tests
- 53/53 tests green (added: click-to-open-detail test, sidebar tab set test)
- Zero references to DashboardView, TokensPage, or list-selection machinery

### Version
- MARKETING_VERSION 2.4.0, CURRENT_PROJECT_VERSION 5
- Universal DMG (arm64 + x86_64), ad-hoc signed
- Installed to /Applications and verified
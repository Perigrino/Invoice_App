# InvoiceFlow Changelog

## 2.5.0 — 2026-11-05

### PDF Export
- **PDF files 200× smaller**: ~14 MB → 60–100 KB via native `CGPDFContext` + Core Text instead of `ImageRenderer` bitmap (layout, colors, fonts, padding, copy, grain unchanged)
- **Text is selectable, searchable, and editable**
- **Single dashed row separator** in item list (was rendering as double broken text line from `"- "` repeated via Core Text)
- Paper grain: one tiled XObject, deterministic seed `0x5EED_2026` (SplitMix64); logo ≤600 px, JPEG 0.8 (PNG if alpha)
- New: `InvoiceFlowTests.PDFExportTests` (5 tests: size cap, selectable text, no full-page image, PDFKit round-trip, 1 page per paper size)

### Invoices List
- **Status filter chips removed**
- **"No Due" badge removed** (muted tile now shows no text)
- **Countdown tile replaced with initials avatar** (36 px, client tint, mirrors ClientList avatar; no calendar icon, no rounded-square perimeter)

### Invoice Detail
- **Add Payment button, payments section, and payment sheet removed** (detail now: Balance hero, Bill To/Dates, item table + totals, notes)

### Clients List
- **Amount due pill removed**

### Version
- MARKETING_VERSION 2.5.0, CURRENT_PROJECT_VERSION 6
- Universal DMG (arm64 + x86_64), ad-hoc signed
- Full `InvoiceFlowTests` suite passes; PDF export tests gate on size and text selectable

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

### PDF Export
- Reduced exported PDF size from ~14 MB to ~60–100 KB by replacing `ImageRenderer` bitmap export with native `CGPDFContext` + Core Text rendering
- Made PDF text selectable, searchable, and editable in other PDF editors
- Preserved exact layout (no changes to theme values, colors, fonts, padding, or copy)
- Added deterministic paper-grain texture (tiled XObject, seeded SplitMix64) to avoid re‑rolling on each render
- Logo down‑scaled to ≤600 px, re‑encoded as JPEG 0.8 when source is opaque

### Tests
- 53/53 tests green (added PDF export tests: selectable‑text gate, size cap, no full‑page image, PDFKit round‑trip, all paper sizes = one page)

### Tests
- 53/53 tests green (added: click-to-open-detail test, sidebar tab set test)
- Zero references to DashboardView, TokensPage, or list-selection machinery

### Version
- MARKETING_VERSION 2.4.0, CURRENT_PROJECT_VERSION 5
- Universal DMG (arm64 + x86_64), ad-hoc signed
- Installed to /Applications and verified
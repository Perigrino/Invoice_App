# InvoiceFlow — Redesign Prototype

**Nothing here is implemented in the app.** This folder is a throwaway visual prototype so we can
judge the redesign before writing any Swift.

## What this is

`index.html` — a single, self-contained mock of InvoiceFlow after adopting the **Airpisode design
system** (near-black canvas with two accent corner glows, glass cards, capsule chips, Silk motion),
with **InvoiceFlow's own gradient palette instead of Airpisode's purple → magenta**.

- No build step, no dependencies, no CDNs. Open the file directly.
- Open from Finder, or: `open prototype/index.html`

## How to drive it

| Action | How |
|---|---|
| Switch sections | **Left sidebar** — Invoices / Clients / Settings / Welcome / Empty state (or keys `1` `2` `3`) |
| Open detail / form | Click any invoice or client row, or "New Invoice" |
| Go back | `Esc`, or the "Back" button |
| **Light / dark** | Sun-or-moon button in the title bar (also the "Dark mode" toggle in Settings → General) |
| Gradient palette | The 5 dots in the title bar, or the palette cards in the tokens overlay |
| Design tokens | Sparkle button in the title bar |
| Settings tabs | Profile / Invoice / Currency / General capsules |
| Toggle switches & chips | Click them — cosmetic only |

Three things are intentionally **independent**: the section you're on, the gradient palette, and the
theme. Any palette works in either theme.

## Design decisions

**Own gradient, not Airpisode's.** Airpisode is `#996BF2 → #D959D9` (purple → magenta). InvoiceFlow
ships its own five, all deliberately far from that hue range — Lagoon (default), Cobalt, Citrus,
Ember, Bloom. The canvas glows, hero card, status tiles, focus rings and shadows all derive from the
selected accent pair, so switching palettes recolours the whole UI.

**Nav stays on the left.** The sidebar keeps the app's current position and role
(`NavigationSplitView` equivalent) at 214 px — only its surface treatment changes.

**App icon untouched.** The prototype loads the real `Assets.xcassets/AppIcon.appiconset` PNGs and
does not redraw the mark. Icon is a green document glyph (`#059669`, the existing `brandPrimary`) on
a transparent ground, so it reads correctly in both themes.

**Both themes ship.** Dark is the default (matches the app's `Setting.darkMode = true`). Light is a
token-only override — same layout, same components, same palettes; only surfaces, text, separators,
shadows and the canvas-glow strength change. Glows drop from 22% / 16% to 15% / 11% so the light
canvas stays a wash rather than a colour block.

## Mapping: Airpisode → InvoiceFlow

| Airpisode | InvoiceFlow |
|---|---|
| `Theme.canvas` (black + 2 radial glows) | Window background — same two positions (upper-left, lower-right), themed strength |
| `cardBackground(cornerRadius:14)` | `.card` — translucent fill + top-highlight hairline (`.14 → .02` dark, dark-hairline in light) |
| `Chip` | Filter chips, status pills, picker chips |
| `CountdownText` gradient tile | Days-to-due tile (`3 / Days`, `2 / Late`) |
| `PosterTint` derived wash | Deterministic hue per **client name** on list rows + avatars |
| `Motion.silk` / `.appear()` / `.hoverLift()` | `quick` 280 ms, `smooth` 450 ms, `gentle` 600 ms, 12 px fade-up, hover scale 1.006 |
| `PageHeader` | Every screen header (26 pt bold + subtitle) |
| `DockBar` floating nav | **Not used** — the left sidebar is kept instead |

### Structure kept from `Theme.swift`

| Token | Dark | Light |
|---|---|---|
| card radius | `14` (large `16`) | same |
| accent / accentMagenta | set by the palette switcher | same |
| card fill | white `.05` | white `.78` on a `#F4F5F7` window |
| chip / hairline | white `.08` / `.08` | black `.05` / `.09` |
| text / secondary / muted | `#fff` / white `.70` / white `.45` | `#0C0D10` / black `.66` / black `.45` |
| canvas glows | accent 22% + magenta 16% | accent 15% + magenta 11% |

### Status colours — the one addition

Airpisode has no status system, so these are new. They are deliberately desaturated and applied as a
tinted *wash* on a row (never a solid block), matching the `PosterTint.swift` comment
"deliberately understated — a wash, not a colour block". Each theme gets its own values so they hold
contrast on both backgrounds.

| State | Dark | Light |
|---|---|---|
| Paid | `#63C79E` | `#1E9E6A` |
| Due soon | `#E2B45F` | `#A97A15` |
| Overdue | `#E2786F` | `#C0433A` |

## Screens prototyped

Invoices (list + filters + status washes) · Invoice detail (gradient balance hero, line items,
totals) · Invoice form (line-item grid, live totals) · Clients (list with tinted avatars) ·
Client form · Settings (4 tabs) · Landing / onboarding · Empty state.

## Not included

- Real data, persistence, PDF generation or any PDF layout changes.
- Any edit to `InvoiceFlow/InvoiceFlow/**`. The Xcode project uses explicit file references only
  (no `fileSystemSynchronizedGroups`), so this folder cannot affect the build either way.

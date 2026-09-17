# Invoice Template Redesign — Implementation Plan

## Overview

Reducing from 4 templates to 2 (Dark & Light) with accent color customization.

---

## 1. Changes to PDFTemplate.swift

**Before:**
```swift
enum PDFTemplate: String, CaseIterable, Identifiable {
    case modern
    case business
    case minimal
    case professional
}
```

**After:**
```swift
enum PDFTemplate: String, CaseIterable, Identifiable {
    case dark
    case light

    var displayName: String {
        switch self {
        case .dark: return "Dark"
        case .light: return "Light"
        }
    }
}
```

---

## 2. Changes to PDFGenerator.swift

Replace all 4 themes (ModernTheme, BusinessTheme, MinimalTheme, ProfessionalTheme) with:

### DarkTheme
- Background: `#0d0d14` (near black)
- Primary text: `#999999` (muted gray)
- Company name/bold text: `#dddddd`
- Accent color: User-configurable (default blue `#60a5fa`)
- Monospace font throughout
- Dashed borders
- Bracket-style labels: `[ From ]`, `[ Bill to ]`

### LightTheme
- Background: `#fafafa` (off-white)
- Primary text: `#555555` (dark gray)
- Company name/bold text: `#111111`
- Accent color: User-configurable (default blue `#2563eb`)
- Same monospace font and layout as Dark

### Shared Components (keep)
- `BigLogo` → Update to use accent color for icon border
- `StyledTable` → Simplify to 4 columns (Description, Qty, Price, Amount)
- `StyledTotals` → Update to show Subtotal, Discount, Total due
- `NotesBox` → Remove title, just show text

---

## 3. Changes to PDFExportView.swift

### New State Variable
```swift
@State private var accentColor: Color = .blue
```

### New UI Element — Accent Color Picker
Add to the `topBar` or a new "Style" section:

```swift
// In the edit panel, add a new section:
section("Style") {
    HStack {
        Text("Accent Color").frame(width: 100)
        ColorPicker("", selection: $accentColor)
            .labelsHidden()
    }
}
```

### Convert Color to Hex
Add helper function:
```swift
private func colorToHex(_ color: Color) -> String {
    let nsColor = NSColor(color)
    var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
    nsColor.getRed(&r, green: &g, blue: &b, alpha: &a)
    return String(format: "#%02X%02X%02X", Int(r*255), Int(g*255), Int(b*255))
}
```

### Update buildPDFData()
Pass accent color hex to `InvoiceRenderData`:
```swift
accentHex: colorToHex(accentColor),
```

---

## 4. Template Preview in Picker

| Template | Preview Description |
|----------|---------------------|
| **Dark** | Terminal-style, dark background, blue accents |
| **Light** | Terminal-style, light background, blue accents |

---

## 5. Data Flow

```
User picks accent color → accentColor state
        ↓
buildPDFData() → colorToHex(accentColor) → accentHex
        ↓
PDFGenerator.generatePDF() → passes to Theme
        ↓
DarkTheme/LightTheme uses accentHex for:
  - Logo icon border
  - Section brackets [ From ] [ Bill to ]
  - Accent line separator
  - Total due highlight
  - Header label [ Invoice — $X ]
```

---

## 6. Files to Modify

| File | Changes |
|------|---------|
| `PDFTemplate.swift` | 2 cases: dark, light |
| `PDFGenerator.swift` | 2 themes: DarkTheme, LightTheme |
| `PDFExportView.swift` | Add accent color picker, update template picker |
| `SettingsView.swift` | Update template picker options |

---

## 7. What Stays the Same

- Monospace font (JetBrains Mono / SF Mono)
- Terminal aesthetic with dashed borders
- Bracket-style labels
- Table structure (Description, Qty, Price, Amount)
- Totals section (Subtotal, Discount, Total due)
- Notes section (text only, no title)
- Logo placement

---

## Questions for You

1. **Accent color picker location** — Should it be in the top bar (next to template picker) or in the edit panel under a "Style" section? yes

2. **Default accent color** — Blue (`#2563eb`) or do you prefer a different default? blue as default is fine

3. **Should the accent color also apply to the template picker buttons?** (e.g., selected template shows in accent color) yes

4. **Any other elements you want customizable?** (e.g., font size, border style)
yes we should be able to customize the font size, border style, font

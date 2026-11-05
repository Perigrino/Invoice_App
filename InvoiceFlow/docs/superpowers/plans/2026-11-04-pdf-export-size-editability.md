# PDF Export: Small + Editable Without Changing the Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exported invoice PDFs drop from ~14 MB to <200 KB and contain real text (selectable, copyable, searchable), with the on-screen layout unchanged.

**Architecture:** Replace the `ImageRenderer` → full-page-bitmap path with a native `CGPDFContext` renderer driven by the existing `InvoiceRenderData`. Text is drawn with Core Text (`CTFramesetter`/`CTFrameDraw`) so it becomes real PDF text with embedded font subsets. Background, rules and table boxes are vector paths. The paper-grain tile and the logo are each embedded once as an image XObject. The PDFKit preview already displays the generated PDF, so preview == export by construction.

**Tech Stack:** Swift 6, SwiftUI, AppKit, Core Graphics, Core Text, PDFKit, XCTest. No new dependencies.

**Status:** diagnosis complete; implementation not started. Amended 2026-11-05 to keep the paper-grain texture (tiled image XObject) and to make the grain deterministic so the pixel-diff gate is meaningful.

## Global Constraints

- macOS 14+ deployment target; universal binary.
- App target only. Do **not** touch the Next.js PDF route (`src/lib/pdf/*`), which already emits vector PDFs.
- Do **not** change any layout value, color, font size, padding, number or copy string from `DarkTheme`/`LightTheme` in `InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift`.
- Do **not** add dependencies, settings UI, compression options, metadata options, or new templates.
- `PDFGenerator.generatePDF(for:template:paperSize:) -> URL?` keeps its exact signature — `PDFExportView.swift:407` and any other caller stay unchanged.
- Keep `InvoiceRenderData`, `InvoiceRenderLineItem`, `PDFPageSpec`, `PDFTemplate`, `DateFormatHelper`, `CurrencyFormatter`, `Color(hex:)` unchanged.
- Every task ends with a green build: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow build` from `/Users/perigrino/Projects/Invoice_App/InvoiceFlow`.
- Tests: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow test -only-testing:InvoiceFlowTests`.

## Why the file is huge and not editable (measured, not guessed)

Spike: `tmp-pdf-spike/` renders the real `InvoicePDFView` (`DarkTheme`/`LightTheme`) through every candidate API and audits the output with PDFKit + content-stream inspection.

| Path | 6-item invoice | Text objects | Page content |
|---|---|---|---|
| **Shipped code** (`HEAD`, DMG 2.4.0): `ImageRenderer` at 12–16× → bitmap → `context.draw(cgImage:)` | **1.75 MB** (24 items: 2.26 MB; photographic logo + grain: up to ~14 MB) | **0 chars** | 1 full-page image XObject |
| Uncommitted "vector" attempt: `NSHostingView.draw` into PDF context | **816 B** | 0 chars | **blank page** |
| `NSView.dataWithPDF(inside:)` | 8.0 KB | 11 chars | 2 text runs only |
| `NSPrintOperation` (+ zero margins) | 8.0 KB | 11 chars | 2 text runs only |
| `NSPrintOperation` from a hosted window | 852 B | 0 chars | blank |
| `hostingView.layer.render(in:)` | 14 KB | 0 chars | 8 image XObjects |

Two independent causes:

1. **Size:** a 12–16× raster of an A4 page is ~7,100 × 10,100 px. The PDF stores one compressed bitmap of the whole page, so size scales with pixel detail. A photographic/gradient logo rides along at full resolution, and `NoiseTexture` (a 256×256 random tile at density 8000) adds high-entropy pixels that defeat Flate.
2. **Not editable:** the page contains no text operators at all (`Tj`/`TJ` = 0, `/Font` = 0, one `/Subtype /Image`). Editors treat it as a scanned page and offer OCR instead of text selection.

**Conclusion:** SwiftUI cannot export itself as a real PDF (the only "vector" attempts render blank or lose almost all content). Draw the page natively into `CGPDFContext` from `InvoiceRenderData`. The PDFKit preview renders that file, so there is no second layout to drift from.

## Layout reference (copied verbatim from the shipped SwiftUI themes)

Dark palette: bg `(0.051, 0.051, 0.078)`, text `(0.6, 0.6, 0.6)`, bold `(0.87, 0.87, 0.87)`, border `(0.13, 0.13, 0.13)`, grain dot white @ 0.06 alpha, grain opacity 0.35, blend `.screen`, table background `secondary @ 0.2`.
Light palette: bg `(0.98, 0.98, 0.98)`, text `(0.33, 0.33, 0.33)`, bold `(0.07, 0.07, 0.07)`, border `(0.82, 0.82, 0.82)`, grain dot black @ 0.05 alpha, grain opacity 0.35, blend `.multiply`, table background `secondary @ 0.15`.

Vertical rhythm (top → bottom):

| Block | Values |
|---|---|
| Header label (centered, `[ Type — Total ]`) | font `sz+1` medium, top padding 24, bottom padding 20 |
| Logo + ref rows | logo height 90, max width 280; ref rows right-aligned, spacing 4; horizontal padding 36 |
| Accent line | 1 pt, `accent @ 0.4`, horizontal padding 36, vertical padding 20 |
| From / Bill to | two columns, spacing 200, horizontal padding 36, top padding 8 |
| Accent line | same as above |
| Table header | Description flex, Qty 70 trailing, Spacer, Unit price 130 trailing, Spacer, Amount 130 trailing; font `sz` medium; vertical padding 6, inner horizontal padding 12, outer 36; background secondary (0.2 dark / 0.15 light) |
| Dashed separator | `"- "` × 70 at 9 pt, line limit 1, horizontal padding 36 |
| Each row | same columns; vertical padding 8, horizontal padding 48; `"—"` when description empty |
| Totals | right-aligned; Subtotal, optional Discount (red), 180 pt divider, Total (`sz+1` bold) + amount (`sz+2` bold) in accent; horizontal padding 36, top padding 16 |
| Notes | centered, font `sz-0.5`, line spacing 4, horizontal padding 36, top 32, bottom 24 |

Row/column math for a row: content width = `pageWidth - 2*48`. Fixed columns = 70 + 130 + 130. The remaining width is split evenly across the three flexible children (description + two spacers), so `flex = (contentWidth - 330) / 3`, description spans `[x0, x0+flex]`, then Qty, then a `flex` spacer, then Unit price, then a `flex` spacer, then Amount. The table header uses the same math with content width `pageWidth - 2*36 - 2*12` and origin `36 + 12`. The parity gate verifies this model; adjust the math there, never the thresholds.

## File structure

| File | Responsibility |
|---|---|
| `InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift` (modify in place) | Models stay. Add `PDFStyle`, `PDFPalette`, `PDFGrainTile`, `PDFCanvas`, `InvoicePDFRenderer`. Keep the legacy raster path behind a clearly marked function until Task 8 passes. |
| `InvoiceFlow/InvoiceFlow/InvoiceFlowTests/PDFExportTests.swift` (create) | Text, size, structure, and paper-size gates. |
| `InvoiceFlow/InvoiceFlow.xcodeproj/project.pbxproj` (modify) | Register the new test file only (4 entries). |
| `tmp-pdf-spike/parity/main.swift` (create) | Pixel-diff parity harness (dev only, not shipped). |

No new app source files: the renderer lives in the existing `PDFGenerator.swift`, so there is no app-target `project.pbxproj` surgery and the whole change is one revertible file.

### Task 1: Deterministic grain tile shared by both paths

**Files:**
- Modify: `InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift:621-661`

**Interfaces:**
- Produces: `PDFGrainTile.image(dot: NSColor, density: Int, seed: UInt64) -> CGImage?`
- Consumes: nothing.

- [ ] **Step 1: Add the seeded generator and tile factory** above `NoiseTexture`.

```swift
enum PDFGrainTile {
    struct SplitMix64: RandomNumberGenerator {
        private var state: UInt64
        init(seed: UInt64) { state = seed }
        mutating func next() -> UInt64 {
            state &+= 0x9E37_79B9_7F4A_7C15
            var z = state
            z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
            z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
            return z ^ (z >> 31)
        }
    }

    static func image(dot: NSColor, density: Int, seed: UInt64 = 0x5EED_2026) -> CGImage? {
        let side = 256
        guard let context = CGContext(
            data: nil, width: side, height: side,
            bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        context.setFillColor(dot.usingColorSpace(.deviceRGB)?.cgColor ?? CGColor(gray: 0, alpha: 0))
        var rng = SplitMix64(seed: seed)
        for _ in 0..<density {
            let x = CGFloat.random(in: 0..<CGFloat(side), using: &rng).rounded(.down)
            let y = CGFloat.random(in: 0..<CGFloat(side), using: &rng).rounded(.down)
            context.fill(CGRect(x: x, y: y, width: 1, height: 1))
        }
        return context.makeImage()
    }
}
```

- [ ] **Step 2: Route `NoiseTexture.tile` through it**

Replace the body of `NoiseTexture.tile(density:color:)` with:

```swift
private static func tile(density: Int, color: Color) -> NSImage? {
    let side: CGFloat = 256
    let dot = NSColor(color)
    guard let cgImage = PDFGrainTile.image(dot: dot, density: density) else { return nil }
    return NSImage(cgImage: cgImage, size: NSSize(width: side, height: side))
}
```

- [ ] **Step 3: Build**

Run: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow build`
Expected: BUILD SUCCEEDED. The preview grain is visually identical and no longer changes on every keystroke.

- [ ] **Step 4: Commit**

```bash
git add InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift
git commit -m "refactor(pdf): make paper grain deterministic and reusable"
```

### Task 2: Layout constants and palette

**Files:**
- Modify: `InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift` (insert after `PDFPageSpec`)

**Interfaces:**
- Produces: `PDFStyle` with `pageHeight(for:paperSize:)`, `font(size:weight:family:)`, `palette(template:)`; `PDFPalette` with `background/text/bold/border/accent/secondary/grainDot/grainOpacity/grainBlend`.
- Consumes: `PDFPageSpec`, `InvoiceRenderData`, `PDFTemplate`, `Color(hex:)`.

- [ ] **Step 1: Add `PDFStyle` and `PDFPalette`**

```swift
struct PDFPalette {
    let background: CGColor
    let text: NSColor
    let bold: NSColor
    let border: CGColor
    let accent: NSColor
    let secondary: NSColor
    let grainDot: NSColor
    let grainOpacity: CGFloat
    let grainBlend: CGBlendMode
    let tableTint: CGFloat
}

struct PDFStyle {
    static let margin: CGFloat = 36
    static let rowInset: CGFloat = 48
    static let tableHeaderInset: CGFloat = 12
    static let qtyWidth: CGFloat = 70
    static let moneyWidth: CGFloat = 130
    static let logoHeight: CGFloat = 90
    static let logoMaxWidth: CGFloat = 280

    static func pageHeight(for data: InvoiceRenderData, paperSize: String) -> CGFloat {
        let base = PDFPageSpec.size(for: paperSize).height
        let tableHeight = CGFloat(max(data.lineItems.count, 1)) * 22 + 40
        return max(base, 280 + tableHeight + 100 + 140)
    }

    static func font(size: CGFloat, weight: NSFont.Weight = .regular, family: String) -> NSFont {
        let base = NSFont(name: family, size: size)
            ?? NSFont.monospacedSystemFont(ofSize: size, weight: weight)
        guard weight.rawValue >= NSFont.Weight.semibold.rawValue else { return base }
        let traits: [NSFontDescriptor.TraitKey: Any] = [
            .symbolic: NSFontDescriptor.SymbolicTraits.monoSpace.rawValue
                | NSFontDescriptor.SymbolicTraits.bold.rawValue
        ]
        let descriptor = base.fontDescriptor.addingAttributes([.traits: traits])
        return NSFont(descriptor: descriptor, size: size) ?? base
    }

    static func palette(template: PDFTemplate, accentHex: String, secondaryHex: String) -> PDFPalette {
        let accent = NSColor(hex: accentHex)
        let secondary = NSColor(hex: secondaryHex)
        switch template {
        case .dark:
            return PDFPalette(
                background: CGColor(red: 0.051, green: 0.051, blue: 0.078, alpha: 1),
                text: NSColor(red: 0.6, green: 0.6, blue: 0.6, alpha: 1),
                bold: NSColor(red: 0.87, green: 0.87, blue: 0.87, alpha: 1),
                border: CGColor(red: 0.13, green: 0.13, blue: 0.13, alpha: 1),
                accent: accent, secondary: secondary,
                grainDot: NSColor.white.withAlphaComponent(0.06),
                grainOpacity: 0.35, grainBlend: .screen, tableTint: 0.2
            )
        case .light:
            return PDFPalette(
                background: CGColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 1),
                text: NSColor(red: 0.33, green: 0.33, blue: 0.33, alpha: 1),
                bold: NSColor(red: 0.07, green: 0.07, blue: 0.07, alpha: 1),
                border: CGColor(red: 0.82, green: 0.82, blue: 0.82, alpha: 1),
                accent: accent, secondary: secondary,
                grainDot: NSColor.black.withAlphaComponent(0.05),
                grainOpacity: 0.35, grainBlend: .multiply, tableTint: 0.15
            )
        }
    }
}

extension NSColor {
    convenience init(hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        let value = UInt64(cleaned, radix: 16) ?? 0x60A5FA
        self.init(
            red: CGFloat((value >> 16) & 0xFF) / 255,
            green: CGFloat((value >> 8) & 0xFF) / 255,
            blue: CGFloat(value & 0xFF) / 255,
            alpha: 1
        )
    }
}
```

- [ ] **Step 2: Build**

Run: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow build`
Expected: BUILD SUCCEEDED (types unused so far; warnings are fine).

- [ ] **Step 3: Commit**

```bash
git add InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift
git commit -m "feat(pdf): add native PDF style constants and palette"
```

### Task 3: Canvas and Core Text primitives

**Files:**
- Modify: `InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift`

**Interfaces:**
- Produces: `PDFCanvas` with `pageWidth/pageHeight`, `rect(x:top:width:height:)`, `fill(_:color:)`, `strokeLine(from:to:color:width:)`, `text(_:font:color:x:top:width:alignment:lineSpacing:) -> CGFloat`, `height(of:font:width:) -> CGFloat`, `image(_:x:top:width:height:)`.
- Consumes: `CGContext`.

- [ ] **Step 1: Add `PDFCanvas`** (top-left coordinates; converts to PDF's bottom-left at draw time)

```swift
struct PDFCanvas {
    let context: CGContext
    let pageWidth: CGFloat
    let pageHeight: CGFloat

    func rect(x: CGFloat, top: CGFloat, width: CGFloat, height: CGFloat) -> CGRect {
        CGRect(x: x, y: pageHeight - top - height, width: width, height: height)
    }

    func fill(x: CGFloat, top: CGFloat, width: CGFloat, height: CGFloat, color: CGColor) {
        context.setFillColor(color)
        context.fill(rect(x: x, top: top, width: width, height: height))
    }

    func strokeLine(x1: CGFloat, top1: CGFloat, x2: CGFloat, top2: CGFloat, color: CGColor, width: CGFloat = 1) {
        context.setStrokeColor(color)
        context.setLineWidth(width)
        context.move(to: CGPoint(x: x1, y: pageHeight - top1))
        context.addLine(to: CGPoint(x: x2, y: pageHeight - top2))
        context.strokePath()
    }

    @discardableResult
    func text(
        _ string: String,
        font: NSFont,
        color: NSColor,
        x: CGFloat,
        top: CGFloat,
        width: CGFloat,
        alignment: NSTextAlignment = .left,
        lineSpacing: CGFloat = 0
    ) -> CGFloat {
        guard !string.isEmpty else { return 0 }
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = alignment
        paragraph.lineSpacing = lineSpacing
        let attributed = NSAttributedString(string: string, attributes: [
            .font: font,
            .foregroundColor: color,
            .paragraphStyle: paragraph
        ])
        let framesetter = CTFramesetterCreateWithAttributedString(attributed as CFAttributedString)
        let suggested = CTFramesetterSuggestFrameSizeWithConstraints(
            framesetter, CFRange(), nil, CGSize(width: width, height: .greatestFiniteMagnitude), nil
        )
        let drawHeight = ceil(suggested.height)
        let path = CGPath(rect: rect(x: x, top: top, width: width, height: drawHeight), transform: nil)
        let frame = CTFramesetterCreateFrame(framesetter, CFRange(), path, nil)
        CTFrameDraw(frame, context)
        return drawHeight
    }

    func width(of string: String, font: NSFont) -> CGFloat {
        let attributed = NSAttributedString(string: string, attributes: [.font: font])
        let line = CTLineCreateWithAttributedString(attributed as CFAttributedString)
        return CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
    }

    func height(of string: String, font: NSFont, width: CGFloat, lineSpacing: CGFloat = 0) -> CGFloat {
        guard !string.isEmpty else { return 0 }
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = lineSpacing
        let attributed = NSAttributedString(string: string, attributes: [
            .font: font, .paragraphStyle: paragraph
        ])
        let framesetter = CTFramesetterCreateWithAttributedString(attributed as CFAttributedString)
        let suggested = CTFramesetterSuggestFrameSizeWithConstraints(
            framesetter, CFRange(), nil, CGSize(width: width, height: .greatestFiniteMagnitude), nil
        )
        return ceil(suggested.height)
    }

    func image(_ image: CGImage, x: CGFloat, top: CGFloat, width: CGFloat, height: CGFloat) {
        context.draw(image, in: rect(x: x, top: top, width: width, height: height))
    }
}
```

Add `import CoreText` at the top of the file if not already present.

- [ ] **Step 2: Build**

Run: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow build`
Expected: BUILD SUCCEEDED.

- [ ] **Step 3: Commit**

```bash
git add InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift
git commit -m "feat(pdf): add top-left PDF canvas and Core Text helpers"
```

### Task 4: The renderer — background, grain, header, addresses, table, totals, notes

**Files:**
- Modify: `InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift`

**Interfaces:**
- Produces: `InvoicePDFRenderer(data:template:paperSize:)` and `func render() throws -> Data`.
- Consumes: `PDFStyle`, `PDFPalette`, `PDFCanvas`, `PDFGrainTile`, `InvoiceRenderData`, `PDFPageSpec`, `CurrencyFormatter`, `DateFormatHelper`.

- [ ] **Step 1: Add the renderer skeleton**

```swift
@MainActor
struct InvoicePDFRenderer {
    let data: InvoiceRenderData
    let template: PDFTemplate
    let paperSize: String

    func render() throws -> Data {
        let spec = PDFPageSpec.size(for: paperSize)
        let height = PDFStyle.pageHeight(for: data, paperSize: paperSize)
        var mediaBox = CGRect(x: 0, y: 0, width: spec.width, height: height)
        let pdfData = NSMutableData()
        guard let consumer = CGDataConsumer(data: pdfData as CFMutableData) else {
            throw PDFGeneratorError.couldNotCreateConsumer
        }
        guard let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
            throw PDFGeneratorError.couldNotCreateContext
        }
        context.beginPDFPage(nil)
        context.setShouldAntialias(true)
        context.setAllowsAntialiasing(true)
        let canvas = PDFCanvas(context: context, pageWidth: spec.width, pageHeight: height)
        draw(canvas: canvas)
        context.endPDFPage()
        context.closePDF()
        return pdfData as Data
    }
}
```

- [ ] **Step 2: Add `draw(canvas:)`**

```swift
private extension InvoicePDFRenderer {
    func draw(canvas: PDFCanvas) {
        let palette = PDFStyle.palette(
            template: template, accentHex: data.accentHex, secondaryHex: data.secondaryHex
        )
        let sz = data.fontSize
        let family = data.fontFamily
        let margin = PDFStyle.margin
        let contentWidth = canvas.pageWidth - margin * 2
        let fmt: (Double) -> String = { CurrencyFormatter.shared.string(from: $0, currencyCode: data.currencyCode) }

        // Background + grain
        canvas.fill(x: 0, top: 0, width: canvas.pageWidth, height: canvas.pageHeight, color: palette.background)
        if let tile = PDFGrainTile.image(dot: palette.grainDot, density: 8000) {
            canvas.context.saveGState()
            canvas.context.setAlpha(palette.grainOpacity)
            canvas.context.setBlendMode(palette.grainBlend)
            canvas.context.draw(
                tile,
                in: canvas.rect(x: 0, top: 0, width: canvas.pageWidth, height: canvas.pageHeight),
                byTiling: true
            )
            canvas.context.restoreGState()
        }

        var y: CGFloat = 0

        // Header: [ Type — Total ], centered
        y += 24
        let header = "\(data.invoiceTypeDisplayName) — \(fmt(data.total))"
        let headerFont = PDFStyle.font(size: sz + 1, weight: .medium, family: family)
        let headerHeight = canvas.height(of: header, font: headerFont, width: contentWidth)
        drawBracket(header, canvas: canvas, x: margin, top: y, width: contentWidth,
                    font: headerFont, palette: palette, alignment: .center)
        y += headerHeight + 20

        // Logo + reference rows
        let refLines = referenceLines()
        let refFont = PDFStyle.font(size: sz, family: family)
        let refHeight = refLines.reduce(CGFloat.zero) { partial, row in
            partial + canvas.height(of: "\(row.0) \(row.1)", font: refFont, width: contentWidth / 2) + 4
        }
        let logoHeight = max(PDFStyle.logoHeight, refHeight)
        let logoWidth = drawLogo(canvas: canvas, x: margin, top: y, palette: palette)
        let refFontValue = PDFStyle.font(size: sz, weight: .medium, family: family)
        let refWidth = contentWidth - logoWidth - 16
        let refX = margin + logoWidth + 16
        var refTop = y
        for (label, value) in refLines {
            // SwiftUI lays these out as "[label] [value]" right-aligned as a pair,
            // so the label ends 8pt before the value starts.
            let valueWidth = canvas.width(of: value, font: refFontValue)
            let valueHeight = canvas.text(value, font: refFontValue, color: palette.bold,
                                          x: refX, top: refTop, width: refWidth, alignment: .right)
            let labelHeight = canvas.text(label, font: refFont, color: palette.text.withAlphaComponent(0.5),
                                          x: refX, top: refTop,
                                          width: max(refWidth - valueWidth - 8, 0), alignment: .right)
            refTop += max(valueHeight, labelHeight, 1) + 4
        }
        y += logoHeight

        // Accent rule
        y += 20
        canvas.fill(x: margin, top: y, width: contentWidth, height: 1,
                    color: palette.accent.withAlphaComponent(0.4).cgColor)
        y += 1 + 20

        // From / Bill to
        y += 8
        let columnWidth = (contentWidth - 200) / 2
        let fromHeight = drawFrom(canvas: canvas, x: margin, top: y, width: columnWidth,
                                  font: PDFStyle.font(size: sz, family: family), palette: palette)
        let toHeight = drawBillTo(canvas: canvas, x: margin + columnWidth + 200, top: y, width: columnWidth,
                                  font: PDFStyle.font(size: sz, family: family), palette: palette)
        y += max(fromHeight, toHeight)

        // Accent rule
        y += 20
        canvas.fill(x: margin, top: y, width: contentWidth, height: 1,
                    color: palette.accent.withAlphaComponent(0.4).cgColor)
        y += 1 + 20

        // Table
        y = drawTable(canvas: canvas, top: y, palette: palette, sz: sz, family: family,
                      contentWidth: contentWidth, fmt: fmt)

        // Totals
        y += 16
        y = drawTotals(canvas: canvas, top: y, palette: palette, sz: sz, family: family,
                       width: contentWidth, fmt: fmt)

        // Notes
        y += 32
        let noteFont = PDFStyle.font(size: sz - 0.5, family: family)
        let note = (data.showNote && !data.notes.isEmpty)
            ? data.notes
            : "Thank you for your business! Payment is due within 14 days of invoice date."
        let noteColor = palette.text.withAlphaComponent(data.showNote && !data.notes.isEmpty ? 0.6 : 0.4)
        _ = canvas.text(note, font: noteFont, color: noteColor, x: margin, top: y,
                        width: contentWidth, alignment: .center, lineSpacing: 4)
    }
}
```

- [ ] **Step 3: Add the block helpers**

```swift
private extension InvoicePDFRenderer {
    func referenceLines() -> [(String, String)] {
        var rows: [(String, String)] = [
            ("Ref", data.invoiceNumber),
            ("Issued", DateFormatHelper.string(from: data.issueDate, format: data.dateFormat))
        ]
        if data.showDueDate, let due = data.dueDate {
            rows.append(("Due", "\(DateFormatHelper.string(from: due, format: data.dateFormat)) · Net 14"))
        }
        return rows
    }

    /// SwiftUI's BracketLabel paints "[" and "]" in the accent color and the
    /// inner text in the bold color, so it must be drawn as three segments.
    func drawBracket(_ text: String, canvas: PDFCanvas, x: CGFloat, top: CGFloat, width: CGFloat,
                     font: NSFont, palette: PDFPalette, alignment: NSTextAlignment) {
        let open = "[", inner = " \(text) ", close = "]"
        let openWidth = canvas.width(of: open, font: font)
        let innerWidth = canvas.width(of: inner, font: font)
        let closeWidth = canvas.width(of: close, font: font)
        let total = openWidth + innerWidth + closeWidth
        let startX: CGFloat
        switch alignment {
        case .center: startX = x + (width - total) / 2
        case .right: startX = x + width - total
        default: startX = x
        }
        _ = canvas.text(open, font: font, color: palette.accent, x: startX, top: top, width: openWidth)
        _ = canvas.text(inner, font: font, color: palette.bold, x: startX + openWidth, top: top, width: innerWidth)
        _ = canvas.text(close, font: font, color: palette.accent, x: startX + openWidth + innerWidth, top: top, width: closeWidth)
    }

    func drawLogo(canvas: PDFCanvas, x: CGFloat, top: CGFloat, palette: PDFPalette) -> CGFloat {
        if let raw = data.logoData,
           let image = LogoImage.prepare(raw, maxDimension: 600) {
            let scale = min(PDFStyle.logoHeight / CGFloat(image.height),
                            PDFStyle.logoMaxWidth / CGFloat(image.width), 1)
            let width = CGFloat(image.width) * scale
            canvas.image(image, x: x, top: top, width: width, height: CGFloat(image.height) * scale)
            return width
        }
        let size: CGFloat = 20
        canvas.context.setStrokeColor(palette.accent.cgColor)
        canvas.context.setLineWidth(2)
        canvas.context.strokeEllipse(in: canvas.rect(x: x, top: top + 35, width: size, height: size))
        canvas.context.setFillColor(palette.accent.cgColor)
        canvas.context.fillEllipse(in: canvas.rect(x: x + 5, top: top + 40, width: 10, height: 10))
        guard !data.companyName.isEmpty else { return size }
        let font = PDFStyle.font(size: 16, weight: .bold, family: data.fontFamily)
        _ = canvas.text(data.companyName, font: font, color: palette.bold,
                        x: x + size + 8, top: top + 35, width: 240)
        return size
    }

    func drawFrom(canvas: PDFCanvas, x: CGFloat, top: CGFloat, width: CGFloat,
                  font: NSFont, palette: PDFPalette) -> CGFloat {
        var y = top
        let labelHeight = canvas.height(of: "From", font: font, width: width)
        drawBracket("From", canvas: canvas, x: x, top: y, width: width,
                    font: font, palette: palette, alignment: .left)
        y += labelHeight
        if !data.companyName.isEmpty {
            y += canvas.text(data.companyName, font: PDFStyle.font(size: data.fontSize + 2, weight: .bold, family: data.fontFamily),
                             color: palette.bold, x: x, top: y, width: width) + 2
        }
        for line in data.companyAddress.components(separatedBy: "\n") where !line.isEmpty {
            y += canvas.text(line, font: font, color: palette.text, x: x, top: y, width: width) + 2
        }
        if !data.companyEmail.isEmpty {
            y += canvas.text(data.companyEmail, font: font, color: palette.text.withAlphaComponent(0.7),
                             x: x, top: y, width: width) + 2
        }
        if !data.companyPhone.isEmpty {
            y += canvas.text(data.companyPhone, font: font, color: palette.text.withAlphaComponent(0.7),
                             x: x, top: y, width: width) + 2
        }
        return y - top
    }

    func drawBillTo(canvas: PDFCanvas, x: CGFloat, top: CGFloat, width: CGFloat,
                    font: NSFont, palette: PDFPalette) -> CGFloat {
        var y = top
        let labelHeight = canvas.height(of: "Bill to", font: font, width: width)
        drawBracket("Bill to", canvas: canvas, x: x, top: y, width: width,
                    font: font, palette: palette, alignment: .left)
        y += labelHeight
        if !data.clientName.isEmpty {
            y += canvas.text(data.clientName, font: PDFStyle.font(size: data.fontSize + 2, weight: .bold, family: data.fontFamily),
                             color: palette.bold, x: x, top: y, width: width) + 2
        }
        if !data.clientCompany.isEmpty {
            y += canvas.text(data.clientCompany, font: font, color: palette.text, x: x, top: y, width: width) + 2
        }
        if !data.clientEmail.isEmpty {
            y += canvas.text(data.clientEmail, font: font, color: palette.text.withAlphaComponent(0.7),
                             x: x, top: y, width: width) + 2
        }
        return y - top
    }
}
```

- [ ] **Step 4: Add the table**

```swift
private extension InvoicePDFRenderer {
    struct Columns {
        let origin: CGFloat
        let inset: CGFloat
        let contentWidth: CGFloat
        var flex: CGFloat { (contentWidth - PDFStyle.qtyWidth - PDFStyle.moneyWidth * 2) / 3 }
        var descriptionX: CGFloat { origin }
        var descriptionWidth: CGFloat { flex }
        var qtyX: CGFloat { origin + flex }
        var unitX: CGFloat { origin + flex + PDFStyle.qtyWidth + flex }
        var amountX: CGFloat { origin + flex + PDFStyle.qtyWidth + flex + PDFStyle.moneyWidth + flex }
        var moneyWidth: CGFloat { PDFStyle.moneyWidth }
    }

    func drawTable(canvas: PDFCanvas, top: CGFloat, palette: PDFPalette, sz: CGFloat, family: String,
                   contentWidth: CGFloat, fmt: (Double) -> String) -> CGFloat {
        let headerColumns = Columns(
            origin: PDFStyle.margin + PDFStyle.tableHeaderInset,
            inset: PDFStyle.tableHeaderInset,
            contentWidth: contentWidth - PDFStyle.tableHeaderInset * 2
        )
        let rowColumns = Columns(
            origin: PDFStyle.rowInset,
            inset: PDFStyle.rowInset,
            contentWidth: canvas.pageWidth - PDFStyle.rowInset * 2
        )
        let headerFont = PDFStyle.font(size: sz, weight: .medium, family: family)
        let bodyFont = PDFStyle.font(size: sz, family: family)
        let headerHeight = canvas.height(of: "Description", font: headerFont, width: headerColumns.descriptionWidth) + 12

        canvas.fill(
            x: PDFStyle.margin, top: top, width: contentWidth, height: headerHeight,
            color: palette.secondary.withAlphaComponent(palette.tableTint).cgColor
        )
        _ = canvas.text("Description", font: headerFont, color: palette.bold,
                        x: headerColumns.descriptionX, top: top + 6, width: headerColumns.descriptionWidth)
        _ = canvas.text("Qty", font: headerFont, color: palette.bold,
                        x: headerColumns.qtyX, top: top + 6, width: PDFStyle.qtyWidth, alignment: .right)
        _ = canvas.text("Unit price", font: headerFont, color: palette.bold,
                        x: headerColumns.unitX, top: top + 6, width: PDFStyle.moneyWidth, alignment: .right)
        _ = canvas.text("Amount", font: headerFont, color: palette.bold,
                        x: headerColumns.amountX, top: top + 6, width: PDFStyle.moneyWidth, alignment: .right)

        var y = top + headerHeight
        y += drawDashedSeparator(canvas: canvas, top: y, palette: palette)

        for (index, item) in data.lineItems.enumerated() {
            let description = item.description.isEmpty ? "—" : item.description
            let rowHeight = max(
                canvas.height(of: description, font: bodyFont, width: rowColumns.descriptionWidth),
                canvas.height(of: fmt(item.total), font: bodyFont, width: PDFStyle.moneyWidth)
            ) + 16
            _ = canvas.text(description, font: bodyFont, color: palette.bold,
                            x: rowColumns.descriptionX, top: y + 8, width: rowColumns.descriptionWidth)
            _ = canvas.text("\(Int(item.quantity))", font: bodyFont, color: palette.bold,
                            x: rowColumns.qtyX, top: y + 8, width: PDFStyle.qtyWidth, alignment: .right)
            _ = canvas.text(fmt(item.price), font: bodyFont, color: palette.bold,
                            x: rowColumns.unitX, top: y + 8, width: PDFStyle.moneyWidth, alignment: .right)
            _ = canvas.text(fmt(item.total), font: bodyFont, color: palette.bold,
                            x: rowColumns.amountX, top: y + 8, width: PDFStyle.moneyWidth, alignment: .right)
            y += rowHeight
            if index < data.lineItems.count - 1 {
                y += drawDashedSeparator(canvas: canvas, top: y, palette: palette,
                                         color: palette.border.copy(alpha: 0.5) ?? palette.border)
            }
        }
        return y
    }

    func drawDashedSeparator(canvas: PDFCanvas, top: CGFloat, palette: PDFPalette,
                             color: CGColor? = nil) -> CGFloat {
        let font = PDFStyle.font(size: 9, family: data.fontFamily)
        let text = String(repeating: "- ", count: 70)
        return canvas.text(text, font: font, color: NSColor(cgColor: color ?? palette.border) ?? palette.text,
                           x: PDFStyle.margin, top: top,
                           width: canvas.pageWidth - PDFStyle.margin * 2)
    }

    func drawTotals(canvas: PDFCanvas, top: CGFloat, palette: PDFPalette, sz: CGFloat, family: String,
                    width: CGFloat, fmt: (Double) -> String) -> CGFloat {
        let blockWidth: CGFloat = 240
        let x = canvas.pageWidth - PDFStyle.margin - blockWidth
        var y = top
        let bodyFont = PDFStyle.font(size: sz, family: family)
        _ = canvas.text("Subtotal", font: bodyFont, color: palette.text.withAlphaComponent(0.6),
                        x: x, top: y, width: blockWidth / 2)
        y += canvas.text(fmt(data.subtotal), font: bodyFont, color: palette.bold,
                         x: x + blockWidth / 2, top: y, width: blockWidth / 2, alignment: .right) + 4
        if data.showDiscount && data.discount > 0 {
            _ = canvas.text("Discount", font: bodyFont, color: palette.text.withAlphaComponent(0.6),
                            x: x, top: y, width: blockWidth / 2)
            y += canvas.text("-\(fmt(data.discount))", font: bodyFont, color: .systemRed,
                             x: x + blockWidth / 2, top: y, width: blockWidth / 2, alignment: .right) + 4
        }
        y += 4
        canvas.fill(x: x + blockWidth - 180, top: y, width: 180, height: 1, color: palette.border)
        y += 6
        let totalFont = PDFStyle.font(size: sz + 1, weight: .bold, family: family)
        let amountFont = PDFStyle.font(size: sz + 2, weight: .bold, family: family)
        let totalRowHeight = max(
            canvas.height(of: "Total", font: totalFont, width: 80),
            canvas.height(of: fmt(data.total), font: amountFont, width: blockWidth / 2)
        )
        _ = canvas.text("Total", font: totalFont, color: palette.accent,
                        x: x, top: y, width: blockWidth / 2)
        _ = canvas.text(fmt(data.total), font: amountFont, color: palette.accent,
                        x: x + blockWidth / 2, top: y, width: blockWidth / 2, alignment: .right)
        return y + totalRowHeight
    }
}
```

- [ ] **Step 5: Add `LogoImage`**

```swift
enum LogoImage {
    static func prepare(_ data: Data, maxDimension: CGFloat) -> CGImage? {
        guard let source = NSImage(data: data) else { return nil }
        let scale = min(maxDimension / max(source.size.width, source.size.height), 1)
        let size = NSSize(width: source.size.width * scale, height: source.size.height * scale)
        let image = NSImage(size: size)
        image.lockFocus()
        source.draw(in: NSRect(origin: .zero, size: size))
        image.unlockFocus()
        guard let tiff = image.tiffRepresentation,
              let rep = NSBitmapImageRep(data: tiff) else { return nil }
        return rep.cgImage
    }
}
```

(Task 6 replaces this with a JPEG re-encode; at this point the size gate may still fail with a large photographic logo, which is expected.)

- [ ] **Step 6: Build**

Run: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow build`
Expected: BUILD SUCCEEDED.

- [ ] **Step 7: Commit**

```bash
git add InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift
git commit -m "feat(pdf): add native Core Graphics/Core Text invoice renderer"
```

### Task 5: Wire the generator and keep the legacy path for parity only

**Files:**
- Modify: `InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift:76-137`

**Interfaces:**
- Consumes: `InvoicePDFRenderer`.
- Produces: unchanged `generatePDF(for:template:paperSize:) -> URL?`; internal `legacyRasterData(for:template:paperSize:) throws -> Data`.

- [ ] **Step 1: Replace the body of `generatePDF`**

```swift
@MainActor
final class PDFGenerator {
    func generatePDF(for data: InvoiceRenderData, template: PDFTemplate = .dark, paperSize: String? = nil) -> URL? {
        let paper = paperSize ?? "A4"
        let tempDir = FileManager.default.temporaryDirectory
        let fileName = data.invoiceNumber.isEmpty ? "invoice.pdf" : "\(data.invoiceNumber).pdf"
        let fileURL = tempDir.appendingPathComponent(fileName)
        do {
            let pdfData = try InvoicePDFRenderer(data: data, template: template, paperSize: paper).render()
            try pdfData.write(to: fileURL)
            return fileURL
        } catch {
            print("PDF error: \(error)")
            return nil
        }
    }
}
```

- [ ] **Step 2: Move the old raster code into a parity-only function**

Keep `ImageRenderer`/`makePDF` as `legacyRasterData(for:template:paperSize:) throws -> Data` on `PDFGenerator`, with this comment on the declaration:

```swift
// ponytail: parity harness only — deleted in Task 8 once the pixel-diff gate passes.
func legacyRasterData(for data: InvoiceRenderData, template: PDFTemplate, paperSize: String) throws -> Data
```

It is the current `generatePDF` body (view construction + `ImageRenderer` + `makePDF`), returning `Data` instead of writing a file. Do not change its scale values.

- [ ] **Step 3: Build and run the existing test suite**

```bash
xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow build
xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow test -only-testing:InvoiceFlowTests
```
Expected: BUILD SUCCEEDED, existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift
git commit -m "feat(pdf): switch export to the native renderer"
```

### Task 6: Logo size cap with JPEG re-encoding

**Files:**
- Modify: `InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift` (`LogoImage`)

**Interfaces:**
- Produces: `LogoImage.prepare(_:maxDimension:) -> CGImage?` that returns a downscaled image, JPEG-re-encoded (quality 0.8) when the source has no alpha, PNG when it does.
- Consumes: `NSBitmapImageRep.bestRepresentation(for:properties:)`.

- [ ] **Step 1: Replace `LogoImage.prepare`**

```swift
enum LogoImage {
    static func prepare(_ data: Data, maxDimension: CGFloat) -> CGImage? {
        guard let source = NSImage(data: data) else { return nil }
        let original = source.size
        guard original.width > 0, original.height > 0 else { return nil }
        let scale = min(maxDimension / max(original.width, original.height), 1)
        let target = NSSize(width: original.width * scale, height: original.height * scale)

        // Detect transparency from the source, not from the scratch bitmap
        // (which always allocates an alpha channel).
        let sourceHasAlpha: Bool = {
            guard let cg = source.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return true }
            switch cg.alphaInfo {
            case .first, .last, .premultipliedFirst, .premultipliedLast, .alphaOnly: return true
            default: return false
            }
        }()

        guard let rep = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: Int(target.width),
            pixelsHigh: Int(target.height),
            bitsPerSample: 8, samplesPerPixel: 4,
            hasAlpha: true, isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0, bitsPerPixel: 0
        ) else { return nil }

        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
        if !sourceHasAlpha {
            // JPEG has no alpha channel; flatten onto white instead of black.
            NSColor.white.setFill()
            NSRect(origin: .zero, size: target).fill()
        }
        source.draw(in: NSRect(origin: .zero, size: target))
        NSGraphicsContext.restoreGraphicsState()

        let properties: [NSBitmapImageRep.PropertyKey: Any] = sourceHasAlpha
            ? [:]
            : [.compressionFactor: 0.8]
        let type: NSBitmapImageRep.FileType = sourceHasAlpha ? .png : .jpeg
        guard let encoded = rep.representation(using: type, properties: properties),
              let compressed = NSBitmapImageRep(data: encoded) else { return nil }
        return compressed.cgImage
    }
}
```

- [ ] **Step 2: Build**

Run: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow build`
Expected: BUILD SUCCEEDED.

- [ ] **Step 3: Commit**

```bash
git add InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift
git commit -m "feat(pdf): cap embedded logo size and re-encode as JPEG"
```

### Task 7: Automated gates — text, size, structure

**Files:**
- Create: `InvoiceFlow/InvoiceFlow/InvoiceFlowTests/PDFExportTests.swift`
- Modify: `InvoiceFlow/InvoiceFlow.xcodeproj/project.pbxproj` (register the test file: `PBXBuildFile`, `PBXFileReference`, group child, `Sources` entry for the `InvoiceFlowTests` target — copy the four entries used by `RecalculateTests.swift` and substitute the file name)

**Interfaces:**
- Consumes: `PDFGenerator`, `InvoiceRenderData`, `InvoiceRenderLineItem`, `PDFTemplate` via `@testable import InvoiceFlow`.

- [ ] **Step 1: Write the failing tests**

```swift
import XCTest
import PDFKit
@testable import InvoiceFlow

final class PDFExportTests: XCTestCase {
    private func sample(rows: Int, logo: Data? = nil) -> InvoiceRenderData {
        var data = InvoiceRenderData()
        data.invoiceNumber = "INV-0001"
        data.invoiceType = "invoice"
        data.companyName = "Acme Studio"
        data.companyEmail = "hello@acme.test"
        data.companyAddress = "1 Main Street\nCape Town"
        data.clientName = "Jane Client"
        data.clientCompany = "Client Co"
        data.clientEmail = "jane@client.test"
        data.subtotal = 1000
        data.total = 1150
        data.tax = 150
        data.dateFormat = "MM/DD/YYYY"
        data.currencyCode = "USD"
        data.logoData = logo
        data.lineItems = (0..<rows).map { index in
            var item = InvoiceRenderLineItem()
            item.description = "Design work item \(index + 1) with a description long enough to wrap on a narrow column"
            item.quantity = 2
            item.price = 500
            item.total = 1000
            return item
        }
        return data
    }

    @MainActor
    private func makePDF(_ data: InvoiceRenderData, template: PDFTemplate = .dark, paper: String = "A4") throws -> (URL, PDFDocument) {
        let url = try XCTUnwrap(PDFGenerator().generatePDF(for: data, template: template, paperSize: paper))
        let document = try XCTUnwrap(PDFDocument(url: url))
        return (url, document)
    }

    @MainActor
    func testExportedPDFHasSelectableText() throws {
        for template in [PDFTemplate.dark, .light] {
            let (_, document) = try makePDF(sample(rows: 6), template: template)
            let text = try XCTUnwrap(document.page(at: 0)?.string)
            XCTAssertTrue(text.contains("INV-0001"), "invoice number missing: \(text)")
            XCTAssertTrue(text.contains("Acme Studio"))
            XCTAssertTrue(text.contains("Jane Client"))
            XCTAssertTrue(text.contains("Design work item 1"))
            XCTAssertTrue(text.contains("Subtotal"))
            XCTAssertTrue(text.contains("Total"))
        }
    }

    @MainActor
    func testExportedPDFIsSmall() throws {
        let (url, _) = try makePDF(sample(rows: 6))
        let bytes = try Data(contentsOf: url).count
        XCTAssertLessThan(bytes, 200_000, "PDF is \(bytes) bytes; expected < 200 KB")

        let logo = NSImage(size: NSSize(width: 1200, height: 1200), flipped: false) { rect in
            NSColor.systemBlue.setFill()
            rect.fill()
            return true
        }
        let logoData = try XCTUnwrap(logo.tiffRepresentation)
        let (logoURL, _) = try makePDF(sample(rows: 6, logo: logoData))
        let logoBytes = try Data(contentsOf: logoURL).count
        XCTAssertLessThan(logoBytes, 200_000, "PDF with logo is \(logoBytes) bytes; expected < 200 KB")
    }

    @MainActor
    func testExportedPDFHasNoFullPageImageAndEmbedsFonts() throws {
        let (url, document) = try makePDF(sample(rows: 6))
        XCTAssertEqual(document.pageCount, 1)
        let bytes = try Data(contentsOf: url)
        let raw = String(decoding: bytes, as: UTF8.self)
        let normalized = raw.replacingOccurrences(of: " ", with: "")
        XCTAssertTrue(normalized.contains("/Font"), "no /Font entry — text was rasterized")
        let imageCount = normalized.components(separatedBy: "/Subtype/Image").count - 1
        XCTAssertLessThanOrEqual(imageCount, 1, "expected at most the grain tile, found \(imageCount) images")
    }

    @MainActor
    func testExportSurvivesPDFKitRoundTrip() throws {
        let (_, document) = try makePDF(sample(rows: 6))
        let roundTripped = try XCTUnwrap(document.dataRepresentation())
        XCTAssertLessThan(roundTripped.count, 250_000)
    }

    @MainActor
    func testAllPaperSizesRenderOnePage() throws {
        for paper in ["A4", "A3", "Letter", "Legal"] {
            let (_, document) = try makePDF(sample(rows: 24), paper: paper)
            XCTAssertEqual(document.pageCount, 1, "\(paper) produced \(document.pageCount) pages")
        }
    }
}
```

- [ ] **Step 2: Run and observe the failures**

```bash
xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow test -only-testing:InvoiceFlowTests/PDFExportTests
```
Expected before the wiring is correct: text/size/structure assertions fail (this test file compiles only after the pbxproj registration).

- [ ] **Step 3: Fix the renderer until the gates pass**

Do not change test thresholds. Fix the drawing code. The likely first failures: page height (use `PDFStyle.pageHeight`), table column math (compare against the legacy raster), missing `import CoreText`, or grain/drawing order.

- [ ] **Step 4: Run again**

```bash
xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow test -only-testing:InvoiceFlowTests
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add InvoiceFlow/InvoiceFlow/InvoiceFlowTests/PDFExportTests.swift InvoiceFlow/InvoiceFlow.xcodeproj/project.pbxproj InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift
git commit -m "test(pdf): gate text layer, size, structure and paper sizes"
```

### Task 8: Pixel-diff parity gate (layout must not move)

**Files:**
- Create: `tmp-pdf-spike/parity/main.swift`
- Create: `tmp-pdf-spike/parity/Stubs.swift` (copy of `tmp-pdf-spike/verify/Stubs.swift`)
- Create: `tmp-pdf-spike/parity/PDFTemplate.swift` (copy of `tmp-pdf-spike/verify/PDFTemplate.swift`)
- Create: `tmp-pdf-spike/parity/PDFGenerator.swift` (copy of the modified app file)

**Interfaces:**
- Consumes: `PDFGenerator.legacyRasterData`, `InvoicePDFRenderer`, `InvoiceRenderData`.

- [ ] **Step 1: Write the harness**

```swift
import AppKit
import PDFKit

@MainActor
func render(_ data: InvoiceRenderData, template: PDFTemplate, paper: String, legacy: Bool) throws -> Data {
    let generator = PDFGenerator()
    return legacy
        ? try generator.legacyRasterData(for: data, template: template, paperSize: paper)
        : try InvoicePDFRenderer(data: data, template: template, paperSize: paper).render()
}

@MainActor
func bitmap(_ pdf: Data, scale: CGFloat) throws -> NSBitmapImageRep {
    let document = unwrap(PDFDocument(data: pdf), "could not open rendered PDF")
    let page = unwrap(document.page(at: 0), "PDF has no first page")
    let bounds = page.bounds(for: .mediaBox)
    let width = Int(bounds.width * scale)
    let height = Int(bounds.height * scale)
    let rep = unwrap(NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    ), "could not allocate bitmap")
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    NSColor.white.setFill()
    NSRect(x: 0, y: 0, width: width, height: height).fill()
    let context = NSGraphicsContext.current!.cgContext
    context.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context)
    NSGraphicsContext.restoreGraphicsState()
    return rep
}

func difference(_ a: NSBitmapImageRep, _ b: NSBitmapImageRep) -> Double {
    guard a.pixelsWide == b.pixelsWide, a.pixelsHigh == b.pixelsHigh else { return 1 }
    var different = 0
    let total = a.pixelsWide * a.pixelsHigh
    for y in 0..<a.pixelsHigh {
        for x in 0..<a.pixelsWide {
            let ca = a.colorAt(x: x, y: y) ?? .black
            let cb = b.colorAt(x: x, y: y) ?? .black
            let delta = abs(ca.redComponent - cb.redComponent)
                + abs(ca.greenComponent - cb.greenComponent)
                + abs(ca.blueComponent - cb.blueComponent)
            if delta > 0.08 { different += 1 }
        }
    }
    return Double(different) / Double(total)
}

@MainActor
func main() throws {
    var failures = 0
    for template in [PDFTemplate.dark, .light] {
        for paper in ["A4", "A3", "Letter", "Legal"] {
            for rows in [1, 6, 24] {
                var data = InvoiceRenderData()
                data.invoiceNumber = "INV-0001"
                data.companyName = "Acme Studio"
                data.companyEmail = "hello@acme.test"
                data.companyAddress = "1 Main Street\nCape Town"
                data.clientName = "Jane Client"
                data.clientCompany = "Client Co"
                data.clientEmail = "jane@client.test"
                data.subtotal = 1000
                data.tax = 150
                data.total = 1150
                data.lineItems = (0..<rows).map { index in
                    var item = InvoiceRenderLineItem()
                    item.description = "Design work item \(index + 1) with a description long enough to wrap on a narrow column"
                    item.quantity = 2
                    item.price = 500
                    item.total = 1000
                    return item
                }
                let old = try bitmap(render(data, template: template, paper: paper, legacy: true), scale: 2)
                let new = try bitmap(render(data, template: template, paper: paper, legacy: false), scale: 2)
                let diff = difference(old, new)
                let label = "\(template.rawValue) \(paper) rows=\(rows)"
                print(String(format: "%-22@ diff=%.3f%%", label as NSString, diff * 100))
                if diff >= 0.01 {
                    failures += 1
                    print("FAIL \(label)")
                }
            }
        }
    }
    if failures > 0 {
        print("\(failures) combination(s) exceeded 1% pixel difference")
        exit(1)
    }
    print("PASS: all combinations within 1%")
}

func unwrap<T>(_ value: T?, _ message: String = "unexpected nil") -> T {
    guard let value = value else { fatalError(message) }
    return value
}

do {
    try MainActor.assumeIsolated { try main() }
} catch {
    print("error: \(error)")
    exit(1)
}
```

- [ ] **Step 2: Compile and run**

```bash
cd /Users/perigrino/Projects/Invoice_App/tmp-pdf-spike/parity
swiftc -O *.swift -o parity
./parity
```
Expected: every combination `diff < 1.000%`, exit code 0.

- [ ] **Step 3: Fix the renderer, not the threshold**

Adjust the renderer's arithmetic until the diff is anti-aliasing-only. Re-run Step 2 after each change. Do not edit the 0.01 threshold.

- [ ] **Step 4: Commit the harness**

```bash
git add tmp-pdf-spike/parity
git commit -m "test(pdf): add pixel-diff parity harness for the native renderer"
```

### Task 9: Delete the legacy path and ship

**Files:**
- Modify: `InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift` (delete legacy raster function, `InvoicePDFView`, `DarkTheme`, `LightTheme`, `AccentLogo`, `AccentLine`, `DashedSeparator`, `BracketLabel`, `NoiseTexture`, `dynamicFont`, and the now-unused `PDFGeneratorError` cases if any)
- Modify: `InvoiceFlow/InvoiceFlow.xcodeproj/project.pbxproj` (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`)

- [ ] **Step 1: Delete the legacy code**

Keep: `PDFPageSpec`, `InvoiceRenderLineItem`, `InvoiceRenderData`, `PDFGenerator` (with `generatePDF` only), `PDFGeneratorError`, `PDFStyle`, `PDFPalette`, `PDFGrainTile`, `PDFCanvas`, `InvoicePDFRenderer`, `LogoImage`, `NSColor(hex:)`.

The grep must be empty afterwards:

```bash
grep -n "ImageRenderer\|InvoicePDFView\|DarkTheme\|LightTheme\|makePDF\|legacyRasterData" InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift
```
Expected: no output.

- [ ] **Step 2: Build, test, and run the parity harness one last time**

```bash
xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow build
xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow test -only-testing:InvoiceFlowTests
cd /Users/perigrino/Projects/Invoice_App/tmp-pdf-spike/parity && ./parity
```
Expected: BUILD SUCCEEDED, tests PASS, parity PASS (the legacy function is gone from the app target; the harness copy keeps its own snapshot — if the harness no longer compiles because the app file was trimmed, restore the legacy function only inside the harness copy `tmp-pdf-spike/parity/PDFGenerator.swift`, never in the app).

- [ ] **Step 3: Manual acceptance**

Build the app, open an invoice, Export PDF, then:
- Preview → select a line of text with the mouse, copy it, paste it into TextEdit.
- Preview → File → Properties → Fonts shows an embedded subset.
- Check file size in Finder (expected 25–100 KB without logo, < 200 KB with logo).
- Open the same file in PDF Expert / Acrobat and try editing a field.

- [ ] **Step 4: Bump the version and build the DMG**

Update `MARKETING_VERSION` (e.g. 2.4.0 → 2.5.0) and `CURRENT_PROJECT_VERSION` (+1) in `project.pbxproj`, follow the repo's DMG build steps, export one real invoice from the built app.

- [ ] **Step 5: Commit**

```bash
git add InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift InvoiceFlow/InvoiceFlow.xcodeproj/project.pbxproj
git commit -m "refactor(pdf): remove raster export path

Exports are now native text+vector PDFs. Layout parity proven by
tmp-pdf-spike/parity (all combinations < 1% pixel difference)."
```

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| **Line wrapping or column math differs** from SwiftUI (the main fidelity risk) | Same font/size/columns, Core Text line breaking (what SwiftUI uses), and the pixel-diff gate across 24 combinations. Fix the renderer, never the threshold. |
| Table column flex math wrong | The `Columns` struct encodes the model; the diff gate proves or disproves it. If it fails, measure the legacy raster's column edges and adjust `flex`, not the gate. |
| Long invoices exceed A4 height | `PDFStyle.pageHeight` reuses today's `dynamicHeight` formula exactly. |
| Font not installed | Same `NSFont(name:)` → monospaced-system fallback as today. |
| Grain tiling phase differs from SwiftUI | Deterministic tile (same seed) + sub-1% tolerance; grain amplitude is below the 0.08 per-channel threshold. |
| Logo with alpha becomes large PNG | Cap 600 px; PNG only when alpha exists (required to avoid black backgrounds). Size gate is 200 KB. |
| PDFKit `dataRepresentation()` in `savePDF()` bloats the file | Round-trip test caps it at 250 KB. |
| "Editable" expectation | Text will be selectable/searchable/editable as text objects with subset fonts. PDF text editing never reflows like a word processor — this is the ceiling for any PDF. |

## What we deliberately skipped (ponytail)

- No new app source files — the renderer lives in `PDFGenerator.swift`, so no `project.pbxproj` source registration and the change is one revertible file.
- No compression/quality/metadata settings UI — not asked for.
- No HTML/`WKWebView` second layout stack — same rewrite cost with an extra dependency.
- No invisible-text-over-raster fallback — still fails the selectability/editing goal.
- No image-XObject removal for the grain — you chose to keep the texture.

## Out of scope

- The Next.js PDF route (`src/lib/pdf/*`) — already produces vector PDFs.
- New templates or design changes.

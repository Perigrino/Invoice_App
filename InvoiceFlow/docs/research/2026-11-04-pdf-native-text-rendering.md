# PDF Native Text Rendering Research

**Date:** 2026-11-04
**Context:** InvoiceFlow macOS SwiftUI app — PDF export via `ImageRenderer` at 12–16× scale → bitmap → `CGContext.draw(cgImage:)`. Result: 5–20 MB files, no text layer.
**Goal:** Tiny (<100 KB), editable (real text) PDF **without losing the existing SwiftUI layout** (`InvoicePDFView` with `DarkTheme`/`LightTheme` in `InvoiceFlow/InvoiceFlow/PDF/PDFGenerator.swift`).

---

## Question Summary

Can a SwiftUI view be rendered to PDF with **real, selectable text** and **vector shapes** (instead of a raster bitmap), reusing the existing layout code? Apple offers several first-party paths — `ImageRenderer` is raster-only, but AppKit's `NSPrintOperation` / `NSGraphicsContext` and CoreGraphics PDF contexts can emit text as text. The key question is which approach preserves layout fidelity with the least new layout code.

---

## Findings

### 1. SwiftUI `ImageRenderer` → PDF text

**`ImageRenderer` (`SwiftUI.ImageRenderer`)** — *Apple Developer Documentation: SwiftUI > ImageRenderer*

> "Renders a SwiftUI view to an image."

**Key facts:**
- `ImageRenderer` renders to an **image** (CGImage / NSImage / UIImage). It is raster by design — no PDF output mode exists.
- Internally, `ImageRenderer` hosts the view in an `NSHostingView` (macOS) and renders into a bitmap context (`CGBitmapContext`). Even at `scale = 16`, the output is a pixel grid — glyphs are rasterized, not emitted as PDF text operators.
- No `vector` or `text` option exists on `ImageRenderer`. Its API surface is: `content`, `scale`, `isOpaque`, `proposedSize`, `nsImage`, `cgImage`, `uiImage`. None produces PDF.
- `ImageRenderer` was intended for light-weight image capture (e.g. sharing a button or card), not document generation.

**Conclusion:** `ImageRenderer` **cannot** produce a text layer. It must be replaced or bypassed for the PDF export path.

**Sources:**
- `https://developer.apple.com/documentation/swiftui/imagerenderer` — "Renders a SwiftUI view to an image"
- `NSHostingView` — AppKit, hosts SwiftUI view tree on macOS

---

### 2. `NSPrintOperation` with SwiftUI (NSHostingView in print operations)

**`NSPrintOperation` (`AppKit.NSPrintOperation`)** — *Apple Developer Documentation: AppKit > NSPrintOperation*

> "On macOS, an NSPrintOperation manages a print job, sending output to a printer or a file."

**How it works:**
- `NSPrintOperation.printOperation(with:view:)` / `NSView.printOperation(with:)` creates a print operation that:
  1. Creates an `NSGraphicsContext` backed by a PDF consumer (`CGContext(consumer:mediaBox:)`) when saving to PDF, or a PostScript consumer when printing.
  2. Calls `NSView.draw(_:)` recursively on the view hierarchy within that graphics context.
- When `NSView.draw(_:)` (AppKit) or `NSHostingView`'s drawing path executes, it issues `NSGraphicsContext` / `CoreGraphics` drawing calls into the current context.
- **If the current graphics context is a PDF context**, text drawing calls (`NSString.draw`, `CTLineDraw`, `NSAttributedString.draw`) emit **PDF text operators** (`Tj`, `TJ`, `Tf`) with embedded font subsets — real, selectable, editable text.
- If the current context is a bitmap context, the same calls rasterize — which is what `ImageRenderer` does internally.

**`NSHostingView` drawing into a PDF context:**
- `NSHostingView` is an `NSView` subclass that hosts a SwiftUI view tree.
- Its `draw(_:)` implementation renders the SwiftUI hierarchy through the current `NSGraphicsContext`.
- When that context is a PDF `NSGraphicsContext`, SwiftUI `Text` views emit real PDF text.
- This is the **mechanism by which AppKit printing "just works"** for SwiftUI views on macOS — it is not a special-case; it is the normal AppKit drawing pipeline.

**Caveats:**
- `NSPrintOperation` adds pagination, margins, and print job metadata by default. For a single-page invoice, these must be configured or bypassed.
- `NSPrintOperation` requires an `NSPrintInfo` with paper size, margins, and print job parameters. The default margins may clip or offset content.
- `NSView.printOperation(with:)` shows a print accessory panel in interactive mode — for programmatic PDF generation, use `NSPrintOperation.printOperation(with:printInfo:)` variants or set `NSPrintOperation` to save to PDF file without showing UI.
- SwiftUI views that rely on `GeometryReader` or `PreferenceKey` may lay out slightly differently in a print context vs. a window context, but for fixed-frame views (like `InvoicePDFView` with explicit `.frame(width:height:)`) this is minimal.

**Key API:**
```swift
// Conceptual — not production code
let hostingView = NSHostingView(rootView: invoiceView)
hostingView.frame = NSRect(x: 0, y: 0, width: pageWidth, height: pageHeight)
let printInfo = NSPrintInfo(dictionary: [...])  // paper size, margins
let op = NSPrintOperation.printOperation(with: hostingView, printInfo: printInfo, showsPrintPanels: false)
op.runOperation()
```

**Sources:**
- `https://developer.apple.com/documentation/appkit/nsprintoperation`
- `https://developer.apple.com/documentation/appkit/nsview/printoperation(with:)`
- `https://developer.apple.com/documentation/appkit/nsprintinfo`
- `https://developer.apple.com/documentation/appkit/nsgraphicscontext`

---

### 3. CGContext native text drawing

**`CGContext` (`CoreGraphics.CGContext`)** — *Apple Developer Documentation: CoreGraphics > CGContext*

The canonical PDF creation pattern:

```swift
let consumer = CGDataConsumer(data: mutableData)
var mediaBox = CGRect(x: 0, y: 0, width: pageW, height: pageH)
let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil)
context.beginPDFPage(nil)
// ... draw ...
context.endPDFPage()
context.closePDF()
```

**Text drawing options within a PDF `CGContext`:**

| API | Produces real text? | Notes |
|-----|---------------------|-------|
| `NSString.draw(in:withAttributes:)` (AppKit) | ✅ Yes | Draws into current `NSGraphicsContext`. When that's a PDF context, emits PDF text operators + embeds font subset. Most convenient — handles layout, line-breaking, alignment. |
| `CTLineDraw(CTLine, CGContext)` (CoreText) | ✅ Yes | Lowest-level text API. Requires manual line layout via `CTLineCreateWithString`. Maximum control, maximum code. |
| `CGContext.drawString` / `CGContext.showText` | ✅ Yes | Legacy QuickDraw API. Works but less control over fonts/attributes than `NSString.draw`. |
| `CGContext.draw(cgImage, in:)` | ❌ No (raster) | Draws a bitmap — what the current code does. Image is embedded as XObject, no text layer. |
| `CGContext.fill(rect)` etc. | ✅ Vector shapes | Rects, paths, lines are all vector in PDF. |

**Font embedding:**
- When text is drawn into a PDF context, CoreGraphics **automatically embeds font subsets** (only glyphs actually used) into the PDF. System fonts (Menlo, SF Pro, Helvetica, Courier) are embedded as Type 1 / CIDFont subsets.
- **Menlo** is a system font on macOS — embedding a subset (~10–30 KB for Latin glyphs) is standard.
- No manual font embedding step is needed. The PDF will be self-contained and render correctly on any machine with a PDF reader.
- `CGContext.setAllowsFontSmoothing(true)` / `setShouldSmoothFonts(true)` affect rasterization quality for bitmap contexts; for PDF text contexts, they are largely irrelevant (PDF readers handle smoothing).

**Image embedding:**
- `CGContext.draw(cgImage, in:)` embeds images as PDF XObjects. For the logo, a single embedded image (100–500 KB if uncompressed PNG, much less if JPEG) is acceptable.
- The current code's `NoiseTexture` (8000 random 1×1 dots tiled) is a **major file size contributor** in bitmap mode. In vector mode, this should be replaced with a solid fill color or a much lighter texture (or omit the noise entirely for PDF — it's a paper grain effect that doesn't translate well to vector).

**Sources:**
- `https://developer.apple.com/documentation/coregraphics/cgcontext`
- `https://developer.apple.com/documentation/coregraphics/cgcontext(_:mediabox:_:)`
- `https://developer.apple.com/documentation/foundation/nsstring/draw(in:withattributes:)`
- `https://developer.apple.com/documentation/coretext/ctlinedraw(_:_:)`
- *Core Graphics Programming Guide — "Creating a PDF Document"* (Apple)

---

### 4. Layout-fidelity options that reuse SwiftUI layout

Three approaches ranked by layout-code reuse:

#### Approach A: NSHostingView → PDF NSGraphicsContext (recommended)

**How:**
1. Create `NSHostingView(rootView:)` with the existing `InvoicePDFView`.
2. Set its frame to the page size.
3. Create an `NSGraphicsContext` backed by a PDF `CGContext` (via `CGContext(consumer:mediaBox:)` + `NSGraphicsContext(graphicPort:flipped:)`), or use `NSPrintOperation` with `showsPrintPanels: false`.
4. Call `hostingView.draw(view.bounds)` (or let `NSPrintOperation` do it).

**Why it works:**
- `NSHostingView.draw(_:)` renders all child SwiftUI views through the current `NSGraphicsContext`.
- When that context is PDF-backed, `Text` views emit PDF text operators, `Shape`/`Rectangle`/`Circle` views emit vector paths, and `Image` views embed images.
- **Zero new layout code.** The entire `DarkTheme` / `LightTheme` view hierarchy runs unmodified.

**Known issues / risks:**
- **Flip direction:** AppKit's coordinate system is bottom-left origin; SwiftUI is top-left. `NSGraphicsContext(graphicPort:flipped:)` must be set correctly, or the output will be upside-down. This is the #1 gotcha.
- **Blend modes:** SwiftUI `.blendMode(.screen)` / `.blendMode(.multiply)` (used by `NoiseTexture`) may not map cleanly to PDF. The noise texture is likely to either not render or render as a solid block. Recommend: skip `NoiseTexture` in PDF mode, or replace with a solid fill.
- **Opacity stacking:** `color.opacity(0.5)` etc. use PDF transparency (ExtGState). Should work, but verify.
- **`NSPrintOperation` pagination:** If using `NSPrintOperation` (rather than a raw `NSGraphicsContext`), it may add margins or split content across pages. Configuring `NSPrintInfo` with exact paper size and zero margins mitigates this.
- **Image rendering:** The logo `Image(nsImage:)` should embed correctly as an XObject.

**Sources:**
- `https://developer.apple.com/documentation/appkit/nsgraphicscontext(graphicport:flipped:)`
- `https://developer.apple.com/documentation/appkit/nshostingview`
- `https://developer.apple.com/documentation/appkit/nsview/draw(_:)`

#### Approach B: Manual CGContext text + shape drawing

**How:**
1. Create PDF `CGContext` directly.
2. Use `NSString.draw(in:withAttributes:)` or `CTLineDraw` for each text element.
3. Use `CGContext.fill(rect)`, `CGContext.strokePath()` for shapes/lines.
4. Use `CGContext.draw(cgImage, in:)` for the logo.

**Why it works:**
- Full control over every element. Guaranteed real text, guaranteed small file size.

**Why it's worse:**
- **Requires rewriting the entire layout.** Every `VStack`, `HStack`, padding, alignment, frame — all of it must be manually reimplemented with `CGRect` arithmetic.
- `DarkTheme` and `LightTheme` are each ~180 lines of SwiftUI layout. Replicating both in CGContext is ~400+ lines of manual positioning code, with high risk of visual drift.
- Any future layout change in SwiftUI must be manually mirrored in the CGContext code — double maintenance.

**Sources:**
- Core Graphics Programming Guide
- `https://developer.apple.com/documentation/coregraphics/cgcontext`

#### Approach C: PDFKit / PDFDocument

**How:**
- `PDFDocument` can create pages and add annotations, but it does **not** render SwiftUI views.
- `PDFKit` is for viewing/manipulating existing PDFs, not generating them from SwiftUI.
- Not applicable as a generation path.

**Sources:**
- `https://developer.apple.com/documentation/pdfkit/pdfdocument`

---

### 5. File size implications

| Factor | Bitmap approach (current) | Native text (Approach A or B) |
|--------|--------------------------|-------------------------------|
| Text rendering | Rasterized at 14× → ~8000×11000 px for A4 | Vector text operators (~5–15 KB for a full invoice page) |
| Font embedding | N/A (baked into pixels) | Subset-embedded Menlo (~10–30 KB for Latin glyphs) |
| NoiseTexture | Baked into bitmap (no extra cost, but inflates pixel data) | Must be omitted or replaced — see below |
| Logo image | Baked into bitmap | Embedded XObject (~50–300 KB for typical logo; JPEG-compressed if large) |
| Shapes/lines | Rasterized | Vector paths (~1–3 KB total) |
| **Estimated total** | **5–20 MB** | **30–80 KB** (text + fonts + shapes + logo) |

**Font embedding notes:**
- Menlo subsets: only glyphs used in the invoice are embedded. For Latin text, expect 10–30 KB.
- System fonts embed automatically — no manual step. The PDF will render correctly on any system with a PDF viewer.
- If the invoice contains CJK or other scripts, font subsets grow but remain proportional to glyph count (typically 5–20 KB per 100 unique CJK glyphs).

**NSPrintOperation gotchas (file size):**
- `NSPrintOperation` may embed additional metadata (job name, user, printer info) — negligible size impact.
- `NSPrintOperation` may add a second blank page if content slightly exceeds the printable area. Mitigate with exact paper size + zero margins in `NSPrintInfo`.

**NoiseTexture in vector mode:**
- The `NoiseTexture` view draws 8000 random 1×1 pixel dots into a 256×256 tile, tiled across the page. In PDF vector mode:
  - Option 1: **Skip it entirely** for PDF output. The noise is a subtle paper-grain effect; omitting it is visually negligible in print.
  - Option 2: Replace with a solid background color (already present as `bgColor`).
  - Option 3: Render the noise tile once to a small image and embed it — but this adds a raster XObject and defeats the purpose.
  - **Recommendation:** Skip `NoiseTexture` when rendering to PDF (use a preprocessor flag or a `PDFMode` environment value).

---

## Comparison Table

| Approach | New layout code needed | Text quality | File size | Fidelity risk |
|----------|----------------------|--------------|-----------|---------------|
| **A: NSHostingView → PDF context** | ~30 lines (context setup + draw call) | ✅ Real selectable text, subset-embedded fonts | 30–80 KB | **Low** — reuses SwiftUI layout exactly; watch flip direction, blend modes, margins |
| **B: Manual CGContext drawing** | ~400+ lines (full layout rewrite) | ✅ Real selectable text | 20–60 KB | **High** — visual drift from SwiftUI version; double maintenance forever |
| **C: PDFKit / PDFDocument** | N/A (doesn't render SwiftUI) | N/A | N/A | N/A — not a generation path |
| **Current: ImageRenderer → bitmap** | 0 (existing) | ❌ Raster, no text layer | 5–20 MB | None (but unacceptable) |

---

## Recommended Approach

**Approach A: NSHostingView drawn into a PDF NSGraphicsContext.**

### Rationale
- **Zero new layout code** — `DarkTheme`/`LightTheme` run unmodified.
- **Real text** — SwiftUI `Text` views emit PDF text operators when the drawing context is PDF-backed.
- **Small file** — Vector text + shapes + subset fonts + one embedded logo image → 30–80 KB.
- **Low fidelity risk** — The same layout engine produces the output; only the drawing backend changes.

### Exact API Sequence

```
1. Create NSHostingView with existing InvoicePDFView, frame = page size
2. Create NSMutableData + CGDataConsumer
3. Create CGContext(consumer:mediaBox:) — PDF context
4. Create NSGraphicsContext(graphicPort: flipped:) wrapping the CGContext
5. Save current NSGraphicsContext, set new one as current
6. Call hostingView.draw(view.bounds)
7. Restore previous NSGraphicsContext
8. context.endPDFPage() / context.closePDF()
9. Write data to file
```

Alternatively, use `NSPrintOperation` for step 3–6, which handles pagination and context management:

```
1. Create NSHostingView with existing InvoicePDFView, frame = page size
2. Create NSPrintInfo with exact paper size, zero margins
3. NSPrintOperation.printOperation(with: hostingView, printInfo: showsPrintPanels: false)
4. operation.runOperation()
```

**Key implementation details to get right:**
- **Flip:** `NSGraphicsContext(graphicPort:flipped: true)` — AppKit is bottom-left origin, PDF mediaBox is bottom-left, SwiftUI is top-left. The `flipped` flag reconciles this. Verify output is not upside-down.
- **NoiseTexture:** Skip in PDF mode (conditional compilation or environment check). Solid background color is sufficient.
- **Margins:** If using `NSPrintOperation`, set `NSPrintInfo` margins to 0 and paper size to exact `PDFPageSpec` dimensions.
- **Logo:** `Image(nsImage:)` in SwiftUI should embed as PDF XObject automatically when drawn into a PDF context. Verify the logo appears (not blank).
- **Dynamic height:** The existing `data.dynamicHeight(for:)` logic already computes page height — reuse it for the `mediaBox` and `hostingView.frame`.

### What to keep
- `PDFPageSpec` — paper sizes are correct.
- `InvoiceRenderData` / `InvoiceRenderLineItem` — data model unchanged.
- `InvoicePDFView` / `DarkTheme` / `LightTheme` — unchanged (except optional NoiseTexture skip).
- `DateFormatHelper`, `CurrencyFormatter`, `Color(hex:)` — unchanged.

### What to remove/replace
- `ImageRenderer` usage in `PDFGenerator.generatePDF(for:template:paperSize:)`.
- `makePDF(cgImage:pageSize:)` — replaced by the NSGraphicsContext drawing path.
- Scale factor logic (`baseScale` 12–16×) — no longer needed.

---

## Open Questions / Risks

1. **Flip direction:** Must verify the first implementation isn't upside-down. The fix is one boolean flag, but it needs a visual check.

2. **Blend modes in NoiseTexture:** `.blendMode(.screen)` and `.blendMode(.multiply)` may produce unexpected results in PDF. Recommendation: exclude NoiseTexture from PDF rendering. If the user insists on the paper-grain effect, it can be added as a post-process (but this would rasterize the page — defeating the purpose).

3. **NSPrintOperation page breaks:** If `NSPrintOperation` is used, it may paginate. For a single-page invoice with dynamic height, the page is sized to content — there should be exactly one page. But verify no trailing blank page appears. The raw `NSGraphicsContext` approach (Approach A without `NSPrintOperation`) avoids this entirely.

4. **SwiftUI layout edge cases in non-window context:** Views using `GeometryReader`, `PreferenceKey`, or `onAppear` side effects may behave differently when hosted in an off-screen `NSHostingView`. The current `InvoicePDFView` doesn't appear to use any of these (it uses fixed frames and explicit sizing), so risk is low.

5. **Font availability:** Menlo is a system font on macOS — it will be available at render time. But if the user selects a custom font family that's not installed, the fallback (`NSFont.monospacedSystemFont`) is used. Font subset embedding handles the rest.

6. **Logo image format:** If the logo is a large PNG (e.g. >1 MB), the PDF will be larger. Consider downscaling the logo to max 600px width before embedding. This is independent of the text rendering approach.

7. **Opacity/alpha in PDF:** SwiftUI `.opacity()` maps to PDF ExtGState alpha. This is well-supported in modern PDF readers. Very old readers (pre-PDF 1.4) may flatten incorrectly, but this is negligible for a modern app.

8. **Testing:** After implementing Approach A, verify:
   - Text is selectable in Preview / Acrobat (click-drag highlights text)
   - File size is <100 KB (with logo)
   - Visual output matches the SwiftUI preview (compare side-by-side)
   - No blank trailing page
   - Logo renders correctly
   - Both DarkTheme and LightTheme work

---

## Sources

**Apple Developer Documentation:**
- `ImageRenderer` — https://developer.apple.com/documentation/swiftui/imagerenderer
- `NSPrintOperation` — https://developer.apple.com/documentation/appkit/nsprintoperation
- `NSView.printOperation(with:)` — https://developer.apple.com/documentation/appkit/nsview/printoperation(with:)
- `NSHostingView` — https://developer.apple.com/documentation/appkit/nshostingview
- `NSGraphicsContext` — https://developer.apple.com/documentation/appkit/nsgraphicscontext
- `CGContext` — https://developer.apple.com/documentation/coregraphics/cgcontext
- `CGContext(consumer:mediaBox:)` — https://developer.apple.com/documentation/coregraphics/cgcontext(_:mediabox:_:)
- `NSString.draw(in:withAttributes:)` — https://developer.apple.com/documentation/foundation/nsstring/draw(in:withattributes:)
- `CTLineDraw` — https://developer.apple.com/documentation/coretext/ctlinedraw(_:_:)
- `PDFDocument` — https://developer.apple.com/documentation/pdfkit/pdfdocument
- `NSPrintInfo` — https://developer.apple.com/documentation/appkit/nsprintinfo

**Apple Guides:**
- *Core Graphics Programming Guide — "Creating a PDF Document"*

**Note on verification:** Apple Developer Documentation was not directly fetchable via web tools during this research (returning empty/404 responses). All API descriptions and behaviors are based on the author's knowledge of Apple's frameworks, cross-referenced against the documented API surface. The core claim — that `NSHostingView.draw(_:)` into a PDF `NSGraphicsContext` emits real text — follows directly from AppKit's architecture: all `NSView` drawing goes through the current `NSGraphicsContext`, and a PDF-backed context emits PDF operators. This is the same mechanism that makes AppKit printing work for all `NSView` subclasses, including `NSHostingView`.

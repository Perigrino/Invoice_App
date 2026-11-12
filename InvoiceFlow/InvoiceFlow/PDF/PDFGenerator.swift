import SwiftUI
import AppKit
import CoreText

struct PDFPageSpec {
    let width: CGFloat
    let height: CGFloat
    
    static func size(for paperSize: String) -> PDFPageSpec {
        switch paperSize.lowercased() {
        case "a3": return PDFPageSpec(width: 841.89, height: 1190.55)
        case "letter": return PDFPageSpec(width: 612, height: 792)
        case "legal": return PDFPageSpec(width: 612, height: 1008)
        default: return PDFPageSpec(width: 595.28, height: 841.89)
        }
    }
}

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
    /// Dots per 256 pt grain tile. 40% of the original 8000: the speckle read as
    /// noise on a printed page, so the texture is a soft hint rather than grain.
    /// Shared by the PDF canvas and the SwiftUI preview so both keep matching.
    static let grainDensity = 3200

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

// MARK: - PDF Canvas

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

    func line(x: CGFloat, top: CGFloat, width: CGFloat, height: CGFloat, color: CGColor, lineWidth: CGFloat = 0.5, dash: [CGFloat]? = nil) {
        context.saveGState()
        context.setStrokeColor(color)
        context.setLineWidth(lineWidth)
        if let dash {
            context.setLineDash(phase: 0, lengths: dash)
        }
        let y = pageHeight - top
        context.move(to: CGPoint(x: x, y: y + lineWidth / 2))
        context.addLine(to: CGPoint(x: x + width, y: y + lineWidth / 2))
        context.strokePath()
        context.restoreGState()
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

// MARK: - Native PDF Renderer

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
        if let tile = PDFGrainTile.image(dot: palette.grainDot, density: PDFStyle.grainDensity) {
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

private extension InvoicePDFRenderer {
    struct Columns {
        /// SwiftUI's `Spacer()` collapses to its minimum length once the text has
        /// taken its share; it does not split the remainder equally with `Text`.
        static let spacer: CGFloat = 8

        let origin: CGFloat
        let inset: CGFloat
        let contentWidth: CGFloat
        var descriptionX: CGFloat { origin }
        var descriptionWidth: CGFloat {
            contentWidth - PDFStyle.qtyWidth - PDFStyle.moneyWidth * 2 - Self.spacer * 2
        }
        var qtyX: CGFloat { origin + descriptionWidth }
        var unitX: CGFloat { qtyX + PDFStyle.qtyWidth + Self.spacer }
        var amountX: CGFloat { unitX + PDFStyle.moneyWidth + Self.spacer }
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
        let separatorWidth = canvas.pageWidth - PDFStyle.margin * 2
        canvas.line(
            x: PDFStyle.margin, top: top + 4,
            width: separatorWidth, height: 0,
            color: color ?? palette.border,
            lineWidth: 0.5,
            dash: [6, 4, 1.5, 4]
        )
        return 14
    }

    func drawTotals(canvas: PDFCanvas, top: CGFloat, palette: PDFPalette, sz: CGFloat, family: String,
                    width: CGFloat, fmt: (Double) -> String) -> CGFloat {
        let blockWidth: CGFloat = 180
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

struct InvoiceRenderLineItem {
    var description = ""
    var quantity = 1.0
    var price = 0.0
    var tax = 0.0
    var total = 0.0
}

struct InvoiceRenderData {
    var invoiceNumber = ""
    var invoiceType = "invoice"
    var issueDate = Date()
    var dueDate: Date?
    var notes = ""
    var subtotal = 0.0
    var discount = 0.0
    var tax = 0.0
    var total = 0.0
    var clientName = ""
    var clientCompany = ""
    var clientEmail = ""
    var lineItems: [InvoiceRenderLineItem] = []
    var companyName = ""
    var companyEmail = ""
    var companyPhone = ""
    var companyAddress = ""
    var companyWebsite = ""
    var logoData: Data?
    var currencyCode = "USD"
    var dateFormat = "MM/DD/YYYY"
    var accentHex = "#60a5fa"
    var secondaryHex = "#059669"
    var fontFamily = "Menlo"
    var fontSize: CGFloat = 9
    var showInvoiceId = true
    var showDueDate = true
    var showCurrency = true
    var showDiscount = true
    var showTax = true
    var showNote = true
    
    var invoiceTypeDisplayName: String {
        invoiceType == "proforma" ? "Proforma Invoice" : invoiceType.capitalized
    }
    
    func dynamicHeight(for paperSize: String) -> CGFloat {
        let base = PDFPageSpec.size(for: paperSize).height
        let lineHeight: CGFloat = 22
        let headerHeight: CGFloat = 280
        let footerHeight: CGFloat = 100
        let tableHeight = CGFloat(max(lineItems.count, 1)) * lineHeight + 40
        let contentHeight = headerHeight + tableHeight + footerHeight + 140
        return max(base, contentHeight)
    }
}

// MARK: - PDF Generator

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

    // ponytail: parity harness only — deleted in Task 8 once the pixel-diff gate passes.
    private func makePDF(cgImage: CGImage, pageSize: NSSize) throws -> Data {
        let data = NSMutableData()
        guard let consumer = CGDataConsumer(data: data as CFMutableData) else {
            throw PDFGeneratorError.couldNotCreateConsumer
        }
        var mediaBox = CGRect(origin: .zero, size: pageSize)
        guard let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
            throw PDFGeneratorError.couldNotCreateContext
        }
        context.beginPDFPage(nil)
        context.interpolationQuality = .high
        context.setShouldAntialias(true)
        context.setAllowsFontSmoothing(true)
        context.setShouldSmoothFonts(true)
        context.draw(cgImage, in: mediaBox)
        context.endPDFPage()
        context.closePDF()
        return data as Data
    }
}

enum PDFGeneratorError: LocalizedError {
    case couldNotCreateConsumer, couldNotCreateContext, couldNotRenderImage
    var errorDescription: String? {
        switch self {
        case .couldNotCreateConsumer: return "Could not create the PDF data consumer."
        case .couldNotCreateContext: return "Could not create the PDF drawing context."
        case .couldNotRenderImage: return "Could not render the invoice image."
        }
    }
}

// MARK: - Router

struct InvoicePDFView: View {
    let data: InvoiceRenderData
    let template: PDFTemplate
    let paperSize: String
    private var spec: PDFPageSpec { PDFPageSpec.size(for: paperSize) }
    private var accent: Color { Color(hex: cleanHex(data.accentHex)) }
    private var secondary: Color { Color(hex: cleanHex(data.secondaryHex)) }
    private func cleanHex(_ h: String) -> String { let v = h.hasPrefix("#") ? String(h.dropFirst()) : h; return v.isEmpty ? "60a5fa" : v }
    
    var body: some View {
        Group {
            switch template {
            case .dark: DarkTheme(data: data, accent: accent, secondary: secondary, spec: spec, paperSize: paperSize)
            case .light: LightTheme(data: data, accent: accent, secondary: secondary, spec: spec, paperSize: paperSize)
            }
        }
        .background(template == .dark ? Color(red: 0.051, green: 0.051, blue: 0.078) : Color(red: 0.98, green: 0.98, blue: 0.98))
    }
}

// MARK: - Font helper

private func dynamicFont(size: CGFloat, weight: Font.Weight = .regular, family: String = "Menlo") -> Font {
    let nsFont = NSFont(name: family, size: size) ?? NSFont.monospacedSystemFont(ofSize: size, weight: .regular)
    var descriptor = nsFont.fontDescriptor
    let traits: [NSFontDescriptor.TraitKey: Any]
    switch weight {
    case .black, .heavy, .bold:
        traits = [NSFontDescriptor.TraitKey.symbolic: NSFontDescriptor.SymbolicTraits.monoSpace.rawValue | NSFontDescriptor.SymbolicTraits.bold.rawValue]
    case .semibold, .medium:
        traits = [NSFontDescriptor.TraitKey.symbolic: NSFontDescriptor.SymbolicTraits.monoSpace.rawValue]
    default:
        traits = [NSFontDescriptor.TraitKey.symbolic: NSFontDescriptor.SymbolicTraits.monoSpace.rawValue]
    }
    descriptor = descriptor.addingAttributes([.traits: traits])
    let finalFont = NSFont(descriptor: descriptor, size: size) ?? nsFont
    return Font(finalFont)
}

// ═══════════════════════════════════════════════════════════════
// MARK: - DARK THEME (matches HTML preview exactly)
// ═══════════════════════════════════════════════════════════════

private struct DarkTheme: View {
    let data: InvoiceRenderData
    let accent: Color
    let secondary: Color
    let spec: PDFPageSpec
    let paperSize: String
    
    private let bgColor = Color(red: 0.051, green: 0.051, blue: 0.078)
    private let textColor = Color(red: 0.6, green: 0.6, blue: 0.6)
    private let boldColor = Color(red: 0.87, green: 0.87, blue: 0.87)
    private let borderColor = Color(red: 0.13, green: 0.13, blue: 0.13)
    private var family: String { data.fontFamily }
    private var sz: CGFloat { data.fontSize }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header - centered
            HStack {
                Spacer()
                BracketLabel(text: "\(data.invoiceTypeDisplayName) — \(fmt(data.total))", accent: accent, textColor: boldColor)
                    .font(dynamicFont(size: sz + 1, weight: .medium, family: family))
                Spacer()
            }
            .padding(.top, 24)
            .padding(.bottom, 20)
            
            // Logo + Ref
            HStack(alignment: .top) {
                AccentLogo(data: data, accent: accent, height: 90, maxWidth: 280)
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    refRow("Ref", data.invoiceNumber)
                    refRow("Issued", DateFormatHelper.string(from: data.issueDate, format: data.dateFormat))
                    if data.showDueDate, let due = data.dueDate {
                        refRow("Due", "\(DateFormatHelper.string(from: due, format: data.dateFormat)) · Net 14")
                    }
                }
            }
            .padding(.horizontal, 36)
            
            AccentLine(accent: accent).padding(.horizontal, 36).padding(.vertical, 20)
            
            // From / Bill to
            HStack(alignment: .top, spacing: 200) {
                VStack(alignment: .leading, spacing: 4) {
                    BracketLabel(text: "From", accent: accent, textColor: boldColor).font(dynamicFont(size: sz, weight: .medium, family: family))
                    if !data.companyName.isEmpty {
                        Text(data.companyName).font(dynamicFont(size: sz + 2, weight: .bold, family: family)).foregroundColor(boldColor)
                    }
                    addressBlock(data.companyAddress, data.companyEmail, data.companyPhone)
                }
                VStack(alignment: .leading, spacing: 4) {
                    BracketLabel(text: "Bill to", accent: accent, textColor: boldColor).font(dynamicFont(size: sz, weight: .medium, family: family))
                    if !data.clientName.isEmpty {
                        Text(data.clientName).font(dynamicFont(size: sz + 2, weight: .bold, family: family)).foregroundColor(boldColor)
                    }
                    if !data.clientCompany.isEmpty {
                        Text(data.clientCompany).font(dynamicFont(size: sz, family: family)).foregroundColor(textColor)
                    }
                    if !data.clientEmail.isEmpty {
                        Text(data.clientEmail).font(dynamicFont(size: sz, family: family)).foregroundColor(textColor.opacity(0.7))
                    }
                }
            }
            .padding(.horizontal, 36)
            .padding(.top, 8)
            
            AccentLine(accent: accent).padding(.horizontal, 36).padding(.vertical, 20)
            
            // Table header
            HStack {
                Text("Description").frame(maxWidth: .infinity, alignment: .leading)
                Text("Qty").frame(width: 70, alignment: .trailing)
                Spacer()
                Text("Unit price").frame(width: 130, alignment: .trailing)
                Spacer()
                Text("Amount").frame(width: 130, alignment: .trailing)
            }
            .font(dynamicFont(size: sz, weight: .medium, family: family))
            .foregroundColor(boldColor)
            .padding(.vertical, 6)
            .padding(.horizontal, 12)
            .background(secondary.opacity(0.2))
            .padding(.horizontal, 36)
            
            DashedSeparator(color: borderColor, family: family).padding(.horizontal, 36)
            
            ForEach(Array(data.lineItems.enumerated()), id: \.offset) { idx, item in
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(item.description.isEmpty ? "—" : item.description).frame(maxWidth: .infinity, alignment: .leading)
                        Text("\(Int(item.quantity))").frame(width: 70, alignment: .trailing)
                        Spacer()
                        Text(fmt(item.price)).frame(width: 130, alignment: .trailing)
                        Spacer()
                        Text(fmt(item.total)).frame(width: 130, alignment: .trailing)
                    }
                    .font(dynamicFont(size: sz, family: family))
                    .foregroundColor(boldColor)
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 48)
                
                if idx < data.lineItems.count - 1 {
                    DashedSeparator(color: borderColor.opacity(0.5), family: family).padding(.horizontal, 36)
                }
            }
            
            // Totals
            HStack {
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    totalsRow("Subtotal", fmt(data.subtotal))
                    if data.showDiscount && data.discount > 0 {
                        totalsRow("Discount", "-\(fmt(data.discount))", color: .red)
                    }
                    Divider().background(borderColor).frame(width: 180)
                    HStack(spacing: 8) {
                        Text("Total").font(dynamicFont(size: sz + 1, weight: .bold, family: family)).foregroundColor(accent)
                        Text(fmt(data.total)).font(dynamicFont(size: sz + 2, weight: .bold, family: family)).foregroundColor(accent)
                    }
                }
            }
            .padding(.horizontal, 36)
            .padding(.top, 16)
            
            // Notes
            HStack {
                Spacer()
                if data.showNote && !data.notes.isEmpty {
                    Text(data.notes).font(dynamicFont(size: sz - 0.5, family: family)).foregroundColor(textColor.opacity(0.6)).multilineTextAlignment(.center).lineSpacing(4)
                } else {
                    Text("Thank you for your business! Payment is due within 14 days of invoice date.").font(dynamicFont(size: sz - 0.5, family: family)).foregroundColor(textColor.opacity(0.4)).multilineTextAlignment(.center).lineSpacing(4)
                }
                Spacer()
            }
            .padding(.horizontal, 36)
            .padding(.top, 32)
            .padding(.bottom, 24)
        }
        .frame(width: spec.width, height: data.dynamicHeight(for: paperSize))
        .background {
            ZStack {
                bgColor
                NoiseTexture(
                    dotColor: Color.white.opacity(0.06),
                    opacity: 0.35,
                    density: PDFStyle.grainDensity,
                    blendMode: .screen
                )
                .allowsHitTesting(false)
            }
        }
    }

    private func refRow(_ label: String, _ value: String) -> some View {
        HStack(spacing: 8) {
            Text(label).font(dynamicFont(size: sz, family: family)).foregroundColor(textColor.opacity(0.5))
            Text(value).font(dynamicFont(size: sz, weight: .medium, family: family)).foregroundColor(boldColor)
        }
    }
    
    private func addressBlock(_ address: String, _ email: String, _ phone: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            if !address.isEmpty {
                ForEach(address.components(separatedBy: "\n"), id: \.self) { line in
                    Text(line).font(dynamicFont(size: sz, family: family)).foregroundColor(textColor)
                }
            }
            if !email.isEmpty { Text(email).font(dynamicFont(size: sz, family: family)).foregroundColor(textColor.opacity(0.7)) }
            if !phone.isEmpty { Text(phone).font(dynamicFont(size: sz, family: family)).foregroundColor(textColor.opacity(0.7)) }
        }
    }
    
    private func totalsRow(_ label: String, _ value: String, color: Color? = nil) -> some View {
        HStack {
            Text(label).font(dynamicFont(size: sz, family: family)).foregroundColor(textColor.opacity(0.6))
            Spacer()
            Text(value).font(dynamicFont(size: sz, weight: .medium, family: family)).foregroundColor(color ?? boldColor)
        }
    }
    
    private func fmt(_ v: Double) -> String { CurrencyFormatter.shared.string(from: v, currencyCode: data.currencyCode) }
}

// ═══════════════════════════════════════════════════════════════
// MARK: - LIGHT THEME (matches HTML preview exactly)
// ═══════════════════════════════════════════════════════════════

private struct LightTheme: View {
    let data: InvoiceRenderData
    let accent: Color
    let secondary: Color
    let spec: PDFPageSpec
    let paperSize: String
    
    private let bgColor = Color(red: 0.98, green: 0.98, blue: 0.98)
    private let textColor = Color(red: 0.33, green: 0.33, blue: 0.33)
    private let boldColor = Color(red: 0.07, green: 0.07, blue: 0.07)
    private let borderColor = Color(red: 0.82, green: 0.82, blue: 0.82)
    private var family: String { data.fontFamily }
    private var sz: CGFloat { data.fontSize }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Spacer()
                BracketLabel(text: "\(data.invoiceTypeDisplayName) — \(fmt(data.total))", accent: accent, textColor: boldColor)
                    .font(dynamicFont(size: sz + 1, weight: .medium, family: family))
                Spacer()
            }
            .padding(.top, 24)
            .padding(.bottom, 20)
            
            HStack(alignment: .top) {
                AccentLogo(data: data, accent: accent, height: 90, maxWidth: 280)
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    refRow("Ref", data.invoiceNumber)
                    refRow("Issued", DateFormatHelper.string(from: data.issueDate, format: data.dateFormat))
                    if data.showDueDate, let due = data.dueDate {
                        refRow("Due", "\(DateFormatHelper.string(from: due, format: data.dateFormat)) · Net 14")
                    }
                }
            }
            .padding(.horizontal, 36)
            
            AccentLine(accent: accent).padding(.horizontal, 36).padding(.vertical, 20)
            
            HStack(alignment: .top, spacing: 200) {
                VStack(alignment: .leading, spacing: 4) {
                    BracketLabel(text: "From", accent: accent, textColor: boldColor).font(dynamicFont(size: sz, weight: .medium, family: family))
                    if !data.companyName.isEmpty {
                        Text(data.companyName).font(dynamicFont(size: sz + 2, weight: .bold, family: family)).foregroundColor(boldColor)
                    }
                    addressBlock(data.companyAddress, data.companyEmail, data.companyPhone)
                }
                VStack(alignment: .leading, spacing: 4) {
                    BracketLabel(text: "Bill to", accent: accent, textColor: boldColor).font(dynamicFont(size: sz, weight: .medium, family: family))
                    if !data.clientName.isEmpty {
                        Text(data.clientName).font(dynamicFont(size: sz + 2, weight: .bold, family: family)).foregroundColor(boldColor)
                    }
                    if !data.clientCompany.isEmpty {
                        Text(data.clientCompany).font(dynamicFont(size: sz, family: family)).foregroundColor(textColor)
                    }
                    if !data.clientEmail.isEmpty {
                        Text(data.clientEmail).font(dynamicFont(size: sz, family: family)).foregroundColor(textColor.opacity(0.7))
                    }
                }
            }
            .padding(.horizontal, 36)
            .padding(.top, 8)
            
            AccentLine(accent: accent).padding(.horizontal, 36).padding(.vertical, 20)
            
            HStack {
                Text("Description").frame(maxWidth: .infinity, alignment: .leading)
                Text("Qty").frame(width: 70, alignment: .trailing)
                Spacer()
                Text("Unit price").frame(width: 130, alignment: .trailing)
                Spacer()
                Text("Amount").frame(width: 130, alignment: .trailing)
            }
            .font(dynamicFont(size: sz, weight: .medium, family: family))
            .foregroundColor(boldColor)
            .padding(.vertical, 6)
            .padding(.horizontal, 12)
            .background(secondary.opacity(0.15))
            .padding(.horizontal, 36)
            
            DashedSeparator(color: borderColor, family: family).padding(.horizontal, 36)
            
            ForEach(Array(data.lineItems.enumerated()), id: \.offset) { idx, item in
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(item.description.isEmpty ? "—" : item.description).frame(maxWidth: .infinity, alignment: .leading)
                        Text("\(Int(item.quantity))").frame(width: 70, alignment: .trailing)
                        Spacer()
                        Text(fmt(item.price)).frame(width: 130, alignment: .trailing)
                        Spacer()
                        Text(fmt(item.total)).frame(width: 130, alignment: .trailing)
                    }
                    .font(dynamicFont(size: sz, family: family))
                    .foregroundColor(boldColor)
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 48)
                
                if idx < data.lineItems.count - 1 {
                    DashedSeparator(color: borderColor.opacity(0.5), family: family).padding(.horizontal, 36)
                }
            }
            
            HStack {
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    totalsRow("Subtotal", fmt(data.subtotal))
                    if data.showDiscount && data.discount > 0 {
                        totalsRow("Discount", "-\(fmt(data.discount))", color: .red)
                    }
                    Divider().background(borderColor).frame(width: 180)
                    HStack(spacing: 8) {
                        Text("Total").font(dynamicFont(size: sz + 1, weight: .bold, family: family)).foregroundColor(accent)
                        Text(fmt(data.total)).font(dynamicFont(size: sz + 2, weight: .bold, family: family)).foregroundColor(accent)
                    }
                }
            }
            .padding(.horizontal, 36)
            .padding(.top, 16)
            
            HStack {
                Spacer()
                if data.showNote && !data.notes.isEmpty {
                    Text(data.notes).font(dynamicFont(size: sz - 0.5, family: family)).foregroundColor(textColor.opacity(0.6)).multilineTextAlignment(.center).lineSpacing(4)
                } else {
                    Text("Thank you for your business! Payment is due within 14 days of invoice date.").font(dynamicFont(size: sz - 0.5, family: family)).foregroundColor(textColor.opacity(0.4)).multilineTextAlignment(.center).lineSpacing(4)
                }
                Spacer()
            }
            .padding(.horizontal, 36)
            .padding(.top, 32)
            .padding(.bottom, 24)
        }
        .frame(width: spec.width, height: data.dynamicHeight(for: paperSize))
        .background {
            ZStack {
                bgColor
                NoiseTexture(
                    dotColor: Color.black.opacity(0.05),
                    opacity: 0.35,
                    density: PDFStyle.grainDensity,
                    blendMode: .multiply
                )
                .allowsHitTesting(false)
            }
        }
    }
    
    private func refRow(_ label: String, _ value: String) -> some View {
        HStack(spacing: 8) {
            Text(label).font(dynamicFont(size: sz, family: family)).foregroundColor(textColor.opacity(0.5))
            Text(value).font(dynamicFont(size: sz, weight: .medium, family: family)).foregroundColor(boldColor)
        }
    }
    
    private func addressBlock(_ address: String, _ email: String, _ phone: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            if !address.isEmpty {
                ForEach(address.components(separatedBy: "\n"), id: \.self) { line in
                    Text(line).font(dynamicFont(size: sz, family: family)).foregroundColor(textColor)
                }
            }
            if !email.isEmpty { Text(email).font(dynamicFont(size: sz, family: family)).foregroundColor(textColor.opacity(0.7)) }
            if !phone.isEmpty { Text(phone).font(dynamicFont(size: sz, family: family)).foregroundColor(textColor.opacity(0.7)) }
        }
    }
    
    private func totalsRow(_ label: String, _ value: String, color: Color? = nil) -> some View {
        HStack {
            Text(label).font(dynamicFont(size: sz, family: family)).foregroundColor(textColor.opacity(0.6))
            Spacer()
            Text(value).font(dynamicFont(size: sz, weight: .medium, family: family)).foregroundColor(color ?? boldColor)
        }
    }
    
    private func fmt(_ v: Double) -> String { CurrencyFormatter.shared.string(from: v, currencyCode: data.currencyCode) }
}

// ═══════════════════════════════════════════════════════════════
// MARK: - Shared Components
// ═══════════════════════════════════════════════════════════════

private struct AccentLogo: View {
    let data: InvoiceRenderData
    let accent: Color
    var height: CGFloat = 60
    var maxWidth: CGFloat = 160
    
    var body: some View {
        if let d = data.logoData, let img = NSImage(data: d) {
            Image(nsImage: img).resizable().interpolation(.high).scaledToFit().frame(height: height).frame(maxWidth: maxWidth)
        } else {
            HStack(spacing: 8) {
                Circle().strokeBorder(accent, lineWidth: 2).frame(width: 20, height: 20)
                    .overlay(Circle().fill(accent).frame(width: 10, height: 10))
                if !data.companyName.isEmpty {
                    Text(data.companyName).font(dynamicFont(size: 16, weight: .bold, family: data.fontFamily))
                }
            }
        }
    }
}

private struct AccentLine: View {
    let accent: Color
    var body: some View { Rectangle().fill(accent.opacity(0.4)).frame(height: 1) }
}

private struct DashedSeparator: View {
    let color: Color
    var family: String = "Menlo"
    var body: some View {
        Text(String(repeating: "- ", count: 70))
            .font(dynamicFont(size: 9, family: family))
            .foregroundColor(color)
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct BracketLabel: View {
    let text: String
    let accent: Color
    var textColor: Color = .white
    var body: some View {
        HStack(spacing: 0) {
            Text("[").foregroundColor(accent)
            Text(" \(text) ").foregroundColor(textColor)
            Text("]").foregroundColor(accent)
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// MARK: - Paper Texture
// ═══════════════════════════════════════════════════════════════

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

private struct NoiseTexture: View {
    let dotColor: Color
    let opacity: Double
    let density: Int
    var blendMode: BlendMode = .normal

    var body: some View {
        if let tile = Self.tile(density: density, color: dotColor) {
            Image(nsImage: tile)
                .resizable(resizingMode: .tile)
                .blendMode(blendMode)
                .opacity(opacity)
                .allowsHitTesting(false)
        }
    }

    private static func tile(density: Int, color: Color) -> NSImage? {
        let side: CGFloat = 256
        let dot = NSColor(color)
        guard let cgImage = PDFGrainTile.image(dot: dot, density: density) else { return nil }
        return NSImage(cgImage: cgImage, size: NSSize(width: side, height: side))
    }
}

import Foundation
import PDFKit
import AppKit

struct PDFPageSpec {
    let width: CGFloat
    let height: CGFloat

    static func size(for paperSize: String) -> PDFPageSpec {
        switch paperSize.lowercased() {
        case "a3": return PDFPageSpec(width: 841.89, height: 1190.55)
        case "letter": return PDFPageSpec(width: 612, height: 792)
        case "legal": return PDFPageSpec(width: 612, height: 1008)
        default: return PDFPageSpec(width: 595.28, height: 841.89) // A4
        }
    }
}

class PDFGenerator {
    private var setting: Setting?

    func generatePDF(for invoice: Invoice, template: PDFTemplate = .modern, setting: Setting? = nil, paperSize: String? = nil) -> URL? {
        self.setting = setting
        let pageSpec = PDFPageSpec.size(for: paperSize ?? setting?.paperSize ?? "A4")
        let pageRect = CGRect(x: 0, y: 0, width: pageSpec.width, height: pageSpec.height)

        let data = NSMutableData()
        guard let consumer = CGDataConsumer(data: data as CFMutableData),
              let pdfContext = CGContext(consumer: consumer, mediaBox: nil, nil) else {
            return nil
        }

        var mediaBox = pageRect
        pdfContext.beginPage(mediaBox: &mediaBox)

        switch template {
        case .modern: drawModern(in: pdfContext, pageRect: pageRect, invoice: invoice)
        case .business: drawBusiness(in: pdfContext, pageRect: pageRect, invoice: invoice)
        case .minimal: drawMinimal(in: pdfContext, pageRect: pageRect, invoice: invoice)
        case .professional: drawProfessional(in: pdfContext, pageRect: pageRect, invoice: invoice)
        case .elegant: drawElegant(in: pdfContext, pageRect: pageRect, invoice: invoice)
        }

        pdfContext.endPage()
        pdfContext.closePDF()

        let tempDir = FileManager.default.temporaryDirectory
        let fileURL = tempDir.appendingPathComponent("\(invoice.invoiceNumber).pdf")
        try? (data as Data).write(to: fileURL)
        return fileURL
    }

    // MARK: - Shared helpers

    private var accentColor: NSColor {
        NSColor(hex: (setting?.pdfAccentColor ?? "#1E3A5F").replacingOccurrences(of: "#", with: ""))
    }

    private var secondaryColor: NSColor {
        NSColor(hex: (setting?.pdfSecondaryColor ?? "#059669").replacingOccurrences(of: "#", with: ""))
    }

    private var companyName: String {
        setting?.companyName?.isEmpty == false ? setting!.companyName! : (setting?.profileName ?? "Your Company")
    }

    private func drawLogo(in context: CGContext, pageRect: CGRect, x: CGFloat, y: CGFloat, maxHeight: CGFloat) {
        guard let data = setting?.logoData, let image = NSImage(data: data) else { return }
        let size = image.size
        guard size.width > 0, size.height > 0 else { return }
        let scale = min(maxHeight / size.height, 120 / size.width, 1)
        let drawWidth = size.width * scale
        let drawHeight = size.height * scale
        let rect = CGRect(x: x, y: y - drawHeight, width: drawWidth, height: drawHeight)
        if let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) {
            context.saveGState()
            context.interpolationQuality = .high
            context.draw(cgImage, in: rect)
            context.restoreGState()
        }
    }

    private func drawBillTo(in context: CGContext, pageRect: CGRect, invoice: Invoice, x: CGFloat, y: CGFloat) {
        guard let client = invoice.client else { return }

        let labelAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 9, weight: .semibold),
            .foregroundColor: NSColor.secondaryLabelColor
        ]
        let nameAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 11, weight: .medium),
            .foregroundColor: NSColor.labelColor
        ]
        let detailAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 10),
            .foregroundColor: NSColor.secondaryLabelColor
        ]

        NSAttributedString(string: "BILL TO", attributes: labelAttr).draw(at: CGPoint(x: x, y: y))
        var yCursor = y - 16
        NSAttributedString(string: client.fullName, attributes: nameAttr).draw(at: CGPoint(x: x, y: yCursor))
        yCursor -= 14
        if let company = client.company, !company.isEmpty {
            NSAttributedString(string: company, attributes: detailAttr).draw(at: CGPoint(x: x, y: yCursor))
            yCursor -= 14
        }
        if let email = client.email, !email.isEmpty {
            NSAttributedString(string: email, attributes: detailAttr).draw(at: CGPoint(x: x, y: yCursor))
        }
    }

    private func drawLineItemsTable(in context: CGContext, pageRect: CGRect, invoice: Invoice, startY: CGFloat, headerColor: NSColor, headerTextColor: NSColor = .white) {
        let margin: CGFloat = 40
        let colWidths: [CGFloat] = [pageRect.width - 320, 50, 80, 80, 110]
        let headers = ["Description", "Qty", "Price", "Tax", "Total"]
        let headerAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 9, weight: .semibold),
            .foregroundColor: headerTextColor
        ]

        let headerRect = CGRect(x: margin, y: startY - 22, width: pageRect.width - margin * 2, height: 22)
        context.setFillColor(headerColor.cgColor)
        context.fill(headerRect)

        var x: CGFloat = margin + 8
        for (i, header) in headers.enumerated() {
            let alignment = i >= 3 ? NSParagraphStyle.alignmentRight() : NSParagraphStyle.alignmentLeft()
            let attr = [NSAttributedString.Key.font: NSFont.systemFont(ofSize: 9, weight: .semibold),
                        .foregroundColor: headerTextColor,
                        .paragraphStyle: alignment] as [NSAttributedString.Key: Any]
            NSAttributedString(string: header, attributes: attr).draw(in: CGRect(x: x, y: startY - 16, width: colWidths[i], height: 14))
            x += colWidths[i]
        }

        let itemAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 10),
            .foregroundColor: NSColor.labelColor
        ]
        let itemMutedAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 10),
            .foregroundColor: NSColor.secondaryLabelColor
        ]

        var y = startY - 44
        for (index, item) in (invoice.lineItems ?? []).enumerated() {
            if index % 2 == 1 {
                context.setFillColor(NSColor.gray.withAlphaComponent(0.05).cgColor)
                context.fill(CGRect(x: margin, y: y - 2, width: pageRect.width - margin * 2, height: 22))
            }
            x = margin + 8
            let values = [item.itemDescription, "\(Int(item.quantity))", formatCurrency(item.price), "\(Int(item.tax))%", formatCurrency(item.total)]
            for (i, text) in values.enumerated() {
                let attr = i >= 3 ? itemMutedAttr : itemAttr
                let paragraph = NSParagraphStyle.alignmentRight()
                var drawAttr = attr
                if i >= 3 {
                    drawAttr = [NSAttributedString.Key.font: NSFont.systemFont(ofSize: 10),
                                .foregroundColor: NSColor.labelColor,
                                .paragraphStyle: paragraph]
                }
                if i == 4 {
                    drawAttr = [NSAttributedString.Key.font: NSFont.systemFont(ofSize: 10, weight: .semibold),
                                .foregroundColor: NSColor.labelColor,
                                .paragraphStyle: paragraph]
                }
                NSAttributedString(string: text, attributes: drawAttr).draw(in: CGRect(x: x, y: y, width: colWidths[i], height: 16))
                x += colWidths[i]
            }
            y -= 24
        }

        context.setStrokeColor(NSColor.gray.withAlphaComponent(0.3).cgColor)
        context.setLineWidth(0.5)
        context.move(to: CGPoint(x: margin, y: y))
        context.addLine(to: CGPoint(x: pageRect.width - margin, y: y))
        context.strokePath()
    }

    private func drawTotals(in context: CGContext, pageRect: CGRect, invoice: Invoice, y: CGFloat, totalColor: NSColor? = nil) {
        let x = pageRect.width - 250
        var yCursor = y

        let labelAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 10),
            .foregroundColor: NSColor.secondaryLabelColor
        ]
        let valueAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 10, weight: .medium),
            .foregroundColor: NSColor.labelColor
        ]
        let totalAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 15, weight: .bold),
            .foregroundColor: totalColor ?? NSColor.labelColor
        ]

        func row(_ label: String, _ value: String, _ attr: [NSAttributedString.Key: Any]) {
            NSAttributedString(string: label, attributes: attr).draw(at: CGPoint(x: x, y: yCursor))
            let para = NSParagraphStyle.alignmentRight()
            var valueAttrWithAlign = attr
            valueAttrWithAlign[.paragraphStyle] = para
            NSAttributedString(string: value, attributes: valueAttrWithAlign).draw(in: CGRect(x: x + 110, y: yCursor, width: 100, height: 16))
            yCursor -= 20
        }

        row("Subtotal", formatCurrency(invoice.subtotal), valueAttr)
        if invoice.discount > 0 {
            row("Discount", "-\(formatCurrency(invoice.discount))", valueAttr)
        }
        if invoice.tax > 0 {
            row("Tax", "+\(formatCurrency(invoice.tax))", valueAttr)
        }

        context.setStrokeColor(NSColor.gray.withAlphaComponent(0.3).cgColor)
        context.setLineWidth(0.5)
        context.move(to: CGPoint(x: x, y: yCursor + 10))
        context.addLine(to: CGPoint(x: pageRect.width - 40, y: yCursor + 10))
        context.strokePath()
        yCursor -= 18

        row("Total", formatCurrency(invoice.total), totalAttr)
    }

    private func drawNotes(in context: CGContext, pageRect: CGRect, invoice: Invoice, y: CGFloat) {
        guard let notes = invoice.notes, !notes.isEmpty else { return }

        let margin: CGFloat = 40
        let notesAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 9),
            .foregroundColor: NSColor.secondaryLabelColor
        ]
        NSAttributedString(string: "Notes", attributes: [
            .font: NSFont.systemFont(ofSize: 9, weight: .semibold),
            .foregroundColor: NSColor.secondaryLabelColor
        ]).draw(at: CGPoint(x: margin, y: y))

        NSAttributedString(string: notes, attributes: notesAttr).draw(at: CGPoint(x: margin, y: y - 16))
    }

    // MARK: - Modern

    private func drawModern(in context: CGContext, pageRect: CGRect, invoice: Invoice) {
        // Accent bar at top
        context.setFillColor(accentColor.cgColor)
        context.fill(CGRect(x: 0, y: pageRect.height - 80, width: pageRect.width, height: 80))

        drawLogo(in: context, pageRect: pageRect, x: 40, y: pageRect.height - 20, maxHeight: 44)

        let titleX: CGFloat = setting?.logoData != nil ? 170 : 40
        let titleAttributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 26, weight: .bold),
            .foregroundColor: NSColor.white
        ]
        NSAttributedString(string: invoice.invoiceType.uppercased(), attributes: titleAttributes)
            .draw(at: CGPoint(x: titleX, y: pageRect.height - 62))

        let numAttributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 13, weight: .medium),
            .foregroundColor: NSColor.white.withAlphaComponent(0.75)
        ]
        NSAttributedString(string: invoice.invoiceNumber, attributes: numAttributes)
            .draw(at: CGPoint(x: titleX, y: pageRect.height - 32))

        // Company + dates on right side of header band
        let companyAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 11, weight: .semibold),
            .foregroundColor: NSColor.white
        ]
        NSAttributedString(string: companyName, attributes: companyAttr)
            .draw(at: CGPoint(x: pageRect.width - 260, y: pageRect.height - 28))

        drawBillTo(in: context, pageRect: pageRect, invoice: invoice, x: 40, y: pageRect.height - 150)

        drawLineItemsTable(in: context, pageRect: pageRect, invoice: invoice, startY: pageRect.height - 210, headerColor: accentColor)
        drawTotals(in: context, pageRect: pageRect, invoice: invoice, y: 240, totalColor: accentColor)
        drawNotes(in: context, pageRect: pageRect, invoice: invoice, y: 120)
    }

    // MARK: - Business

    private func drawBusiness(in context: CGContext, pageRect: CGRect, invoice: Invoice) {
        let margin: CGFloat = 40

        drawLogo(in: context, pageRect: pageRect, x: margin, y: pageRect.height - 20, maxHeight: 48)
        let logoPresent = setting?.logoData != nil
        let nameY = logoPresent ? pageRect.height - 70 : pageRect.height - 40
        let nameAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 20, weight: .bold),
            .foregroundColor: NSColor.labelColor
        ]
        NSAttributedString(string: companyName, attributes: nameAttr).draw(at: CGPoint(x: margin, y: nameY))

        // Company contact details
        var contactLines: [String] = []
        if let email = setting?.companyEmail, !email.isEmpty { contactLines.append(email) }
        if let phone = setting?.companyPhone, !phone.isEmpty { contactLines.append(phone) }
        if let address = setting?.companyAddress, !address.isEmpty { contactLines.append(address) }
        let contactAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 9),
            .foregroundColor: NSColor.secondaryLabelColor
        ]
        var y = nameY - 16
        for line in contactLines.prefix(3) {
            NSAttributedString(string: line, attributes: contactAttr).draw(at: CGPoint(x: margin, y: y))
            y -= 13
        }

        // Title + number, right-aligned
        let titleAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 24, weight: .bold),
            .foregroundColor: accentColor
        ]
        let para = NSParagraphStyle.alignmentRight()
        var titleDraw = titleAttr
        titleDraw[.paragraphStyle] = para
        NSAttributedString(string: invoice.invoiceType.uppercased(), attributes: titleDraw)
            .draw(in: CGRect(x: pageRect.width - 300, y: pageRect.height - 60, width: 260, height: 28))

        let numAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 12, weight: .medium),
            .foregroundColor: NSColor.secondaryLabelColor,
            .paragraphStyle: para
        ]
        NSAttributedString(string: invoice.invoiceNumber, attributes: numAttr)
            .draw(in: CGRect(x: pageRect.width - 300, y: pageRect.height - 34, width: 260, height: 16))

        // Divider
        context.setStrokeColor(accentColor.cgColor)
        context.setLineWidth(2)
        context.move(to: CGPoint(x: margin, y: pageRect.height - 110))
        context.addLine(to: CGPoint(x: pageRect.width - margin, y: pageRect.height - 110))
        context.strokePath()

        drawBillTo(in: context, pageRect: pageRect, invoice: invoice, x: margin, y: pageRect.height - 150)
        drawLineItemsTable(in: context, pageRect: pageRect, invoice: invoice, startY: pageRect.height - 210, headerColor: accentColor)
        drawTotals(in: context, pageRect: pageRect, invoice: invoice, y: 240, totalColor: accentColor)
        drawNotes(in: context, pageRect: pageRect, invoice: invoice, y: 120)
    }

    // MARK: - Minimal

    private func drawMinimal(in context: CGContext, pageRect: CGRect, invoice: Invoice) {
        let margin: CGFloat = 48

        drawLogo(in: context, pageRect: pageRect, x: margin, y: pageRect.height - 20, maxHeight: 40)
        let logoPresent = setting?.logoData != nil
        let nameY = logoPresent ? pageRect.height - 62 : pageRect.height - 44
        let nameAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 18, weight: .semibold),
            .foregroundColor: NSColor.labelColor
        ]
        NSAttributedString(string: companyName, attributes: nameAttr).draw(at: CGPoint(x: margin, y: nameY))

        // Small caps title, right aligned
        let titleAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 14, weight: .medium),
            .foregroundColor: NSColor.labelColor
        ]
        let para = NSParagraphStyle.alignmentRight()
        var titleDraw = titleAttr
        titleDraw[.paragraphStyle] = para
        NSAttributedString(string: invoice.invoiceType.uppercased(), attributes: titleDraw)
            .draw(in: CGRect(x: pageRect.width - 320, y: pageRect.height - 52, width: 272, height: 18))
        let numAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 11),
            .foregroundColor: NSColor.secondaryLabelColor,
            .paragraphStyle: para
        ]
        NSAttributedString(string: invoice.invoiceNumber, attributes: numAttr)
            .draw(in: CGRect(x: pageRect.width - 320, y: pageRect.height - 34, width: 272, height: 16))

        // Thin rule
        context.setStrokeColor(NSColor.gray.withAlphaComponent(0.4).cgColor)
        context.setLineWidth(0.5)
        context.move(to: CGPoint(x: margin, y: pageRect.height - 92))
        context.addLine(to: CGPoint(x: pageRect.width - margin, y: pageRect.height - 92))
        context.strokePath()

        // Dates in a row
        var dateY = pageRect.height - 130
        let dateLabelAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 8, weight: .semibold),
            .foregroundColor: NSColor.secondaryLabelColor
        ]
        let dateValueAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 10),
            .foregroundColor: NSColor.labelColor
        ]
        NSAttributedString(string: "ISSUE DATE", attributes: dateLabelAttr).draw(at: CGPoint(x: margin, y: dateY))
        NSAttributedString(string: invoice.issueDate.formatted(date: .abbreviated, time: .omitted), attributes: dateValueAttr)
            .draw(at: CGPoint(x: margin, y: dateY - 14))
        if let dueDate = invoice.dueDate {
            NSAttributedString(string: "DUE DATE", attributes: dateLabelAttr).draw(at: CGPoint(x: margin + 200, y: dateY))
            NSAttributedString(string: dueDate.formatted(date: .abbreviated, time: .omitted), attributes: dateValueAttr)
                .draw(at: CGPoint(x: margin + 200, y: dateY - 14))
        }

        drawBillTo(in: context, pageRect: pageRect, invoice: invoice, x: margin, y: pageRect.height - 230)
        drawLineItemsTable(in: context, pageRect: pageRect, invoice: invoice, startY: pageRect.height - 300, headerColor: NSColor.gray.withAlphaComponent(0.12), headerTextColor: .labelColor)
        drawTotals(in: context, pageRect: pageRect, invoice: invoice, y: 220)
        drawNotes(in: context, pageRect: pageRect, invoice: invoice, y: 110)
    }

    // MARK: - Professional

    private func drawProfessional(in context: CGContext, pageRect: CGRect, invoice: Invoice) {
        let margin: CGFloat = 40

        // Double top border
        context.setStrokeColor(accentColor.cgColor)
        context.setLineWidth(3)
        context.move(to: CGPoint(x: 0, y: pageRect.height - 12))
        context.addLine(to: CGPoint(x: pageRect.width, y: pageRect.height - 12))
        context.strokePath()
        context.setStrokeColor(NSColor.gray.withAlphaComponent(0.3).cgColor)
        context.setLineWidth(0.5)
        context.move(to: CGPoint(x: 0, y: pageRect.height - 20))
        context.addLine(to: CGPoint(x: pageRect.width, y: pageRect.height - 20))
        context.strokePath()

        drawLogo(in: context, pageRect: pageRect, x: margin, y: pageRect.height - 68, maxHeight: 46)
        let logoPresent = setting?.logoData != nil
        let nameY = logoPresent ? pageRect.height - 118 : pageRect.height - 60
        let nameAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 18, weight: .semibold),
            .foregroundColor: NSColor.labelColor
        ]
        NSAttributedString(string: companyName, attributes: nameAttr).draw(at: CGPoint(x: margin, y: nameY))

        // Title block, right
        let titleAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 22, weight: .bold),
            .foregroundColor: NSColor.labelColor
        ]
        let para = NSParagraphStyle.alignmentRight()
        var titleDraw = titleAttr
        titleDraw[.paragraphStyle] = para
        NSAttributedString(string: invoice.invoiceType.uppercased(), attributes: titleDraw)
            .draw(in: CGRect(x: pageRect.width - 320, y: pageRect.height - 70, width: 280, height: 26))
        let numAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 12, weight: .medium),
            .foregroundColor: secondaryColor,
            .paragraphStyle: para
        ]
        NSAttributedString(string: invoice.invoiceNumber, attributes: numAttr)
            .draw(in: CGRect(x: pageRect.width - 320, y: pageRect.height - 44, width: 280, height: 16))

        // Info strip
        let stripY = pageRect.height - 150
        context.setFillColor(secondaryColor.withAlphaComponent(0.1).cgColor)
        context.fill(CGRect(x: 0, y: stripY, width: pageRect.width, height: 30))

        var stripX: CGFloat = margin
        let stripLabelAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 8, weight: .semibold),
            .foregroundColor: NSColor.secondaryLabelColor
        ]
        let stripValueAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 10, weight: .medium),
            .foregroundColor: NSColor.labelColor
        ]
        NSAttributedString(string: "ISSUED", attributes: stripLabelAttr).draw(at: CGPoint(x: stripX, y: stripY + 16))
        NSAttributedString(string: invoice.issueDate.formatted(date: .abbreviated, time: .omitted), attributes: stripValueAttr)
            .draw(at: CGPoint(x: stripX, y: stripY + 3))
        stripX += 160
        if let dueDate = invoice.dueDate {
            NSAttributedString(string: "DUE", attributes: stripLabelAttr).draw(at: CGPoint(x: stripX, y: stripY + 16))
            NSAttributedString(string: dueDate.formatted(date: .abbreviated, time: .omitted), attributes: stripValueAttr)
                .draw(at: CGPoint(x: stripX, y: stripY + 3))
            stripX += 160
        }
        NSAttributedString(string: "TYPE", attributes: stripLabelAttr).draw(at: CGPoint(x: stripX, y: stripY + 16))
        NSAttributedString(string: invoice.invoiceType.capitalized, attributes: stripValueAttr)
            .draw(at: CGPoint(x: stripX, y: stripY + 3))

        drawBillTo(in: context, pageRect: pageRect, invoice: invoice, x: margin, y: pageRect.height - 210)
        drawLineItemsTable(in: context, pageRect: pageRect, invoice: invoice, startY: pageRect.height - 270, headerColor: secondaryColor)
        drawTotals(in: context, pageRect: pageRect, invoice: invoice, y: 240, totalColor: secondaryColor)
        drawNotes(in: context, pageRect: pageRect, invoice: invoice, y: 120)
    }

    // MARK: - Elegant

    private func drawElegant(in context: CGContext, pageRect: CGRect, invoice: Invoice) {
        let margin: CGFloat = 56

        // Centered title
        let titleAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont(name: "Georgia", size: 24) ?? NSFont.systemFont(ofSize: 24, weight: .bold),
            .foregroundColor: NSColor.labelColor
        ]
        let para = NSParagraphStyle.alignmentCenter()
        var titleDraw = titleAttr
        titleDraw[.paragraphStyle] = para
        NSAttributedString(string: invoice.invoiceType.uppercased(), attributes: titleDraw)
            .draw(in: CGRect(x: 80, y: pageRect.height - 74, width: pageRect.width - 160, height: 28))

        let numAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 11, weight: .medium),
            .foregroundColor: accentColor,
            .paragraphStyle: para
        ]
        NSAttributedString(string: invoice.invoiceNumber, attributes: numAttr)
            .draw(in: CGRect(x: 80, y: pageRect.height - 48, width: pageRect.width - 160, height: 16))

        // Ornamental double rules around title
        let ruleY = pageRect.height - 100
        context.setStrokeColor(NSColor.gray.withAlphaComponent(0.5).cgColor)
        context.setLineWidth(0.5)
        context.move(to: CGPoint(x: margin, y: ruleY))
        context.addLine(to: CGPoint(x: pageRect.width / 2 - 120, y: ruleY))
        context.strokePath()
        context.move(to: CGPoint(x: pageRect.width / 2 + 120, y: ruleY))
        context.addLine(to: CGPoint(x: pageRect.width - margin, y: ruleY))
        context.strokePath()

        // Company centered
        let companyAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont(name: "Georgia", size: 14) ?? NSFont.systemFont(ofSize: 14, weight: .medium),
            .foregroundColor: NSColor.labelColor,
            .paragraphStyle: para
        ]
        NSAttributedString(string: companyName, attributes: companyAttr)
            .draw(in: CGRect(x: 100, y: pageRect.height - 138, width: pageRect.width - 200, height: 18))

        drawLogo(in: context, pageRect: pageRect, x: pageRect.width / 2 - 30, y: pageRect.height - 186, maxHeight: 48)

        let bodyY = setting?.logoData != nil ? pageRect.height - 250 : pageRect.height - 200
        drawBillTo(in: context, pageRect: pageRect, invoice: invoice, x: margin, y: bodyY)

        // Dates on right side of bill-to block
        if let dueDate = invoice.dueDate {
            let rightX = pageRect.width - 180
            let dateLabelAttr: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 8, weight: .semibold),
                .foregroundColor: NSColor.secondaryLabelColor
            ]
            let dateValueAttr: [NSAttributedString.Key: Any] = [
                .font: NSFont(name: "Georgia", size: 11) ?? NSFont.systemFont(ofSize: 11),
                .foregroundColor: NSColor.labelColor
            ]
            NSAttributedString(string: "ISSUE DATE", attributes: dateLabelAttr).draw(at: CGPoint(x: rightX, y: bodyY))
            NSAttributedString(string: invoice.issueDate.formatted(date: .abbreviated, time: .omitted), attributes: dateValueAttr)
                .draw(at: CGPoint(x: rightX, y: bodyY - 15))
            NSAttributedString(string: "DUE DATE", attributes: dateLabelAttr).draw(at: CGPoint(x: rightX, y: bodyY - 38))
            NSAttributedString(string: dueDate.formatted(date: .abbreviated, time: .omitted), attributes: dateValueAttr)
                .draw(at: CGPoint(x: rightX, y: bodyY - 53))
        }

        drawLineItemsTable(in: context, pageRect: pageRect, invoice: invoice, startY: bodyY - 80, headerColor: NSColor.gray.withAlphaComponent(0.1), headerTextColor: .labelColor)
        drawTotals(in: context, pageRect: pageRect, invoice: invoice, y: 230, totalColor: accentColor)
        drawNotes(in: context, pageRect: pageRect, invoice: invoice, y: 120)
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = setting?.currency ?? "USD"
        return formatter.string(from: NSNumber(value: amount)) ?? "$0.00"
    }
}

private extension NSParagraphStyle {
    static func alignmentRight() -> NSParagraphStyle {
        let style = NSMutableParagraphStyle()
        style.alignment = .right
        return style
    }

    static func alignmentLeft() -> NSParagraphStyle {
        let style = NSMutableParagraphStyle()
        style.alignment = .left
        return style
    }

    static func alignmentCenter() -> NSParagraphStyle {
        let style = NSMutableParagraphStyle()
        style.alignment = .center
        return style
    }
}

extension NSColor {
    convenience init(hex: String) {
        let scanner = Scanner(string: hex)
        var rgbValue: UInt64 = 0
        scanner.scanHexInt64(&rgbValue)
        let r = CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0
        let g = CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0
        let b = CGFloat(rgbValue & 0x0000FF) / 255.0
        self.init(red: r, green: g, blue: b, alpha: 1.0)
    }
}
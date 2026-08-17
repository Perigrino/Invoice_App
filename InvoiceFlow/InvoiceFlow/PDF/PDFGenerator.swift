import Foundation
import PDFKit
import AppKit

class PDFGenerator {
    func generatePDF(for invoice: Invoice) -> URL? {
        let pageRect = CGRect(x: 0, y: 0, width: 595.28, height: 841.89) // A4

        let data = NSMutableData()
        guard let consumer = CGDataConsumer(data: data as CFMutableData),
              let pdfContext = CGContext(consumer: consumer, mediaBox: nil, nil) else {
            return nil
        }

        var mediaBox = pageRect

        // Page 1
        pdfContext.beginPage(mediaBox: &mediaBox)

        drawHeader(in: pdfContext, pageRect: pageRect, invoice: invoice)
        drawLineItems(in: pdfContext, pageRect: pageRect, invoice: invoice)
        drawTotals(in: pdfContext, pageRect: pageRect, invoice: invoice)
        drawFooter(in: pdfContext, pageRect: pageRect, invoice: invoice)

        pdfContext.endPage()
        pdfContext.closePDF()

        let tempDir = FileManager.default.temporaryDirectory
        let fileURL = tempDir.appendingPathComponent("\(invoice.invoiceNumber).pdf")
        try? (data as Data).write(to: fileURL)
        return fileURL
    }

    private func drawHeader(in context: CGContext, pageRect: CGRect, invoice: Invoice) {
        let accentColor = NSColor(hex: "1E3A5F").cgColor

        // Accent bar at top
        context.setFillColor(accentColor)
        context.fill(CGRect(x: 0, y: pageRect.height - 80, width: pageRect.width, height: 80))

        // Invoice title
        let titleAttributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 28, weight: .bold),
            .foregroundColor: NSColor.white
        ]
        let titleStr = NSAttributedString(string: invoice.invoiceType.uppercased(), attributes: titleAttributes)
        titleStr.draw(at: CGPoint(x: 40, y: pageRect.height - 65))

        // Invoice number
        let numAttributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 14, weight: .medium),
            .foregroundColor: NSColor.white.withAlphaComponent(0.7)
        ]
        let numStr = NSAttributedString(string: invoice.invoiceNumber, attributes: numAttributes)
        numStr.draw(at: CGPoint(x: 40, y: pageRect.height - 35))

        // Status badge
        let statusColor = statusColor(for: invoice.status).cgColor
        context.setFillColor(statusColor)
        let badgeRect = CGRect(x: pageRect.width - 120, y: pageRect.height - 55, width: 80, height: 24)
        let badgePath = CGPath(roundedRect: badgeRect, cornerWidth: 12, cornerHeight: 12, transform: nil)
        context.addPath(badgePath)
        context.fillPath()

        let statusAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 11, weight: .semibold),
            .foregroundColor: NSColor.white
        ]
        let statusStr = NSAttributedString(string: invoice.status.uppercased(), attributes: statusAttr)
        let statusSize = statusStr.size()
        statusStr.draw(at: CGPoint(x: badgeRect.midX - statusSize.width / 2, y: badgeRect.midY - statusSize.height / 2))
    }

    private func drawLineItems(in context: CGContext, pageRect: CGRect, invoice: Invoice) {
        let startY = pageRect.height - 120
        let margin: CGFloat = 40
        let colWidths: [CGFloat] = [250, 60, 80, 80, 100]

        let headers = ["Description", "Qty", "Price", "Tax", "Total"]
        let headerAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 10, weight: .semibold),
            .foregroundColor: NSColor.gray
        ]

        var x: CGFloat = margin
        for (i, header) in headers.enumerated() {
            NSAttributedString(string: header, attributes: headerAttr).draw(at: CGPoint(x: x, y: startY))
            x += colWidths[i]
        }

        context.setStrokeColor(NSColor.gray.withAlphaComponent(0.3).cgColor)
        context.setLineWidth(0.5)
        context.move(to: CGPoint(x: margin, y: startY - 8))
        context.addLine(to: CGPoint(x: pageRect.width - margin, y: startY - 8))
        context.strokePath()

        let itemAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 11),
            .foregroundColor: NSColor.labelColor
        ]

        var y = startY - 28
        for item in invoice.lineItems ?? [] {
            x = margin
            let items = [item.itemDescription, "\(Int(item.quantity))", formatCurrency(item.price), "\(Int(item.tax))%", formatCurrency(item.total)]
            for (i, text) in items.enumerated() {
                NSAttributedString(string: text, attributes: itemAttr).draw(at: CGPoint(x: x, y: y))
                x += colWidths[i]
            }
            y -= 24
        }
    }

    private func drawTotals(in context: CGContext, pageRect: CGRect, invoice: Invoice) {
        let x = pageRect.width - 250
        var y: CGFloat = 200

        let labelAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 11),
            .foregroundColor: NSColor.secondaryLabelColor
        ]
        let valueAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 11, weight: .medium),
            .foregroundColor: NSColor.labelColor
        ]
        let totalAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 16, weight: .bold),
            .foregroundColor: NSColor.labelColor
        ]

        NSAttributedString(string: "Subtotal", attributes: labelAttr).draw(at: CGPoint(x: x, y: y))
        NSAttributedString(string: formatCurrency(invoice.subtotal), attributes: valueAttr).draw(at: CGPoint(x: x + 150, y: y))
        y -= 20

        if invoice.discount > 0 {
            NSAttributedString(string: "Discount", attributes: labelAttr).draw(at: CGPoint(x: x, y: y))
            NSAttributedString(string: "-\(formatCurrency(invoice.discount))", attributes: valueAttr).draw(at: CGPoint(x: x + 150, y: y))
            y -= 20
        }

        if invoice.tax > 0 {
            NSAttributedString(string: "Tax", attributes: labelAttr).draw(at: CGPoint(x: x, y: y))
            NSAttributedString(string: "+\(formatCurrency(invoice.tax))", attributes: valueAttr).draw(at: CGPoint(x: x + 150, y: y))
            y -= 20
        }

        context.setStrokeColor(NSColor.gray.withAlphaComponent(0.3).cgColor)
        context.setLineWidth(0.5)
        context.move(to: CGPoint(x: x, y: y + 8))
        context.addLine(to: CGPoint(x: x + 230, y: y + 8))
        context.strokePath()
        y -= 12

        NSAttributedString(string: "Total", attributes: totalAttr).draw(at: CGPoint(x: x, y: y))
        NSAttributedString(string: formatCurrency(invoice.total), attributes: totalAttr).draw(at: CGPoint(x: x + 150, y: y))
    }

    private func drawFooter(in context: CGContext, pageRect: CGRect, invoice: Invoice) {
        guard let notes = invoice.notes, !notes.isEmpty else { return }

        let margin: CGFloat = 40
        let notesAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 10),
            .foregroundColor: NSColor.secondaryLabelColor
        ]

        NSAttributedString(string: "Notes", attributes: [
            .font: NSFont.systemFont(ofSize: 10, weight: .semibold),
            .foregroundColor: NSColor.secondaryLabelColor
        ]).draw(at: CGPoint(x: margin, y: 140))

        NSAttributedString(string: notes, attributes: notesAttr).draw(at: CGPoint(x: margin, y: 120))
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: amount)) ?? "$0.00"
    }

    private func statusColor(for status: String) -> NSColor {
        switch status {
        case "draft": return .gray
        case "pending": return .systemOrange
        case "paid": return .systemGreen
        case "overdue": return .systemRed
        default: return .gray
        }
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

import XCTest
import PDFKit
import AppKit
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
            print("PDF TEXT [\(template.rawValue)] >>>\n\(text)\n<<< END")
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

        // Opaque logo (no alpha) — forces JPEG re-encode path in LogoImage.prepare.
        let logo = NSImage(size: NSSize(width: 1200, height: 1200))
        logo.lockFocus()
        NSColor.systemRed.setFill()
        NSRect(origin: .zero, size: NSSize(width: 1200, height: 1200)).fill()
        logo.unlockFocus()
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

        // A rasterized page would carry an image as wide as the page in pixels
        // (12–16× scale ≈ 7,000–9,000). The grain tile is 256 and the logo is
        // capped at 600, so any width above 1024 means the page became a bitmap.
        let widths = Self.imageWidths(in: raw)
        XCTAssertFalse(widths.isEmpty, "expected the grain tile image XObject")
        XCTAssertLessThanOrEqual(widths.max() ?? 0, 1024, "page-sized image found: widths \(widths)")
    }

    @MainActor
    func testExportSurvivesPDFKitRoundTrip() throws {
        let (_, document) = try makePDF(sample(rows: 6))
        let roundTripped = try XCTUnwrap(document.dataRepresentation())
        XCTAssertLessThan(roundTripped.count, 250_000)
    }

    /// `/Width 1234` belongs to image XObjects. Font width arrays are `/Widths`,
    /// so requiring a digit after optional whitespace keeps them out.
    static func imageWidths(in pdf: String) -> [Int] {
        guard let regex = try? NSRegularExpression(pattern: "/Width\\s*([0-9]+)") else { return [] }
        let range = NSRange(pdf.startIndex..<pdf.endIndex, in: pdf)
        return regex.matches(in: pdf, range: range).compactMap { match in
            guard let valueRange = Range(match.range(at: 1), in: pdf) else { return nil }
            return Int(pdf[valueRange])
        }
    }

    @MainActor
    func testAllPaperSizesRenderOnePage() throws {
        for paper in ["A4", "A3", "Letter", "Legal"] {
            let (_, document) = try makePDF(sample(rows: 24), paper: paper)
            XCTAssertEqual(document.pageCount, 1, "\(paper) produced \(document.pageCount) pages")
        }
    }
}

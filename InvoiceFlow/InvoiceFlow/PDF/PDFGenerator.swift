import SwiftUI
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

// MARK: - Render data

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
    var accentHex = "#1E3A5F"
    var secondaryHex = "#059669"
    var showInvoiceId = true
    var showDueDate = true
    var showCurrency = true
    var showDiscount = true
    var showTax = true
    var showNote = true
}

// MARK: - PDF Generator

@MainActor
final class PDFGenerator {
    func generatePDF(for data: InvoiceRenderData, template: PDFTemplate = .modern, paperSize: String? = nil) -> URL? {
        let spec = PDFPageSpec.size(for: paperSize ?? "A4")
        let pageSize = NSSize(width: spec.width, height: spec.height)

        let rootView = InvoicePDFView(data: data, template: template, paperSize: paperSize ?? "A4")
            .frame(width: spec.width, height: spec.height)

        let renderer = ImageRenderer(content: rootView)
        renderer.scale = 3.0
        renderer.isOpaque = true
        guard let image = renderer.nsImage,
              let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return nil
        }

        let tempDir = FileManager.default.temporaryDirectory
        let fileName = data.invoiceNumber.isEmpty ? "invoice.pdf" : "\(data.invoiceNumber).pdf"
        let fileURL = tempDir.appendingPathComponent(fileName)
        do {
            let pdfData = try makePDF(cgImage: cgImage, pageSize: pageSize)
            try pdfData.write(to: fileURL)
            return fileURL
        } catch {
            return nil
        }
    }

    private func makePDF(cgImage: CGImage, pageSize: NSSize) throws -> Data {
        let data = NSMutableData()
        guard let consumer = CGDataConsumer(data: data as CFMutableData) else {
            throw PDFGeneratorError.couldNotCreateConsumer
        }
        var mediaBox = CGRect(origin: .zero, size: CGSize(width: pageSize.width, height: pageSize.height))
        guard let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
            throw PDFGeneratorError.couldNotCreateContext
        }
        context.beginPDFPage(nil)
        context.interpolationQuality = .high
        context.draw(cgImage, in: mediaBox)
        context.endPDFPage()
        context.closePDF()
        return data as Data
    }
}

enum PDFGeneratorError: LocalizedError {
    case couldNotCreateConsumer
    case couldNotCreateContext
    var errorDescription: String? {
        switch self {
        case .couldNotCreateConsumer: return "Could not create the PDF data consumer."
        case .couldNotCreateContext: return "Could not create the PDF drawing context."
        }
    }
}

// MARK: - Invoice PDF View (Router)

struct InvoicePDFView: View {
    let data: InvoiceRenderData
    let template: PDFTemplate
    let paperSize: String

    private var spec: PDFPageSpec { PDFPageSpec.size(for: paperSize) }
    private var accent: Color { Color(hex: cleanHex(data.accentHex)) }
    private var secondary: Color { Color(hex: cleanHex(data.secondaryHex)) }
    private func cleanHex(_ hex: String) -> String {
        let v = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        return v.isEmpty ? "1E3A5F" : v
    }

    var body: some View {
        Group {
            switch template {
            case .modern: ModernTheme(data: data, accent: accent, spec: spec)
            case .business: BusinessTheme(data: data, accent: accent, spec: spec)
            case .minimal: MinimalTheme(data: data, spec: spec)
            case .professional: ProfessionalTheme(data: data, accent: accent, secondary: secondary, spec: spec)
            }
        }
        .background(Color.white)
    }
}

// ═══════════════════════════════════════════════════════════════════════
// MARK: - SHARED BUILDING BLOCKS
// ═══════════════════════════════════════════════════════════════════════

private struct BigLogo: View {
    let data: InvoiceRenderData
    var height: CGFloat = 64
    var maxWidth: CGFloat = 180

    var body: some View {
        if let logoData = data.logoData, let image = NSImage(data: logoData) {
            Image(nsImage: image)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(height: height)
                .frame(maxWidth: maxWidth)
        }
    }
}

private struct TableClean: View {
    let data: InvoiceRenderData
    var headerBg: Color = Color.black
    var headerFg: Color = .white
    var altRow: Bool = true
    var borderColor: Color = Color.black.opacity(0.12)

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("ITEM DESCRIPTION").frame(maxWidth: .infinity, alignment: .leading)
                Text("QTY").frame(width: 50, alignment: .trailing)
                Text("PRICE").frame(width: 80, alignment: .trailing)
                Text("TOTAL").frame(width: 90, alignment: .trailing)
            }
            .font(.system(size: 8.5, weight: .bold))
            .foregroundColor(headerFg)
            .kerning(0.8)
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(headerBg)

            ForEach(Array(data.lineItems.enumerated()), id: \.offset) { idx, item in
                HStack {
                    Text(item.description.isEmpty ? "—" : item.description).frame(maxWidth: .infinity, alignment: .leading)
                    Text(fmt(item.quantity)).frame(width: 50, alignment: .trailing)
                    Text(fmt(item.price)).frame(width: 80, alignment: .trailing)
                    Text(fmt(item.total)).frame(width: 90, alignment: .trailing)
                }
                .font(.system(size: 8.5))
                .foregroundColor(.black)
                .padding(.vertical, 7)
                .padding(.horizontal, 12)
                .background(altRow && idx % 2 == 0 ? Color.black.opacity(0.03) : Color.clear)
                Divider().overlay(borderColor)
            }

            if data.lineItems.isEmpty {
                HStack { Text("No line items").foregroundColor(.gray); Spacer() }
                    .font(.system(size: 9)).padding(12)
            }
        }
        .overlay(Rectangle().stroke(borderColor, lineWidth: 0.5))
    }

    private func fmt(_ v: Double) -> String { CurrencyFormatter.shared.string(from: v, currencyCode: data.currencyCode) }
}

private struct TotalsBlock: View {
    let data: InvoiceRenderData
    var accent: Color = .black
    var filledTotal = false

    var body: some View {
        VStack(alignment: .trailing, spacing: 5) {
            if data.showCurrency {
                tRow("SUB TOTAL", fmt(data.subtotal))
                if data.showDiscount && data.discount > 0 { tRow("DISCOUNT", "-\(fmt(data.discount))", color: .red) }
                if data.showTax && data.tax > 0 { tRow("TAX", "+\(fmt(data.tax))", color: .green) }
            }
            Divider().frame(width: 200)
            HStack(spacing: 12) {
                Text("TOTAL").font(.system(size: 13, weight: .bold))
                Text(fmt(data.total))
                    .font(.system(size: 16, weight: .black))
                    .foregroundColor(accent)
            }
            .padding(filledTotal ? EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16) : EdgeInsets())
            .background(filledTotal ? accent : Color.clear)
            .foregroundColor(filledTotal ? .white : .black)
            .clipShape(RoundedRectangle(cornerRadius: 4))
        }
        .frame(width: 220)
    }

    private func tRow(_ l: String, _ v: String, color: Color = .black) -> some View {
        HStack { Text(l).font(.system(size: 9, weight: .medium)).foregroundColor(.gray); Spacer(); Text(v).font(.system(size: 9, weight: .semibold)).foregroundColor(color) }
    }
    private func fmt(_ v: Double) -> String { CurrencyFormatter.shared.string(from: v, currencyCode: data.currencyCode) }
}

// ═══════════════════════════════════════════════════════════════════════
// MARK: - MODERN THEME — M2: Dark Header
// Dark header bar with logo + big "INVOICE" title, notes at bottom
// ═══════════════════════════════════════════════════════════════════════

private struct ModernTheme: View {
    let data: InvoiceRenderData
    let accent: Color
    let spec: PDFPageSpec

    var body: some View {
        VStack(spacing: 0) {
            // Dark header with logo and invoice title
            HStack(alignment: .center) {
                BigLogo(data: data, height: 72, maxWidth: 190)
                Spacer()
                VStack(alignment: .trailing, spacing: 6) {
                    Text(data.invoiceType.uppercased())
                        .font(.system(size: 32, weight: .black))
                        .foregroundColor(.white)
                        .tracking(2)
                    if data.showInvoiceId {
                        Text(data.invoiceNumber)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.white.opacity(0.7))
                    }
                }
            }
            .padding(.horizontal, 40)
            .padding(.vertical, 24)
            .background(Color(red: 0.11, green: 0.11, blue: 0.13))

            // Company info + dates row
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    if !data.companyName.isEmpty {
                        Text(data.companyName).font(.system(size: 15, weight: .bold)).foregroundColor(.black)
                    }
                    if !data.companyAddress.isEmpty { Text(data.companyAddress).font(.system(size: 9)).foregroundColor(.gray) }
                    if !data.companyEmail.isEmpty || !data.companyPhone.isEmpty {
                        Text([data.companyEmail, data.companyPhone].filter { !$0.isEmpty }.joined(separator: "  •  "))
                            .font(.system(size: 8.5)).foregroundColor(.gray)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    if data.showInvoiceId {
                        HStack(spacing: 6) {
                            Text("Invoice No.").font(.system(size: 8, weight: .bold)).foregroundColor(.gray)
                            Text(data.invoiceNumber).font(.system(size: 11, weight: .bold)).foregroundColor(.black)
                        }
                    }
                    HStack(spacing: 6) {
                        Text("Issue Date").font(.system(size: 8, weight: .bold)).foregroundColor(.gray)
                        Text(DateFormatHelper.string(from: data.issueDate, format: data.dateFormat)).font(.system(size: 10)).foregroundColor(.black)
                    }
                    if data.showDueDate, let due = data.dueDate {
                        HStack(spacing: 6) {
                            Text("Due Date").font(.system(size: 8, weight: .bold)).foregroundColor(.gray)
                            Text(DateFormatHelper.string(from: due, format: data.dateFormat)).font(.system(size: 10)).foregroundColor(.black)
                        }
                    }
                }
            }.padding(.horizontal, 40).padding(.top, 20).padding(.bottom, 12)

            // Accent divider
            Rectangle().fill(accent).frame(height: 2).padding(.horizontal, 40)

            // Client info
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("INVOICE TO:").font(.system(size: 9, weight: .bold)).foregroundColor(.gray).tracking(1)
                    if !data.clientName.isEmpty { Text(data.clientName).font(.system(size: 13, weight: .bold)).foregroundColor(.black) }
                    if !data.clientCompany.isEmpty { Text(data.clientCompany).font(.system(size: 10)).foregroundColor(.gray) }
                    if !data.clientEmail.isEmpty { Text(data.clientEmail).font(.system(size: 9)).foregroundColor(.gray) }
                }
                Spacer()
            }.padding(.horizontal, 40).padding(.top, 16)

            // Table
            TableClean(data: data, headerBg: accent, headerFg: .white)
                .padding(.horizontal, 40).padding(.top, 12)

            // Totals
            HStack(alignment: .top) { Spacer(); TotalsBlock(data: data, accent: accent, filledTotal: true) }
                .padding(.horizontal, 40).padding(.top, 8)

            Spacer(minLength: 0)

            // Notes + Terms at bottom
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    if data.showNote && !data.notes.isEmpty {
                        Text("*NOTES:").font(.system(size: 9, weight: .bold)).foregroundColor(.black)
                        Text(data.notes).font(.system(size: 8)).foregroundColor(.gray)
                    } else {
                        Text("*NOTES:").font(.system(size: 9, weight: .bold)).foregroundColor(.black)
                        Text("_______________________________").font(.system(size: 8)).foregroundColor(.gray.opacity(0.5))
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text("THANK YOU FOR YOUR BUSINESS!").font(.system(size: 9, weight: .bold)).foregroundColor(accent).tracking(0.5)
                    Text("TERM & CONDITIONS:").font(.system(size: 7.5, weight: .bold)).foregroundColor(.black)
                    Text("Payment is due within 30 days of invoice date.\nLate payments may incur a 5% fee.")
                        .font(.system(size: 7)).foregroundColor(.gray)
                }
            }.padding(.horizontal, 40).padding(.top, 8)

            // Footer
            HStack {
                if !data.companyName.isEmpty { Text(data.companyName).font(.system(size: 7)).foregroundColor(.gray) }
                Spacer()
            }.padding(.horizontal, 40).padding(.vertical, 10)
        }
        .frame(width: spec.width, height: spec.height)
        .background(Color.white)
    }
}

// ═══════════════════════════════════════════════════════════════════════
// MARK: - BUSINESS THEME — B1: Corporate
// Full accent header with big logo, notes at bottom
// ═══════════════════════════════════════════════════════════════════════

private struct BusinessTheme: View {
    let data: InvoiceRenderData
    let accent: Color
    let spec: PDFPageSpec

    var body: some View {
        VStack(spacing: 0) {
            // Full accent header with logo and invoice title
            HStack(alignment: .center) {
                BigLogo(data: data, height: 80, maxWidth: 200)
                Spacer()
                VStack(alignment: .trailing, spacing: 6) {
                    Text(data.invoiceType.uppercased())
                        .font(.system(size: 32, weight: .black))
                        .foregroundColor(.white)
                        .tracking(2)
                    if data.showInvoiceId {
                        Text("Invoice #\(data.invoiceNumber)")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.white.opacity(0.8))
                    }
                }
            }
            .padding(.horizontal, 40)
            .padding(.vertical, 28)
            .background(accent)

            // Company info + dates row
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    if !data.companyName.isEmpty {
                        Text(data.companyName).font(.system(size: 15, weight: .bold)).foregroundColor(.black)
                    }
                    if !data.companyAddress.isEmpty { Text(data.companyAddress).font(.system(size: 9)).foregroundColor(.gray) }
                    if !data.companyEmail.isEmpty || !data.companyPhone.isEmpty {
                        Text([data.companyEmail, data.companyPhone].filter { !$0.isEmpty }.joined(separator: "  •  "))
                            .font(.system(size: 8.5)).foregroundColor(.gray)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    HStack(spacing: 6) {
                        Text("Issue Date").font(.system(size: 8, weight: .bold)).foregroundColor(.gray)
                        Text(DateFormatHelper.string(from: data.issueDate, format: data.dateFormat)).font(.system(size: 10)).foregroundColor(.black)
                    }
                    if data.showDueDate, let due = data.dueDate {
                        HStack(spacing: 6) {
                            Text("Due Date").font(.system(size: 8, weight: .bold)).foregroundColor(.gray)
                            Text(DateFormatHelper.string(from: due, format: data.dateFormat)).font(.system(size: 10)).foregroundColor(.black)
                        }
                    }
                }
            }.padding(.horizontal, 40).padding(.top, 20).padding(.bottom, 12)

            // Client info
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("BILL TO:").font(.system(size: 9, weight: .bold)).foregroundColor(.gray).tracking(1)
                    if !data.clientName.isEmpty { Text(data.clientName).font(.system(size: 13, weight: .bold)).foregroundColor(.black) }
                    if !data.clientCompany.isEmpty { Text(data.clientCompany).font(.system(size: 10)).foregroundColor(.gray) }
                    if !data.clientEmail.isEmpty { Text(data.clientEmail).font(.system(size: 9)).foregroundColor(.gray) }
                }
                Spacer()
            }.padding(.horizontal, 40).padding(.top, 12)

            // Table
            TableClean(data: data, headerBg: accent, headerFg: .white)
                .padding(.horizontal, 40).padding(.top, 12)

            // Totals
            HStack(alignment: .top) { Spacer(); TotalsBlock(data: data, accent: accent, filledTotal: true) }
                .padding(.horizontal, 40).padding(.top, 8)

            Spacer(minLength: 0)

            // Notes + Terms at bottom
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    if data.showNote && !data.notes.isEmpty {
                        Text("*NOTES:").font(.system(size: 9, weight: .bold)).foregroundColor(.black)
                        Text(data.notes).font(.system(size: 8)).foregroundColor(.gray)
                    } else {
                        Text("*NOTES:").font(.system(size: 9, weight: .bold)).foregroundColor(.black)
                        Text("_______________________________").font(.system(size: 8)).foregroundColor(.gray.opacity(0.5))
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text("THANK YOU FOR YOUR BUSINESS!").font(.system(size: 9, weight: .bold)).foregroundColor(accent).tracking(0.5)
                    Text("TERM & CONDITIONS:").font(.system(size: 7.5, weight: .bold)).foregroundColor(.black)
                    Text("Payment is due within 30 days of invoice date.\nLate payments may incur a 5% fee.")
                        .font(.system(size: 7)).foregroundColor(.gray)
                }
            }.padding(.horizontal, 40).padding(.top, 8)

            // Footer
            HStack {
                if !data.companyName.isEmpty { Text(data.companyName).font(.system(size: 7)).foregroundColor(.gray) }
                Spacer()
            }.padding(.horizontal, 40).padding(.vertical, 10)
        }
        .frame(width: spec.width, height: spec.height)
        .background(Color.white)
    }
}

// ═══════════════════════════════════════════════════════════════════════
// MARK: - MINIMAL THEME — Mi2: Typewriter
// Monospace font, dotted separators, clean layout, notes at bottom
// ═══════════════════════════════════════════════════════════════════════

private struct MinimalTheme: View {
    let data: InvoiceRenderData
    let spec: PDFPageSpec

    var body: some View {
        VStack(spacing: 0) {
            // Header with logo and title
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    BigLogo(data: data, height: 64, maxWidth: 170)
                    if !data.companyName.isEmpty {
                        Text(data.companyName).font(.system(size: 16, weight: .bold, design: .monospaced)).foregroundColor(.black)
                    }
                    if !data.companyAddress.isEmpty {
                        Text(data.companyAddress).font(.system(size: 9, design: .monospaced)).foregroundColor(.gray)
                    }
                }
                Spacer(minLength: 30)
                VStack(alignment: .trailing, spacing: 6) {
                    Text(data.invoiceType.uppercased())
                        .font(.system(size: 22, weight: .bold, design: .monospaced))
                        .foregroundColor(.black)
                    if data.showInvoiceId {
                        Text(data.invoiceNumber)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(.gray)
                    }
                }
            }.padding(.horizontal, 48).padding(.top, 40).padding(.bottom, 12)

            // Dotted separator
            Text(String(repeating: "· ", count: 55))
                .font(.system(size: 8, design: .monospaced))
                .foregroundColor(.gray.opacity(0.5))
                .padding(.horizontal, 48)

            // Client + dates
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("BILL TO:").font(.system(size: 8, weight: .bold, design: .monospaced)).foregroundColor(.gray).tracking(1)
                    if !data.clientName.isEmpty {
                        Text(data.clientName).font(.system(size: 13, weight: .bold, design: .monospaced)).foregroundColor(.black)
                    }
                    if !data.clientCompany.isEmpty {
                        Text(data.clientCompany).font(.system(size: 10, design: .monospaced)).foregroundColor(.gray)
                    }
                    if !data.clientEmail.isEmpty {
                        Text(data.clientEmail).font(.system(size: 9, design: .monospaced)).foregroundColor(.gray)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    HStack(spacing: 6) {
                        Text("Issued:").font(.system(size: 8, weight: .bold, design: .monospaced)).foregroundColor(.gray)
                        Text(DateFormatHelper.string(from: data.issueDate, format: data.dateFormat)).font(.system(size: 10, design: .monospaced)).foregroundColor(.black)
                    }
                    if data.showDueDate, let due = data.dueDate {
                        HStack(spacing: 6) {
                            Text("Due:").font(.system(size: 8, weight: .bold, design: .monospaced)).foregroundColor(.gray)
                            Text(DateFormatHelper.string(from: due, format: data.dateFormat)).font(.system(size: 10, design: .monospaced)).foregroundColor(.black)
                        }
                    }
                }
            }.padding(.horizontal, 48).padding(.top, 12)

            // Table
            TableClean(data: data, headerBg: Color.black, headerFg: .white, altRow: false, borderColor: Color.black.opacity(0.08))
                .padding(.horizontal, 48).padding(.top, 12)

            // Totals
            HStack(alignment: .top) { Spacer(); TotalsBlock(data: data, accent: .black) }
                .padding(.horizontal, 48).padding(.top, 8)

            Spacer(minLength: 0)

            // Notes + Terms at bottom
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    if data.showNote && !data.notes.isEmpty {
                        Text("*NOTES:").font(.system(size: 9, weight: .bold, design: .monospaced)).foregroundColor(.black)
                        Text(data.notes).font(.system(size: 8, design: .monospaced)).foregroundColor(.gray)
                    } else {
                        Text("*NOTES:").font(.system(size: 9, weight: .bold, design: .monospaced)).foregroundColor(.black)
                        Text("_______________________________").font(.system(size: 8, design: .monospaced)).foregroundColor(.gray.opacity(0.5))
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text("THANK YOU FOR YOUR BUSINESS!").font(.system(size: 9, weight: .bold, design: .monospaced)).foregroundColor(.black).tracking(0.5)
                    Text("TERM & CONDITIONS:").font(.system(size: 7.5, weight: .bold, design: .monospaced)).foregroundColor(.black)
                    Text("Payment is due within 30 days of invoice date.\nLate payments may incur a 5% fee.")
                        .font(.system(size: 7, design: .monospaced)).foregroundColor(.gray)
                }
            }.padding(.horizontal, 48).padding(.top, 8)

            // Footer
            HStack {
                if !data.companyName.isEmpty { Text(data.companyName).font(.system(size: 7, design: .monospaced)).foregroundColor(.gray) }
                Spacer()
            }.padding(.horizontal, 48).padding(.vertical, 10)
        }
        .frame(width: spec.width, height: spec.height)
        .background(Color.white)
    }
}

// ═══════════════════════════════════════════════════════════════════════
// MARK: - PROFESSIONAL THEME — P4: Bordered
// Big logo, bold title, bordered client/dates cards, notes at bottom
// ═══════════════════════════════════════════════════════════════════════

private struct ProfessionalTheme: View {
    let data: InvoiceRenderData
    let accent: Color
    let secondary: Color
    let spec: PDFPageSpec

    var body: some View {
        VStack(spacing: 0) {
            // Header with big logo and bold title
            HStack(alignment: .top) {
                BigLogo(data: data, height: 88, maxWidth: 220)
                Spacer()
                VStack(alignment: .trailing, spacing: 6) {
                    Text(data.invoiceType.uppercased())
                        .font(.system(size: 34, weight: .black))
                        .foregroundColor(.black)
                        .tracking(2)
                    if data.showInvoiceId {
                        Text(data.invoiceNumber)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.gray)
                    }
                }
            }.padding(.horizontal, 40).padding(.top, 32).padding(.bottom, 16)

            // Bordered client + dates cards
            HStack(alignment: .top, spacing: 16) {
                // Client card
                VStack(alignment: .leading, spacing: 6) {
                    Text("INVOICE TO:").font(.system(size: 8, weight: .bold)).foregroundColor(.gray).tracking(1)
                    if !data.clientName.isEmpty { Text(data.clientName).font(.system(size: 13, weight: .bold)).foregroundColor(.black) }
                    if !data.clientCompany.isEmpty { Text(data.clientCompany).font(.system(size: 10)).foregroundColor(.gray) }
                    if !data.clientEmail.isEmpty { Text(data.clientEmail).font(.system(size: 9)).foregroundColor(.gray) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(accent.opacity(0.3), lineWidth: 1))

                // Dates card
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Text("Issue Date:").font(.system(size: 8, weight: .bold)).foregroundColor(.gray)
                        Text(DateFormatHelper.string(from: data.issueDate, format: data.dateFormat)).font(.system(size: 10)).foregroundColor(.black)
                    }
                    if data.showDueDate, let due = data.dueDate {
                        HStack(spacing: 6) {
                            Text("Due Date:").font(.system(size: 8, weight: .bold)).foregroundColor(.gray)
                            Text(DateFormatHelper.string(from: due, format: data.dateFormat)).font(.system(size: 10)).foregroundColor(.black)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(accent.opacity(0.3), lineWidth: 1))
            }.padding(.horizontal, 40)

            // Table
            TableClean(data: data, headerBg: accent, headerFg: .white)
                .padding(.horizontal, 40).padding(.top, 16)

            // Totals
            HStack(alignment: .top) { Spacer(); TotalsBlock(data: data, accent: secondary, filledTotal: true) }
                .padding(.horizontal, 40).padding(.top, 8)

            Spacer(minLength: 0)

            // Notes + Terms at bottom
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    if data.showNote && !data.notes.isEmpty {
                        Text("*NOTES:").font(.system(size: 9, weight: .bold)).foregroundColor(.black)
                        Text(data.notes).font(.system(size: 8)).foregroundColor(.gray)
                    } else {
                        Text("*NOTES:").font(.system(size: 9, weight: .bold)).foregroundColor(.black)
                        Text("_______________________________").font(.system(size: 8)).foregroundColor(.gray.opacity(0.5))
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text("THANK YOU FOR YOUR BUSINESS!").font(.system(size: 9, weight: .bold)).foregroundColor(secondary).tracking(0.5)
                    Text("TERM & CONDITIONS:").font(.system(size: 7.5, weight: .bold)).foregroundColor(.black)
                    Text("Payment is due within 30 days of invoice date.\nLate payments may incur a 5% fee.")
                        .font(.system(size: 7)).foregroundColor(.gray)
                }
            }.padding(.horizontal, 40).padding(.top, 8)

            // Footer
            HStack {
                if !data.companyName.isEmpty { Text(data.companyName).font(.system(size: 7)).foregroundColor(.gray) }
                Spacer()
            }.padding(.horizontal, 40).padding(.vertical, 10)
        }
        .frame(width: spec.width, height: spec.height)
        .background(Color.white)
    }
}


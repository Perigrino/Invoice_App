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

// MARK: - Render data (plain value types, never persisted)

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

        // NSHostingView.dataWithPDF(inside:) does not capture SwiftUI content
        // (produces a blank page), so render the view to a high-resolution image
        // and embed it in the PDF page.
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

// MARK: - Invoice PDF View

struct InvoicePDFView: View {
    let data: InvoiceRenderData
    let template: PDFTemplate
    let paperSize: String

    private var spec: PDFPageSpec { PDFPageSpec.size(for: paperSize) }

    private var accent: Color {
        Color(hex: cleanHex(data.accentHex))
    }

    private var secondary: Color {
        Color(hex: cleanHex(data.secondaryHex))
    }

    private func cleanHex(_ hex: String) -> String {
        let value = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        return value.isEmpty ? "1E3A5F" : value
    }

    var body: some View {
        Group {
            switch template {
            case .modern: ModernTheme(data: data, accent: accent, spec: spec)
            case .business: BusinessTheme(data: data, accent: accent, spec: spec)
            case .minimal: MinimalTheme(data: data, spec: spec)
            case .professional: ProfessionalTheme(data: data, accent: accent, secondary: secondary, spec: spec)
            case .elegant: ElegantTheme(data: data, accent: accent, spec: spec)
            }
        }
        .background(Color.white)
    }
}

// MARK: - Shared building blocks

private struct CompanyBlock: View {
    let data: InvoiceRenderData
    var color: Color = .black
    var centered = false
    var logoHeight: CGFloat = 44

    var body: some View {
        VStack(alignment: centered ? .center : .leading, spacing: 3) {
            if let logoData = data.logoData, let image = NSImage(data: logoData) {
                Image(nsImage: image)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFit()
                    .frame(height: logoHeight)
                    .frame(maxWidth: 140, alignment: centered ? .center : .leading)
            }
            Text(data.companyName.isEmpty ? "Your Company" : data.companyName)
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(color)
                .multilineTextAlignment(centered ? .center : .leading)
            if !data.companyAddress.isEmpty {
                Text(data.companyAddress)
                    .font(.system(size: 9))
                    .foregroundColor(color.opacity(0.85))
                    .multilineTextAlignment(centered ? .center : .leading)
                    .frame(maxWidth: 260, alignment: centered ? .center : .leading)
            }
            if !data.companyEmail.isEmpty || !data.companyPhone.isEmpty {
                Text([data.companyEmail, data.companyPhone].filter { !$0.isEmpty }.joined(separator: "  •  "))
                    .font(.system(size: 8.5))
                    .foregroundColor(color.opacity(0.75))
                    .multilineTextAlignment(centered ? .center : .leading)
            }
        }
    }
}

private struct BillToBlock: View {
    let data: InvoiceRenderData

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text("BILL TO").font(.system(size: 8.5, weight: .semibold)).foregroundColor(.gray)
                if !data.clientName.isEmpty {
                    Text(data.clientName).font(.system(size: 12, weight: .medium)).foregroundColor(.black)
                }
                if !data.clientCompany.isEmpty {
                    Text(data.clientCompany).font(.system(size: 10)).foregroundColor(.gray)
                }
                if !data.clientEmail.isEmpty {
                    Text(data.clientEmail).font(.system(size: 10)).foregroundColor(.gray)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                if data.showInvoiceId {
                    Text("INVOICE NO").font(.system(size: 8.5, weight: .semibold)).foregroundColor(.gray)
                    Text(data.invoiceNumber.isEmpty ? "—" : data.invoiceNumber).font(.system(size: 11, weight: .medium)).foregroundColor(.black)
                }
                HStack(spacing: 20) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("ISSUED").font(.system(size: 8.5, weight: .semibold)).foregroundColor(.gray)
                        Text(DateFormatHelper.string(from: data.issueDate, format: data.dateFormat)).font(.system(size: 10)).foregroundColor(.black)
                    }
                    if data.showDueDate, let due = data.dueDate {
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("DUE").font(.system(size: 8.5, weight: .semibold)).foregroundColor(.gray)
                            Text(DateFormatHelper.string(from: due, format: data.dateFormat)).font(.system(size: 10)).foregroundColor(.black)
                        }
                    }
                }
            }
        }
    }
}

private struct LineItemsTable: View {
    let data: InvoiceRenderData
    var headerColor: Color = .black
    var headerTextColor: Color = .white

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Description").frame(maxWidth: .infinity, alignment: .leading)
                Text("Qty").frame(width: 50, alignment: .trailing)
                Text("Unit Price").frame(width: 80, alignment: .trailing)
                Text("Tax").frame(width: 40, alignment: .trailing)
                Text("Amount").frame(width: 95, alignment: .trailing)
            }
            .font(.system(size: 9, weight: .semibold))
            .foregroundColor(headerTextColor)
            .padding(.vertical, 7)
            .padding(.horizontal, 10)
            .background(headerColor)

            ForEach(Array(data.lineItems.enumerated()), id: \.offset) { index, item in
                HStack {
                    Text(item.description.isEmpty ? "—" : item.description)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(trimmed(item.quantity)).frame(width: 50, alignment: .trailing)
                    Text(format(item.price)).frame(width: 80, alignment: .trailing)
                    Text("\(trimmed(item.tax))%").frame(width: 40, alignment: .trailing)
                    Text(format(item.total)).frame(width: 95, alignment: .trailing)
                }
                .font(.system(size: 9))
                .foregroundColor(.black)
                .padding(.vertical, 6)
                .padding(.horizontal, 10)
                .background(index % 2 == 1 ? Color.black.opacity(0.03) : Color.white)
                Divider().overlay(Color.black.opacity(0.08))
            }

            if data.lineItems.isEmpty {
                Text("No line items")
                    .font(.system(size: 9))
                    .foregroundColor(.gray)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .overlay(Rectangle().stroke(Color.black.opacity(0.15), lineWidth: 0.5))
    }

    private func trimmed(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(format: "%.2f", value)
    }

    private func format(_ value: Double) -> String {
        CurrencyFormatter.shared.string(from: value, currencyCode: data.currencyCode)
    }
}

private struct TotalsBlock: View {
    let data: InvoiceRenderData
    var accent: Color = .black

    var body: some View {
        VStack(alignment: .trailing, spacing: 4) {
            if data.showCurrency {
                HStack {
                    Text("Subtotal").font(.system(size: 10)).foregroundColor(.gray)
                    Text(format(data.subtotal)).font(.system(size: 10, weight: .medium))
                }
                if data.showDiscount && data.discount > 0 {
                    HStack {
                        Text("Discount").font(.system(size: 10)).foregroundColor(.gray)
                        Text("-\(format(data.discount))").font(.system(size: 10, weight: .medium)).foregroundColor(.red)
                    }
                }
                if data.showTax && data.tax > 0 {
                    HStack {
                        Text("Tax").font(.system(size: 10)).foregroundColor(.gray)
                        Text("+\(format(data.tax))").font(.system(size: 10, weight: .medium)).foregroundColor(.green)
                    }
                }
            }
            Divider().frame(width: 220)
            HStack(spacing: 8) {
                Text("Total").font(.system(size: 13, weight: .bold))
                Text(format(data.total)).font(.system(size: 15, weight: .bold)).foregroundColor(accent)
            }
        }
        .frame(width: 240)
    }

    private func format(_ value: Double) -> String {
        CurrencyFormatter.shared.string(from: value, currencyCode: data.currencyCode)
    }
}

private struct NotesBlock: View {
    let data: InvoiceRenderData

    var body: some View {
        if data.showNote && !data.notes.isEmpty {
            VStack(alignment: .leading, spacing: 3) {
                Text("Notes").font(.system(size: 9, weight: .semibold)).foregroundColor(.gray)
                Text(data.notes)
                    .font(.system(size: 9))
                    .foregroundColor(.black.opacity(0.8))
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct FooterBar: View {
    let data: InvoiceRenderData

    var body: some View {
        VStack(spacing: 4) {
            Divider()
            Text(data.companyName.isEmpty ? "Thank you for your business" : "\(data.companyName)  •  Thank you for your business")
                .font(.system(size: 8.5))
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 40)
        .padding(.vertical, 10)
    }
}

// MARK: - Themes

private struct ModernTheme: View {
    let data: InvoiceRenderData
    let accent: Color
    let spec: PDFPageSpec

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top) {
                CompanyBlock(data: data, color: .white)
                Spacer(minLength: 30)
                VStack(alignment: .trailing, spacing: 4) {
                    Text(data.invoiceType.uppercased())
                        .font(.system(size: 26, weight: .bold))
                        .foregroundColor(.white)
                    if data.showInvoiceId {
                        Text(data.invoiceNumber)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.white.opacity(0.85))
                    }
                    HStack(spacing: 18) {
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("ISSUED").font(.system(size: 8, weight: .semibold)).foregroundColor(.white.opacity(0.7))
                            Text(DateFormatHelper.string(from: data.issueDate, format: data.dateFormat)).font(.system(size: 10)).foregroundColor(.white)
                        }
                        if data.showDueDate, let due = data.dueDate {
                            VStack(alignment: .trailing, spacing: 2) {
                                Text("DUE").font(.system(size: 8, weight: .semibold)).foregroundColor(.white.opacity(0.7))
                                Text(DateFormatHelper.string(from: due, format: data.dateFormat)).font(.system(size: 10)).foregroundColor(.white)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 40)
            .padding(.vertical, 26)
            .background(accent)

            VStack(alignment: .leading, spacing: 20) {
                BillToBlock(data: data)
                LineItemsTable(data: data, headerColor: accent, headerTextColor: .white)
                HStack(alignment: .top) {
                    NotesBlock(data: data)
                    Spacer(minLength: 16)
                    TotalsBlock(data: data, accent: accent)
                }
            }
            .padding(40)

            Spacer(minLength: 0)
            FooterBar(data: data)
        }
        .frame(width: spec.width, height: spec.height, alignment: .top)
        .background(Color.white)
    }
}

private struct BusinessTheme: View {
    let data: InvoiceRenderData
    let accent: Color
    let spec: PDFPageSpec

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top) {
                CompanyBlock(data: data, color: .black)
                Spacer(minLength: 30)
                VStack(alignment: .trailing, spacing: 4) {
                    Text(data.invoiceType.uppercased())
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(accent)
                    if data.showInvoiceId {
                        Text(data.invoiceNumber)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.gray)
                    }
                }
            }
            .padding(.horizontal, 40)
            .padding(.top, 40)
            .padding(.bottom, 18)

            Rectangle()
                .fill(accent)
                .frame(height: 2)
                .padding(.horizontal, 40)

            VStack(alignment: .leading, spacing: 20) {
                BillToBlock(data: data)
                LineItemsTable(data: data, headerColor: accent, headerTextColor: .white)
                HStack(alignment: .top) {
                    NotesBlock(data: data)
                    Spacer(minLength: 16)
                    TotalsBlock(data: data, accent: accent)
                }
            }
            .padding(40)

            Spacer(minLength: 0)
            FooterBar(data: data)
        }
        .frame(width: spec.width, height: spec.height, alignment: .top)
        .background(Color.white)
    }
}

private struct MinimalTheme: View {
    let data: InvoiceRenderData
    let spec: PDFPageSpec

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top) {
                CompanyBlock(data: data, color: .black)
                Spacer(minLength: 30)
                VStack(alignment: .trailing, spacing: 4) {
                    Text(data.invoiceType.uppercased())
                        .font(.system(size: 14, weight: .medium))
                        .kerning(3)
                        .foregroundColor(.black)
                    if data.showInvoiceId {
                        Text(data.invoiceNumber)
                            .font(.system(size: 11))
                            .foregroundColor(.gray)
                    }
                }
            }
            .padding(.horizontal, 48)
            .padding(.top, 44)
            .padding(.bottom, 16)

            Divider()
                .padding(.horizontal, 48)

            VStack(alignment: .leading, spacing: 20) {
                BillToBlock(data: data)
                LineItemsTable(data: data, headerColor: Color.black.opacity(0.08), headerTextColor: .black)
                HStack(alignment: .top) {
                    NotesBlock(data: data)
                    Spacer(minLength: 16)
                    TotalsBlock(data: data, accent: .black)
                }
            }
            .padding(48)

            Spacer(minLength: 0)
            FooterBar(data: data)
        }
        .frame(width: spec.width, height: spec.height, alignment: .top)
        .background(Color.white)
    }
}

private struct ProfessionalTheme: View {
    let data: InvoiceRenderData
    let accent: Color
    let secondary: Color
    let spec: PDFPageSpec

    var body: some View {
        VStack(spacing: 0) {
            Rectangle().fill(accent).frame(height: 3)
            Rectangle().fill(Color.black.opacity(0.15)).frame(height: 0.5)

            HStack(alignment: .top) {
                CompanyBlock(data: data, color: .black)
                Spacer(minLength: 30)
                VStack(alignment: .trailing, spacing: 4) {
                    Text(data.invoiceType.uppercased())
                        .font(.system(size: 22, weight: .bold))
                        .foregroundColor(.black)
                    if data.showInvoiceId {
                        Text(data.invoiceNumber)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(secondary)
                    }
                }
            }
            .padding(.horizontal, 40)
            .padding(.vertical, 24)

            HStack(spacing: 32) {
                labelValue("ISSUED", DateFormatHelper.string(from: data.issueDate, format: data.dateFormat))
                if data.showDueDate, let due = data.dueDate {
                    labelValue("DUE", DateFormatHelper.string(from: due, format: data.dateFormat))
                }
                labelValue("TYPE", data.invoiceType.capitalized)
                Spacer()
            }
            .padding(.horizontal, 40)
            .padding(.vertical, 8)
            .background(secondary.opacity(0.12))

            VStack(alignment: .leading, spacing: 20) {
                BillToBlock(data: data)
                LineItemsTable(data: data, headerColor: secondary, headerTextColor: .white)
                HStack(alignment: .top) {
                    NotesBlock(data: data)
                    Spacer(minLength: 16)
                    TotalsBlock(data: data, accent: secondary)
                }
            }
            .padding(40)

            Spacer(minLength: 0)
            FooterBar(data: data)
        }
        .frame(width: spec.width, height: spec.height, alignment: .top)
        .background(Color.white)
    }

    private func labelValue(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.system(size: 7.5, weight: .semibold)).foregroundColor(.gray)
            Text(value).foregroundColor(.black)
        }
    }
}

private struct ElegantTheme: View {
    let data: InvoiceRenderData
    let accent: Color
    let spec: PDFPageSpec

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Rectangle().fill(Color.black.opacity(0.4)).frame(height: 0.5)
                Text(data.invoiceType.uppercased())
                    .fontDesign(.serif)
                    .font(.system(size: 24))
                    .kerning(6)
                    .foregroundColor(.black)
                Rectangle().fill(Color.black.opacity(0.4)).frame(height: 0.5)
            }
            .padding(.horizontal, 56)
            .padding(.top, 40)

            if data.showInvoiceId {
                Text(data.invoiceNumber)
                    .font(.system(size: 10, weight: .medium))
                    .kerning(2)
                    .foregroundColor(accent)
                    .padding(.top, 6)
            }

            CompanyBlock(data: data, color: .black, centered: true)
                .frame(maxWidth: .infinity)
                .padding(.top, 18)

            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("BILL TO").font(.system(size: 8.5, weight: .semibold)).foregroundColor(.gray)
                    if !data.clientName.isEmpty {
                        Text(data.clientName).font(.system(size: 12, weight: .medium)).foregroundColor(.black)
                    }
                    if !data.clientCompany.isEmpty {
                        Text(data.clientCompany).font(.system(size: 10)).foregroundColor(.gray)
                    }
                    if !data.clientEmail.isEmpty {
                        Text(data.clientEmail).font(.system(size: 10)).foregroundColor(.gray)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 3) {
                    Text("ISSUED").font(.system(size: 8.5, weight: .semibold)).foregroundColor(.gray)
                    Text(DateFormatHelper.string(from: data.issueDate, format: data.dateFormat)).font(.system(size: 10)).foregroundColor(.black)
                    if data.showDueDate, let due = data.dueDate {
                        Text("DUE").font(.system(size: 8.5, weight: .semibold)).foregroundColor(.gray).padding(.top, 4)
                        Text(DateFormatHelper.string(from: due, format: data.dateFormat)).font(.system(size: 10)).foregroundColor(.black)
                    }
                }
            }
            .padding(.horizontal, 56)
            .padding(.top, 26)

            LineItemsTable(data: data, headerColor: Color.black.opacity(0.08), headerTextColor: .black)
                .padding(.horizontal, 56)
                .padding(.top, 20)

            HStack(alignment: .top) {
                NotesBlock(data: data)
                Spacer(minLength: 16)
                TotalsBlock(data: data, accent: accent)
            }
            .padding(.horizontal, 56)
            .padding(.top, 16)

            Spacer(minLength: 0)
            FooterBar(data: data)
        }
        .frame(width: spec.width, height: spec.height, alignment: .top)
        .background(Color.white)
    }
}
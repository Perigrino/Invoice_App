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
        default: return PDFPageSpec(width: 595.28, height: 841.89)
        }
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
        let spec = PDFPageSpec.size(for: paper)
        let height = data.dynamicHeight(for: paper)
        let pageSize = NSSize(width: spec.width, height: height)
        
        let tempDir = FileManager.default.temporaryDirectory
        let fileName = data.invoiceNumber.isEmpty ? "invoice.pdf" : "\(data.invoiceNumber).pdf"
        let fileURL = tempDir.appendingPathComponent(fileName)
        
        let rootView = InvoicePDFView(data: data, template: template, paperSize: paper)
            .frame(width: spec.width, height: height)
        
        // Render at high resolution for crisp output
        let baseScale: CGFloat
        switch paper {
        case "a3": baseScale = 16.0  // High res for large paper
        case "a4": baseScale = 14.0  // High res for medium paper
        case "legal": baseScale = 12.0
        default: baseScale = 12.0  // Letter and smaller
        }
        let renderer = ImageRenderer(content: rootView)
        renderer.scale = baseScale
        renderer.isOpaque = true
        
        guard let nsImage = renderer.nsImage,
              let cgImage = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return nil
        }
        
        do {
            let pdfData = try makePDF(cgImage: cgImage, pageSize: pageSize)
            try pdfData.write(to: fileURL)
            return fileURL
        } catch {
            print("PDF error: \(error)")
            return nil
        }
    }
    
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
    case couldNotCreateConsumer, couldNotCreateContext
    var errorDescription: String? {
        switch self {
        case .couldNotCreateConsumer: return "Could not create the PDF data consumer."
        case .couldNotCreateContext: return "Could not create the PDF drawing context."
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
        .background(bgColor)
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
        .background(bgColor)
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

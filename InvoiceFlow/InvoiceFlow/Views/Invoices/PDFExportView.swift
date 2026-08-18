import SwiftUI
import SwiftData
import PDFKit

struct PDFExportView: View {
    let sourceInvoice: Invoice
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @Query private var settings: [Setting]
    @Query(sort: \Client.fullName) private var clients: [Client]

    @State private var selectedTemplate: PDFTemplate = .modern
    @State private var paperSize: String = "A4"
    @State private var invoiceNumber: String = ""
    @State private var invoiceType: String = "invoice"
    @State private var issueDate: Date = Date()
    @State private var dueDate: Date = Date().addingTimeInterval(30 * 24 * 3600)
    @State private var notes: String = ""
    @State private var discount: Double = 0
    @State private var tax: Double = 0
    @State private var selectedClientIndex: Int = 0
    @State private var lineItems: [LineItemDraft] = []
    @State private var pdfDocument: PDFDocument?
    @State private var hasRendered = false

    private var activeSetting: Setting? {
        settings.first(where: { $0.isActive }) ?? settings.first
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            Divider()
            HSplitView {
                editPanel
                previewPanel
            }
            .frame(minWidth: 800, minHeight: 500)
        }
        .frame(width: 1200, height: 760)
        .onAppear {
            loadFromSource()
            renderPreview()
        }
        .onChange(of: selectedTemplate) { _, _ in renderPreview() }
        .onChange(of: paperSize) { _, _ in renderPreview() }
    }

    private var exportDirectoryURL: URL? {
        guard let path = activeSetting?.exportPath, !path.isEmpty else { return nil }
        return URL(fileURLWithPath: path)
    }

    private func savePDF() {
        guard let pdfDocument, let data = pdfDocument.dataRepresentation() else { return }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.pdf]
        panel.nameFieldStringValue = invoiceNumber.isEmpty ? "invoice.pdf" : "\(invoiceNumber).pdf"
        if let dir = exportDirectoryURL {
            panel.directoryURL = dir
        }
        if panel.runModal() == .OK, let url = panel.url {
            do {
                try data.write(to: url)
                dismiss()
            } catch {
                let alert = NSAlert()
                alert.messageText = "Export failed"
                alert.informativeText = error.localizedDescription
                alert.alertStyle = .warning
                alert.addButton(withTitle: "OK")
                alert.runModal()
            }
        }
    }

    private var topBar: some View {
        HStack(spacing: 12) {
            Text("Export PDF")
                .font(.title2.bold())
            Spacer()

            Picker("Template", selection: $selectedTemplate) {
                ForEach(PDFTemplate.allCases) { tpl in
                    Text(tpl.displayName).tag(tpl)
                }
            }
            .frame(width: 160)
            .accessibilityIdentifier("templatePicker")

            Picker("Paper", selection: $paperSize) {
                ForEach(["A4", "A3", "Letter", "Legal"], id: \.self) { size in
                    Text(size).tag(size)
                }
            }
            .frame(width: 100)
            .accessibilityIdentifier("paperPicker")

            Button("Cancel") { dismiss() }
                .keyboardShortcut(.cancelAction)
                .accessibilityIdentifier("cancelExport")

            Button(action: { savePDF() }) {
                Label("Export", systemImage: "square.and.arrow.up")
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.brandPrimary)
            .keyboardShortcut(.defaultAction)
        }
        .padding(12)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private var editPanel: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                documentSection
                lineItemsSection
                totalsSection
                notesSection
            }
            .onChange(of: lineItems) { _, _ in renderPreview() }
            .onChange(of: invoiceNumber) { _, _ in renderPreview() }
            .onChange(of: invoiceType) { _, _ in renderPreview() }
            .onChange(of: issueDate) { _, _ in renderPreview() }
            .onChange(of: dueDate) { _, _ in renderPreview() }
            .onChange(of: notes) { _, _ in renderPreview() }
            .onChange(of: discount) { _, _ in renderPreview() }
            .onChange(of: tax) { _, _ in renderPreview() }
            .onChange(of: selectedClientIndex) { _, _ in renderPreview() }
            .padding(16)
        }
        .frame(minWidth: 340, idealWidth: 380)
    }

    private var documentSection: some View {
        section("Document") {
            labeledField("Invoice Number") {
                TextField("", text: $invoiceNumber)
            }
            labeledField("Type") {
                Picker("", selection: $invoiceType) {
                    Text("Invoice").tag("invoice")
                    Text("Proforma").tag("proforma")
                }
                .labelsHidden()
                .pickerStyle(.segmented)
            }
            labeledField("Client") {
                Picker("", selection: $selectedClientIndex) {
                    Text("No Client").tag(0)
                    ForEach(Array(clients.enumerated()), id: \.element.id) { index, client in
                        Text(client.fullName).tag(index + 1)
                    }
                }
                .labelsHidden()
            }
            DatePicker("Issue Date", selection: $issueDate, displayedComponents: .date)
            DatePicker("Due Date", selection: $dueDate, displayedComponents: .date)
        }
    }

    private var lineItemsSection: some View {
        section("Line Items") {
            ForEach($lineItems) { $item in
                LineItemDraftRow(item: $item, currencyCode: activeSetting?.currency ?? "USD")
            }
            Button {
                lineItems.append(LineItemDraft())
            } label: {
                Label("Add Line Item", systemImage: "plus")
            }
        }
    }

    private var totalsSection: some View {
        section("Totals") {
            labeledField("Discount (%)") {
                TextField("", value: $discount, format: .number)
            }
            labeledField("Tax (%)") {
                TextField("", value: $tax, format: .number)
            }
            totalsSummary
        }
    }

    private var notesSection: some View {
        section("Notes") {
            TextEditor(text: $notes)
                .font(.body)
                .frame(minHeight: 70)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.gray.opacity(0.2), lineWidth: 1))
        }
    }

    private var previewPanel: some View {
        Group {
            if let pdfDocument {
                PDFKitView(document: pdfDocument)
            } else {
                VStack {
                    ProgressView()
                    Text("Generating preview…").font(.caption).foregroundColor(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.gray.opacity(0.08))
    }

    private var totalsSummary: some View {
        let (subtotal, total) = computedTotals
        return VStack(alignment: .leading, spacing: 4) {
            HStack { Text("Subtotal").foregroundColor(.secondary); Spacer(); Text(formatCurrency(subtotal)) }
            if discount > 0 { HStack { Text("Discount").foregroundColor(.secondary); Spacer(); Text("-\(formatCurrency(discountApplied))").foregroundColor(.red) } }
            if tax > 0 { HStack { Text("Tax").foregroundColor(.secondary); Spacer(); Text("+\(formatCurrency(taxApplied))").foregroundColor(.green) } }
            Divider()
            HStack { Text("Total").font(.headline); Spacer(); Text(formatCurrency(total)).font(.headline) }
        }
    }

    private var discountApplied: Double {
        let (subtotal, _) = computedTotals
        return subtotal * discount / 100
    }

    private var taxApplied: Double {
        let (subtotal, _) = computedTotals
        return subtotal * tax / 100
    }

    private var computedTotals: (Double, Double) {
        let subtotal = lineItems.reduce(0) { $0 + ($1.price * $1.quantity) }
        let afterDiscount = subtotal - subtotal * discount / 100
        let total = afterDiscount + afterDiscount * tax / 100
        return (subtotal, total)
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(.body, weight: .semibold))
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func labeledField(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        HStack {
            Text(label).frame(width: 100, alignment: .leading)
            content()
            Spacer()
        }
    }

    private func loadFromSource() {
        if let activeSetting {
            applySettingsGlobals(activeSetting)
        }
        invoiceNumber = sourceInvoice.invoiceNumber
        invoiceType = sourceInvoice.invoiceType
        issueDate = sourceInvoice.issueDate
        dueDate = sourceInvoice.dueDate ?? Date().addingTimeInterval(30 * 24 * 3600)
        let invoiceNotes = sourceInvoice.notes ?? ""
        notes = invoiceNotes.isEmpty ? (activeSetting?.notes ?? "") : invoiceNotes
        discount = sourceInvoice.discount
        tax = sourceInvoice.tax
        selectedTemplate = PDFTemplate(rawValue: activeSetting?.template ?? "modern") ?? .modern
        paperSize = activeSetting?.paperSize ?? "A4"
        if let client = sourceInvoice.client, let index = clients.firstIndex(of: client) {
            selectedClientIndex = index + 1
        }
        lineItems = (sourceInvoice.lineItems ?? []).map { LineItemDraft(item: $0) }
    }

    private func buildPDFData() -> InvoiceRenderData {
        let client = selectedClientIndex > 0 && selectedClientIndex <= clients.count ? clients[selectedClientIndex - 1] : nil
        let subtotal = computedTotals.0
        let total = computedTotals.1
        return InvoiceRenderData(
            invoiceNumber: invoiceNumber,
            invoiceType: invoiceType,
            issueDate: issueDate,
            dueDate: dueDate,
            notes: notes,
            subtotal: subtotal,
            discount: discountApplied,
            tax: taxApplied,
            total: total,
            clientName: client?.fullName ?? "",
            clientCompany: client?.company ?? "",
            clientEmail: client?.email ?? "",
            lineItems: lineItems.map {
                InvoiceRenderLineItem(
                    description: $0.description,
                    quantity: $0.quantity,
                    price: $0.price,
                    tax: $0.tax,
                    total: $0.price * $0.quantity + $0.price * $0.quantity * $0.tax / 100
                )
            },
            companyName: activeSetting?.companyName?.isEmpty == false ? activeSetting!.companyName! : (activeSetting?.profileName ?? "Your Company"),
            companyEmail: activeSetting?.companyEmail ?? "",
            companyPhone: activeSetting?.companyPhone ?? "",
            companyAddress: activeSetting?.companyAddress ?? "",
            companyWebsite: activeSetting?.companyWebsite ?? "",
            logoData: activeSetting?.logoData,
            currencyCode: activeSetting?.currency ?? "USD",
            dateFormat: activeSetting?.dateFormat ?? "MM/DD/YYYY",
            accentHex: activeSetting?.pdfAccentColor ?? "#1E3A5F",
            secondaryHex: activeSetting?.pdfSecondaryColor ?? "#059669",
            showInvoiceId: activeSetting?.showInvoiceId ?? true,
            showDueDate: activeSetting?.showDueDate ?? true,
            showCurrency: activeSetting?.showCurrency ?? true,
            showDiscount: activeSetting?.showDiscount ?? true,
            showTax: activeSetting?.showTax ?? true,
            showNote: activeSetting?.showNote ?? true
        )
    }

    private func renderPreview() {
        guard !hasRendered else { return }
        hasRendered = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            hasRendered = false
            let data = buildPDFData()
            let generator = PDFGenerator()
            if let url = generator.generatePDF(for: data, template: selectedTemplate, paperSize: paperSize) {
                pdfDocument = PDFDocument(url: url)
            }
        }
    }

    private func formatCurrency(_ amount: Double) -> String {
        CurrencyFormatter.shared.string(from: amount, currencyCode: activeSetting?.currency ?? "USD")
    }
}

// MARK: - Line item draft

struct LineItemDraft: Identifiable, Equatable {
    let id = UUID()
    var description: String = ""
    var price: Double = 0
    var quantity: Double = 1
    var tax: Double = 0

    init() {}

    init(item: InvoiceLineItem) {
        description = item.itemDescription
        price = item.price
        quantity = item.quantity
        tax = item.tax
    }
}

struct LineItemDraftRow: View {
    @Binding var item: LineItemDraft
    var currencyCode: String = "USD"

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                TextField("Description", text: $item.description)
                Spacer()
            }
            HStack(spacing: 6) {
                TextField("Qty", value: $item.quantity, format: .number)
                    .frame(width: 50)
                TextField("Price", value: $item.price, format: .number)
                    .frame(width: 80)
                TextField("Tax %", value: $item.tax, format: .number)
                    .frame(width: 60)
                Text(itemTotal)
                    .font(.system(.body, design: .monospaced))
                    .frame(width: 90, alignment: .trailing)
            }
        }
        .padding(8)
        .background(Color(nsColor: .textBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    private var itemTotal: String {
        let base = item.price * item.quantity
        let total = base + base * item.tax / 100
        return formatCurrency(total)
    }

    private func formatCurrency(_ amount: Double) -> String {
        CurrencyFormatter.shared.string(from: amount, currencyCode: currencyCode)
    }
}

// MARK: - PDFKit wrapper

struct PDFKitView: NSViewRepresentable {
    let document: PDFDocument

    func makeNSView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        view.document = document
        return view
    }

    func updateNSView(_ nsView: PDFView, context: Context) {
        nsView.document = document
    }
}
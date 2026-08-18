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
    @State private var showingSavePanel = false

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
        .fileExporter(
            isPresented: $showingSavePanel,
            document: PDFDocumentWrapper(document: pdfDocument, fallbackName: invoiceNumber.isEmpty ? "invoice" : invoiceNumber),
            contentType: .pdf,
            defaultFilename: invoiceNumber.isEmpty ? "invoice" : invoiceNumber
        ) { result in
            switch result {
            case .success: dismiss()
            case .failure: break
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

            Picker("Paper", selection: $paperSize) {
                ForEach(["A4", "A3", "Letter", "Legal"], id: \.self) { size in
                    Text(size).tag(size)
                }
            }
            .frame(width: 100)

            Button("Cancel") { dismiss() }
                .keyboardShortcut(.cancelAction)

            Button(action: { showingSavePanel = true }) {
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
                LineItemDraftRow(item: $item)
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
        invoiceNumber = sourceInvoice.invoiceNumber
        invoiceType = sourceInvoice.invoiceType
        issueDate = sourceInvoice.issueDate
        dueDate = sourceInvoice.dueDate ?? Date().addingTimeInterval(30 * 24 * 3600)
        notes = sourceInvoice.notes ?? ""
        discount = sourceInvoice.discount
        tax = sourceInvoice.tax
        selectedTemplate = PDFTemplate(rawValue: activeSetting?.template ?? "modern") ?? .modern
        paperSize = activeSetting?.paperSize ?? "A4"
        if let client = sourceInvoice.client, let index = clients.firstIndex(of: client) {
            selectedClientIndex = index + 1
        }
        lineItems = (sourceInvoice.lineItems ?? []).map { LineItemDraft(item: $0) }
    }

    private func buildWorkingInvoice() -> Invoice {
        let working = Invoice(
            invoiceNumber: invoiceNumber,
            invoiceType: invoiceType,
            subtotal: computedTotals.0,
            discount: discountApplied,
            tax: taxApplied,
            total: computedTotals.1,
            balanceDue: computedTotals.1,
            notes: notes,
            issueDate: issueDate,
            dueDate: dueDate
        )
        if selectedClientIndex > 0, selectedClientIndex <= clients.count {
            working.client = clients[selectedClientIndex - 1]
        }
        let items = lineItems.map { item -> InvoiceLineItem in
            let li = InvoiceLineItem(
                itemDescription: item.description,
                price: item.price,
                quantity: item.quantity,
                discount: 0,
                tax: item.tax,
                total: item.price * item.quantity + item.price * item.quantity * item.tax / 100
            )
            li.sortOrder = 0
            return li
        }
        working.lineItems = items
        return working
    }

    private func renderPreview() {
        guard !hasRendered else { return }
        hasRendered = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            hasRendered = false
            let working = buildWorkingInvoice()
            let generator = PDFGenerator()
            if let url = generator.generatePDF(for: working, template: selectedTemplate, setting: activeSetting) {
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
        CurrencyFormatter.shared.string(from: amount)
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

struct PDFDocumentWrapper: FileDocument {
    static var readableContentTypes: [UTType] { [.pdf] }

    var document: PDFDocument?
    var fallbackName: String

    init(document: PDFDocument?, fallbackName: String) {
        self.document = document
        self.fallbackName = fallbackName
    }

    init(configuration: ReadConfiguration) throws {
        if let data = configuration.file.regularFileContents {
            document = PDFDocument(data: data)
        }
        fallbackName = "invoice"
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        if let data = document?.dataRepresentation() {
            return FileWrapper(regularFileWithContents: data)
        }
        return FileWrapper(regularFileWithContents: Data())
    }
}

import UniformTypeIdentifiers
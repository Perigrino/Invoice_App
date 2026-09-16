import SwiftUI
import SwiftData

struct InvoiceFormView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Client.fullName) private var clients: [Client]
    @Query(filter: #Predicate<Setting> { $0.isActive }) private var activeSettings: [Setting]
    
    var invoice: Invoice?
    
    @State private var invoiceNumber = ""
    @State private var invoiceType = "invoice"
    @State private var selectedClientIndex: Int = 0
    @State private var issueDate = Date()
    @State private var dueDate = Date()
    @State private var hasDueDate = false
    @State private var notes = ""
    @State private var lineItems: [LineItemData] = []
    @State private var discount = 0.0
    @State private var taxRate = 0.0
    @State private var showValidationError = false
    @State private var validationError = ""
    @State private var pendingInvoice: Invoice?
    @State private var saveError: String?
    @State private var hasLoaded = false
    @State private var cancelAction: ((Invoice?) -> Void)?
    
    private var isEditing: Bool { invoice != nil }
    
    var body: some View {
        VStack(spacing: 0) {
            // MARK: - Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(isEditing ? "Edit Invoice" : "New Invoice")
                        .font(.title2.bold())
                    Text(isEditing ? "Update invoice details" : "Create a new invoice")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                if showValidationError {
                    Text(validationError)
                        .font(.caption)
                        .foregroundColor(.red)
                        .transition(.opacity)
                }
                Button("Cancel") {
                    cancelAction?(pendingInvoice)
                    cancelAction = nil
                    dismiss()
                }
                    .keyboardShortcut(.cancelAction)
                Button(isEditing ? "Update" : "Create") { 
                    if validateForm() {
                        saveInvoice()
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.brandPrimary)
                .keyboardShortcut(.defaultAction)
            }
            .padding()
            
            Divider()
            
            // MARK: - Form Content
            ScrollView {
                VStack(spacing: 24) {
                    // Invoice Details
                    formSection(title: "Invoice Details") {
                        VStack(spacing: 16) {
                            HStack(spacing: 16) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Invoice Number")
                                        .font(.caption.bold())
                                        .foregroundColor(.secondary)
                                    TextField("INV-001", text: $invoiceNumber)
                                        .textFieldStyle(.roundedBorder)
                                }
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Type")
                                        .font(.caption.bold())
                                        .foregroundColor(.secondary)
                                    Picker("", selection: $invoiceType) {
                                        Text("Invoice").tag("invoice")
                                        Text("Proforma Invoice").tag("proforma")
                                    }
                                    .pickerStyle(.segmented)
                                }
                            }
                            
                            HStack(spacing: 16) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Client")
                                        .font(.caption.bold())
                                        .foregroundColor(.secondary)
                                    Picker("", selection: $selectedClientIndex) {
                                        Text("No Client").tag(0)
                                        ForEach(Array(clients.enumerated()), id: \.element.id) { index, client in
                                            Text(client.fullName).tag(index + 1)
                                        }
                                    }
                                    .labelsHidden()
                                    .onChange(of: selectedClientIndex) { _, newIndex in
                                        guard invoice == nil, newIndex > 0, newIndex <= clients.count else { return }
                                        generateInvoiceNumber(for: clients[newIndex - 1])
                                    }
                                }
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Issue Date")
                                        .font(.caption.bold())
                                        .foregroundColor(.secondary)
                                    DatePicker("", selection: $issueDate, displayedComponents: .date)
                                        .labelsHidden()
                                }
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text("Due Date")
                                            .font(.caption.bold())
                                            .foregroundColor(.secondary)
                                        Toggle("", isOn: $hasDueDate)
                                            .labelsHidden()
                                            .controlSize(.small)
                                    }
                                    DatePicker("", selection: $dueDate, displayedComponents: .date)
                                        .labelsHidden()
                                        .disabled(!hasDueDate)
                                        .opacity(hasDueDate ? 1 : 0.5)
                                }
                            }
                        }
                    }
                    
                    // Line Items
                    formSection(title: "Line Items") {
                        VStack(spacing: 0) {
                            // Table header
                            HStack(spacing: 0) {
                                Text("Description").frame(maxWidth: .infinity, alignment: .leading)
                                Text("Qty").frame(width: 60, alignment: .center)
                                Text("Price").frame(width: 100, alignment: .center)
                                Text("Disc %").frame(width: 70, alignment: .center)
                                Text("Tax %").frame(width: 70, alignment: .center)
                                Text("Total").frame(width: 100, alignment: .trailing)
                                Color.clear.frame(width: 32)
                            }
                            .font(.system(.caption, weight: .semibold))
                            .foregroundColor(.secondary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color.gray.opacity(0.08))
                            
                            Divider()
                            
                            // Line item rows
                            ForEach(Array(lineItems.enumerated()), id: \.element.id) { index, _ in
                                lineItemRow(index: index)
                                if index < lineItems.count - 1 {
                                    Divider().padding(.horizontal, 12)
                                }
                            }
                            
                            Divider()
                            
                            // Add line item button
                            Button(action: addLineItem) {
                                HStack {
                                    Image(systemName: "plus.circle.fill")
                                        .foregroundColor(Color.brandPrimary)
                                    Text("Add Line Item")
                                        .font(.system(.caption, weight: .medium))
                                        .foregroundColor(Color.brandPrimary)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                            }
                            .buttonStyle(.plain)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                        )
                    }
                    
                    // Totals
                    formSection(title: "Summary") {
                        HStack(spacing: 24) {
                            VStack(alignment: .leading, spacing: 12) {
                                HStack {
                                    Text("Subtotal")
                                        .foregroundColor(.secondary)
                                    Spacer()
                                    Text(formatCurrency(subtotal))
                                }
                                HStack(spacing: 6) {
                                    Text("Discount")
                                        .foregroundColor(.secondary)
                                    TextField("0", value: $discount, format: .number)
                                        .textFieldStyle(.roundedBorder)
                                        .frame(width: 60)
                                    Text("%")
                                        .foregroundColor(.secondary)
                                    Spacer()
                                    Text("-\(formatCurrency(discountAmount))")
                                        .foregroundColor(.red)
                                }
                                HStack(spacing: 6) {
                                    Text("Tax")
                                        .foregroundColor(.secondary)
                                    TextField("0", value: $taxRate, format: .number)
                                        .textFieldStyle(.roundedBorder)
                                        .frame(width: 60)
                                    Text("%")
                                        .foregroundColor(.secondary)
                                    Spacer()
                                    Text("+\(formatCurrency(taxAmount))")
                                        .foregroundColor(.green)
                                }
                            }
                            
                            Divider().frame(height: 60)
                            
                            VStack(alignment: .trailing, spacing: 8) {
                                HStack {
                                    Text("Total").font(.headline)
                                    Spacer()
                                    Text(formatCurrency(total))
                                        .font(.system(.headline, design: .monospaced))
                                }
                                HStack {
                                    Text("Balance Due").font(.headline)
                                    Spacer()
                                    Text(formatCurrency(total))
                                        .font(.system(.headline, design: .monospaced))
                                        .foregroundColor(.red)
                                }
                            }
                        }
                    }
                    
                    // Notes
                    formSection(title: "Notes") {
                        TextField("Notes", text: $notes, axis: .vertical)
                            .lineLimit(2...8)
                            .textFieldStyle(.roundedBorder)
                            .font(.body)
                    }
                }
                .padding(20)
            }
        }
        .frame(minWidth: 800, minHeight: 650)
        .onAppear { loadInvoice() }
        .animation(.default, value: showValidationError)
        .alert("Could Not Save Invoice", isPresented: Binding(
            get: { saveError != nil },
            set: { if !$0 { saveError = nil } }
        )) {
            Button("OK", role: .cancel) { saveError = nil }
        } message: {
            Text(saveError ?? "")
        }
    }
    
    // MARK: - Computed Properties
    
    private var subtotal: Double {
        lineItems.reduce(0) { $0 + $1.lineTotal }
    }
    private var discountAmount: Double { subtotal * discount / 100 }
    private var taxableAmount: Double { subtotal - discountAmount }
    private var taxAmount: Double { taxableAmount * taxRate / 100 }
    private var total: Double { taxableAmount + taxAmount }
    
    // MARK: - Helpers
    
    private func formSection<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(.body, weight: .semibold))
                .foregroundColor(.primary)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
    
    @ViewBuilder
    private func lineItemRow(index: Int) -> some View {
        let binding = Binding<LineItemData>(
            get: { lineItems[index] },
            set: { lineItems[index] = $0 }
        )
        
        HStack(spacing: 0) {
            TextField("Item description", text: binding.itemDescription, axis: .vertical)
                .lineLimit(1...3)
                .textFieldStyle(.plain)
                .frame(maxWidth: .infinity, alignment: .leading)
            TextField("1", value: binding.quantity, format: .number)
                .textFieldStyle(.plain)
                .multilineTextAlignment(.center)
                .frame(width: 60)
            TextField("0.00", value: binding.price, format: .number)
                .textFieldStyle(.plain)
                .multilineTextAlignment(.center)
                .frame(width: 100)
            TextField("0", value: binding.discount, format: .number)
                .textFieldStyle(.plain)
                .multilineTextAlignment(.center)
                .frame(width: 70)
            TextField("0", value: binding.tax, format: .number)
                .textFieldStyle(.plain)
                .multilineTextAlignment(.center)
                .frame(width: 70)
            Text(formatCurrency(lineItems[index].lineTotal))
                .font(.system(.body, design: .monospaced))
                .frame(width: 100, alignment: .trailing)
            Button(action: { removeLineItem(at: index) }) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(.red.opacity(0.6))
            }
            .buttonStyle(.plain)
            .frame(width: 32)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }
    
    private func generateInvoiceNumber(for client: Client) {
        let trimmedName = client.fullName.trimmingCharacters(in: .whitespacesAndNewlines)
        let prefix = String(trimmedName.prefix(3)).uppercased()
        let yearShort = Calendar.current.component(.year, from: Date()) % 100
        
        // Fetch all existing invoice numbers to find the next sequential number
        let descriptor = FetchDescriptor<Invoice>()
        let allInvoices = (try? modelContext.fetch(descriptor)) ?? []
        let existingNumbers = Set(allInvoices.map { $0.invoiceNumber })
        
        // Find the highest sequence number for this prefix+year
        let prefixYearPattern = "\(prefix)-\(String(format: "%02d", yearShort))"
        var maxSequence = 0
        
        for number in existingNumbers {
            if number.hasPrefix(prefixYearPattern + "-") {
                let suffix = String(number.dropFirst(prefixYearPattern.count + 1))
                if let seq = Int(suffix), seq > maxSequence {
                    maxSequence = seq
                }
            }
        }
        
        // Generate next sequence number
        let nextSequence = maxSequence + 1
        invoiceNumber = "\(prefixYearPattern)-\(String(format: "%04d", nextSequence))"
    }

    private func loadInvoice() {
        guard !hasLoaded else { return }
        hasLoaded = true
        pendingInvoice = invoice
        guard let invoice = invoice else {
            addLineItem()
            notes = activeSettings.first?.notes ?? ""
            return
        }
        invoiceNumber = invoice.invoiceNumber
        invoiceType = invoice.invoiceType
        if let client = invoice.client, let idx = clients.firstIndex(where: { $0.id == client.id }) {
            selectedClientIndex = idx + 1
        }
        issueDate = invoice.issueDate
        hasDueDate = invoice.dueDate != nil
        dueDate = invoice.dueDate ?? Date()
        notes = invoice.notes ?? ""
        lineItems = (invoice.lineItems ?? []).map { item in
            LineItemData(
                id: item.id,
                itemDescription: item.itemDescription,
                price: item.price,
                quantity: item.quantity,
                discount: item.discount,
                tax: item.tax,
                sortOrder: item.sortOrder
            )
        }
        if lineItems.isEmpty { addLineItem() }
        discount = invoice.discount
        taxRate = invoice.tax
    }
    
    private func validateForm() -> Bool {
        guard !invoiceNumber.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            showError("Invoice number is required")
            return false
        }
        
        // Check for duplicate invoice number
        let descriptor = FetchDescriptor<Invoice>()
        let allInvoices = (try? modelContext.fetch(descriptor)) ?? []
        let trimmedNumber = invoiceNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        let isDuplicate = allInvoices.contains { existing in
            existing.invoiceNumber == trimmedNumber && existing.id != (pendingInvoice ?? invoice)?.id
        }
        if isDuplicate {
            showError("Invoice number already exists. Please use a different number.")
            return false
        }
        
        guard !lineItems.isEmpty else {
            showError("At least one line item is required")
            return false
        }
        guard lineItems.allSatisfy({ !$0.itemDescription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) else {
            showError("All line items must have a description")
            return false
        }
        guard lineItems.allSatisfy({ $0.quantity > 0 }) else {
            showError("All quantities must be greater than 0")
            return false
        }
        guard lineItems.allSatisfy({ $0.price >= 0 }) else {
            showError("All prices must be non-negative")
            return false
        }
        showValidationError = false
        return true
    }
    
    private func showError(_ message: String) {
        validationError = message
        withAnimation {
            showValidationError = true
        }
        // Auto-hide after 3 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            withAnimation {
                showValidationError = false
            }
        }
    }
    
    private func saveInvoice() {
        let client = selectedClientIndex > 0 && selectedClientIndex <= clients.count
            ? clients[selectedClientIndex - 1] : nil
        if cancelAction == nil {
            cancelAction = Self.makeCancelAction(for: pendingInvoice, in: modelContext)
        }
        if Self.saveInvoice(
            in: modelContext, pending: &pendingInvoice, invoiceNumber: invoiceNumber,
            invoiceType: invoiceType, client: client, issueDate: issueDate,
            dueDate: hasDueDate ? dueDate : nil, notes: notes,
            discount: discount, taxRate: taxRate, lineItems: lineItems,
            onError: { saveError = "Your changes have not been saved. Keep this form open and try again.\n\n\($0.localizedDescription)" }
        ) {
            cancelAction = nil
            dismiss()
        }
    }

    static func makeCancelAction(for invoice: Invoice?, in context: ModelContext) -> (Invoice?) -> Void {
        guard let invoice else {
            return { pending in
                if let pending {
                    (pending.lineItems ?? []).forEach { context.delete($0) }
                    context.delete(pending)
                }
            }
        }
        let client = invoice.client
        let original = (
            invoice.invoiceNumber, invoice.invoiceType, invoice.subtotal, invoice.discount,
            invoice.tax, invoice.total, invoice.balanceDue, invoice.notes, invoice.issueDate,
            invoice.dueDate, invoice.updatedAt
        )
        let originalItems: [(item: InvoiceLineItem, fields: (String, Double, Double, Double, Double, Double, Int))] = (invoice.lineItems ?? []).map { item in
            (item, (item.itemDescription, item.price, item.quantity, item.discount, item.tax, item.total, item.sortOrder))
        }
        let originalIDs = Set(originalItems.map { $0.item.id })
        return { pending in
            invoice.invoiceNumber = original.0
            invoice.invoiceType = original.1
            invoice.subtotal = original.2
            invoice.discount = original.3
            invoice.tax = original.4
            invoice.total = original.5
            invoice.balanceDue = original.6
            invoice.notes = original.7
            invoice.issueDate = original.8
            invoice.dueDate = original.9
            invoice.updatedAt = original.10
            invoice.client = client
            let currentItems = (pending === invoice ? invoice.lineItems : []) ?? []
            for current in currentItems where !originalIDs.contains(current.id) {
                context.delete(current)
            }
            invoice.lineItems = []
            for entry in originalItems {
                let item = entry.item
                if item.modelContext == nil { context.insert(item) }
                item.itemDescription = entry.fields.0
                item.price = entry.fields.1
                item.quantity = entry.fields.2
                item.discount = entry.fields.3
                item.tax = entry.fields.4
                item.total = entry.fields.5
                item.sortOrder = entry.fields.6
                item.invoice = invoice
                invoice.lineItems?.append(item)
            }
        }
    }

    static func saveInvoice(
        in context: ModelContext, pending: inout Invoice?, invoiceNumber: String,
        invoiceType: String, client: Client?, issueDate: Date, dueDate: Date?, notes: String,
        discount: Double, taxRate: Double, lineItems: [LineItemData],
        onError: ((Error) -> Void)? = nil
    ) -> Bool {
        let record = pending ?? Invoice()
        if pending == nil {
            context.insert(record)
            pending = record
        }
        let subtotal = lineItems.reduce(0) { $0 + $1.lineTotal }
        let taxableAmount = subtotal - subtotal * discount / 100
        let total = taxableAmount + taxableAmount * taxRate / 100
        record.invoiceNumber = invoiceNumber
        record.invoiceType = invoiceType
        record.issueDate = issueDate
        record.dueDate = dueDate
        record.notes = notes.isEmpty ? nil : notes
        record.subtotal = subtotal
        record.discount = discount
        record.tax = taxRate
        record.total = total
        record.balanceDue = total
        record.updatedAt = Date()
        record.client = client

        let previousItems = (record.lineItems ?? []).filter { !$0.isDeleted }
        let retainedIDs = Set(lineItems.map(\.id))
        record.lineItems = previousItems.filter { retainedIDs.contains($0.id) }
        for item in previousItems where !retainedIDs.contains(item.id) {
            item.invoice = nil
            context.delete(item)
        }
        record.lineItems = lineItems.enumerated().map { index, item in
            let lineItem = previousItems.first { $0.id == item.id } ?? InvoiceLineItem(id: item.id)
            if lineItem.modelContext == nil { context.insert(lineItem) }
            lineItem.itemDescription = item.itemDescription
            lineItem.price = item.price
            lineItem.quantity = item.quantity
            lineItem.discount = item.discount
            lineItem.tax = item.tax
            lineItem.total = item.lineTotal
            lineItem.sortOrder = index
            lineItem.invoice = record
            return lineItem
        }
        return context.persist(onError: onError)
    }
    
    private func addLineItem() {
        lineItems.append(LineItemData(sortOrder: lineItems.count))
    }
    
    private func removeLineItem(at index: Int) {
        guard lineItems.count > 1 else { return }
        lineItems.remove(at: index)
    }
    
    private func formatCurrency(_ amount: Double) -> String {
        CurrencyFormatter.shared.string(from: amount)
    }
}

// MARK: - Line Item Data

struct LineItemData: Identifiable {
    var id = UUID()
    var itemDescription = ""
    var price = 0.0
    var quantity = 1.0
    var discount = 0.0
    var tax = 0.0
    var lineTotal: Double {
        let lineTotal = price * quantity
        let disc = lineTotal * discount / 100
        let afterDisc = lineTotal - disc
        let taxAmt = afterDisc * tax / 100
        return afterDisc + taxAmt
    }
    var sortOrder = 0
}
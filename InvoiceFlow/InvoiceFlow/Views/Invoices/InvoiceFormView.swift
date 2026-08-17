import SwiftUI
import SwiftData

struct InvoiceFormView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Client.fullName) private var clients: [Client]
    
    var invoice: Invoice?
    
    @State private var invoiceNumber = ""
    @State private var invoiceType = "invoice"
    @State private var status = "draft"
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
                Button("Cancel") { dismiss() }
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
                                        Text("Proforma").tag("proforma")
                                    }
                                    .pickerStyle(.segmented)
                                }
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Status")
                                        .font(.caption.bold())
                                        .foregroundColor(.secondary)
                                    Picker("", selection: $status) {
                                        ForEach(InvoiceStatus.allCases) { s in
                                            Text(s.label).tag(s.key)
                                        }
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
                        TextEditor(text: $notes)
                            .font(.body)
                            .frame(minHeight: 80)
                            .padding(4)
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                            )
                    }
                }
                .padding(20)
            }
        }
        .frame(minWidth: 800, minHeight: 650)
        .onAppear { loadInvoice() }
        .animation(.default, value: showValidationError)
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
            TextField("Item description", text: binding.itemDescription)
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
    
    private func loadInvoice() {
        guard let invoice = invoice else {
            invoiceNumber = "INV-\(UUID().uuidString.prefix(6).uppercased())"
            addLineItem()
            return
        }
        invoiceNumber = invoice.invoiceNumber
        invoiceType = invoice.invoiceType
        status = invoice.status
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
        let client = selectedClientIndex > 0 ? clients[selectedClientIndex - 1] : nil
        
        if let existing = invoice {
            existing.invoiceNumber = invoiceNumber
            existing.invoiceType = invoiceType
            existing.status = status
            existing.issueDate = issueDate
            existing.dueDate = hasDueDate ? dueDate : nil
            existing.notes = notes.isEmpty ? nil : notes
            existing.discount = discount
            existing.tax = taxRate
            existing.total = total
            existing.balanceDue = total
            existing.updatedAt = Date()
            existing.client = client
            
            existing.lineItems?.forEach { modelContext.delete($0) }
            saveLineItems(to: existing)
        } else {
            let newInvoice = Invoice(
                invoiceNumber: invoiceNumber,
                invoiceType: invoiceType,
                status: status,
                subtotal: subtotal,
                discount: discount,
                tax: taxRate,
                total: total,
                balanceDue: total,
                notes: notes.isEmpty ? nil : notes,
                issueDate: issueDate,
                dueDate: hasDueDate ? dueDate : nil
            )
            newInvoice.client = client
            saveLineItems(to: newInvoice)
            modelContext.insert(newInvoice)
        }
        
        dismiss()
    }
    
    private func saveLineItems(to invoice: Invoice) {
        for (index, item) in lineItems.enumerated() {
            let lineItem = InvoiceLineItem(
                id: item.id,
                itemDescription: item.itemDescription,
                price: item.price,
                quantity: item.quantity,
                discount: item.discount,
                tax: item.tax,
                total: item.lineTotal,
                sortOrder: index
            )
            lineItem.invoice = invoice
            modelContext.insert(lineItem)
        }
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
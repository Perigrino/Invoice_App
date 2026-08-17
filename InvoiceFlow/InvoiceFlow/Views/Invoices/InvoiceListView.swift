import SwiftUI
import SwiftData

struct InvoiceListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Invoice.createdAt, order: .reverse) private var invoices: [Invoice]
    @State private var searchText = ""
    @State private var selectedStatus: String? = nil
    @State private var showNewInvoice = false
    @State private var editingInvoice: Invoice? = nil
    @State private var selectedInvoices = Set<Invoice>()
    
    private var filteredInvoices: [Invoice] {
        invoices.filter { invoice in
            let matchesSearch = searchText.isEmpty ||
                invoice.invoiceNumber.localizedCaseInsensitiveContains(searchText) ||
                (invoice.client?.fullName.localizedCaseInsensitiveContains(searchText) ?? false)
            let matchesStatus = selectedStatus == nil || invoice.status == selectedStatus
            return matchesSearch && matchesStatus
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // MARK: - Toolbar Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Invoices")
                        .font(.title2.bold())
                    Text("\(filteredInvoices.count) invoice\(filteredInvoices.count == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                
                // Status filter pills
                HStack(spacing: 6) {
                    FilterPill(title: "All", count: invoices.count, isSelected: selectedStatus == nil) { selectedStatus = nil }
                    FilterPill(title: "Draft", count: statusCount("draft"), isSelected: selectedStatus == "draft") { selectedStatus = "draft" }
                    FilterPill(title: "Pending", count: statusCount("pending"), isSelected: selectedStatus == "pending") { selectedStatus = "pending" }
                    FilterPill(title: "Paid", count: statusCount("paid"), isSelected: selectedStatus == "paid") { selectedStatus = "paid" }
                    FilterPill(title: "Overdue", count: statusCount("overdue"), isSelected: selectedStatus == "overdue") { selectedStatus = "overdue" }
                }
                .padding(.trailing, 8)
                
                Divider().frame(height: 24)
                
                Button(action: { showNewInvoice = true }) {
                    Label("New Invoice", systemImage: "plus")
                        .font(.system(.body, weight: .medium))
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.brandPrimary)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            
            Divider()
            
            // MARK: - Invoice List
            if filteredInvoices.isEmpty {
                EmptyStateView(
                    icon: "doc.text",
                    title: "No Invoices",
                    message: searchText.isEmpty ? "Create your first invoice to get started." : "No invoices match your search."
                )
            } else {
                List(selection: $selectedInvoices) {
                    ForEach(filteredInvoices) { invoice in
                        InvoiceRow(invoice: invoice)
                            .tag(invoice)
                    }
                }
                .listStyle(.inset(alternatesRowBackgrounds: true))
                .onChange(of: selectedInvoices) { _, newSelection in
                    if let first = newSelection.first {
                        editingInvoice = first
                        selectedInvoices.removeAll()
                    }
                }
            }
        }
        .searchable(text: $searchText, prompt: "Search invoices...")
        .sheet(isPresented: $showNewInvoice) {
            InvoiceFormView()
        }
        .sheet(item: $editingInvoice) { invoice in
            InvoiceFormView(invoice: invoice)
        }
    }
    
    private func statusCount(_ status: String) -> Int {
        invoices.filter { $0.status == status }.count
    }
    
    private func duplicateInvoice(_ invoice: Invoice) {
        let newInvoice = Invoice(
            invoiceNumber: "INV-\(UUID().uuidString.prefix(6).uppercased())",
            invoiceType: invoice.invoiceType,
            status: "draft",
            subtotal: invoice.subtotal,
            discount: invoice.discount,
            tax: invoice.tax,
            total: invoice.total,
            balanceDue: invoice.balanceDue,
            notes: invoice.notes,
            issueDate: Date(),
            dueDate: invoice.dueDate
        )
        modelContext.insert(newInvoice)
    }
    
    private func exportPDF(_ invoice: Invoice) {
        let generator = PDFGenerator()
        if let url = generator.generatePDF(for: invoice) {
            NSWorkspace.shared.open(url)
        }
    }
    
    private func deleteInvoice(_ invoice: Invoice) {
        modelContext.delete(invoice)
    }
}

// MARK: - Filter Pill

struct FilterPill: View {
    let title: String
    let count: Int
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(title)
                if count > 0 {
                    Text("\(count)")
                        .font(.caption2)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(isSelected ? Color.white.opacity(0.2) : Color.gray.opacity(0.15))
                        .clipShape(Capsule())
                }
            }
            .font(.system(.caption, weight: .medium))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(isSelected ? Color.brandPrimary.opacity(0.15) : Color.clear)
            .foregroundColor(isSelected ? Color.brandPrimary : .secondary)
            .clipShape(Capsule())
            .overlay(
                Capsule().stroke(isSelected ? Color.brandPrimary.opacity(0.5) : Color.gray.opacity(0.2), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Invoice Row

struct InvoiceRow: View {
    let invoice: Invoice
    
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(statusColor(for: invoice.status))
                .frame(width: 8, height: 8)
            VStack(alignment: .leading, spacing: 2) {
                Text(invoice.invoiceNumber.isEmpty ? "New Invoice" : invoice.invoiceNumber)
                    .font(.system(.body, weight: .semibold))
                if let client = invoice.client {
                    Text(client.fullName)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            Spacer()
            StatusBadge(status: invoice.status)
            Text(invoice.issueDate.formatted(date: .abbreviated, time: .omitted))
                .font(.caption)
                .foregroundColor(.secondary)
            Text(formatCurrency(invoice.total))
                .font(.system(.body, design: .monospaced).weight(.medium))
                .frame(width: 100, alignment: .trailing)
        }
        .padding(.vertical, 4)
    }
    
    private func statusColor(for status: String) -> Color {
        InvoiceStatus.color(for: status)
    }
    
    private func formatCurrency(_ amount: Double) -> String {
        CurrencyFormatter.shared.string(from: amount)
    }
}
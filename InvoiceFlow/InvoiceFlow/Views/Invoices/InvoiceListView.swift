import SwiftUI
import SwiftData

struct InvoiceListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Invoice.createdAt, order: .reverse) private var invoices: [Invoice]
    @State private var searchText = ""
    @State private var showNewInvoice = false
    @State private var editingInvoice: Invoice? = nil
    @State private var viewingInvoice: Invoice? = nil
    @State private var selectedInvoices = Set<Invoice>()
    @State private var invoiceToDelete: Invoice? = nil
    @State private var showDeleteConfirmation = false
    @State private var exportingInvoice: Invoice? = nil
    
    private var filteredInvoices: [Invoice] {
        invoices.filter { invoice in
            searchText.isEmpty ||
                invoice.invoiceNumber.localizedCaseInsensitiveContains(searchText) ||
                (invoice.client?.fullName.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }
    
    var body: some View {
        Group {
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
                            .contextMenu {
                                Button {
                                    viewingInvoice = invoice
                                } label: {
                                    Label("View Details", systemImage: "eye")
                                }
                                Button {
                                    editingInvoice = invoice
                                } label: {
                                    Label("Edit", systemImage: "pencil")
                                }
                                Divider()
                                Button {
                                    duplicateInvoice(invoice)
                                } label: {
                                    Label("Duplicate", systemImage: "doc.on.doc")
                                }
                                Button {
                                    exportingInvoice = invoice
                                } label: {
                                    Label("Export PDF", systemImage: "square.and.arrow.up")
                                }
                                Divider()
                                Button(role: .destructive) {
                                    invoiceToDelete = invoice
                                    showDeleteConfirmation = true
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
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
        .navigationTitle("Invoices")
        .navigationSubtitle("\(filteredInvoices.count) invoice\(filteredInvoices.count == 1 ? "" : "s")")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showNewInvoice = true
                } label: {
                    Label("New Invoice", systemImage: "plus")
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
        .sheet(item: $viewingInvoice) { invoice in
            InvoiceDetailView(invoice: invoice)
        }
        .sheet(item: $exportingInvoice) { invoice in
            PDFExportView(sourceInvoice: invoice)
        }
        .alert("Delete Invoice", isPresented: $showDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                if let invoice = invoiceToDelete {
                    deleteInvoice(invoice)
                }
            }
        } message: {
            Text("Are you sure you want to delete this invoice? This action cannot be undone.")
        }
    }
    
    private func duplicateInvoice(_ invoice: Invoice) {
        let newInvoice = Invoice(
            invoiceNumber: "INV-\(UUID().uuidString.prefix(6).uppercased())",
            invoiceType: invoice.invoiceType,
            subtotal: invoice.subtotal,
            discount: invoice.discount,
            tax: invoice.tax,
            total: invoice.total,
            balanceDue: invoice.balanceDue,
            notes: invoice.notes,
            issueDate: Date(),
            dueDate: invoice.dueDate
        )
        newInvoice.client = invoice.client
        modelContext.insert(newInvoice)
    }
    
    private func deleteInvoice(_ invoice: Invoice) {
        modelContext.delete(invoice)
    }
}

// MARK: - Invoice Row

struct InvoiceRow: View {
    let invoice: Invoice
    
    var body: some View {
        HStack(spacing: 12) {
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
            Text(invoice.invoiceType == "proforma" ? "Proforma" : "Invoice")
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 70, alignment: .center)
            Text(invoice.issueDate.formatted(date: .abbreviated, time: .omitted))
                .font(.caption)
                .foregroundColor(.secondary)
            Text(formatCurrency(invoice.total))
                .font(.system(.body, design: .monospaced).weight(.medium))
                .frame(width: 100, alignment: .trailing)
        }
        .padding(.vertical, 4)
    }
    
    private func formatCurrency(_ amount: Double) -> String {
        CurrencyFormatter.shared.string(from: amount)
    }
}
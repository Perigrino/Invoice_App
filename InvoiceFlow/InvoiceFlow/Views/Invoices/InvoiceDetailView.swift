import SwiftUI
import SwiftData

struct InvoiceDetailView: View {
    let invoice: Invoice
    var onExport: (() -> Void)?
    @Environment(\.modelContext) private var modelContext
    @State private var showingExportFallback = false

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading) {
                    Text(invoice.invoiceNumber)
                        .font(.title.bold())
                    Text(invoice.invoiceType.capitalized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Button {
                    if let onExport {
                        onExport()
                    } else {
                        showingExportFallback = true
                    }
                } label: {
                    Label("Export PDF", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("exportPDFButton")
            }
            .padding()

            Divider()

            // Invoice content
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Client info
                    if let client = invoice.client {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Bill To").font(.caption.bold()).foregroundColor(.secondary)
                            Text(client.fullName).font(.headline)
                            if let company = client.company { Text(company).font(.subheadline).foregroundColor(.secondary) }
                            if let email = client.email { Text(email).font(.subheadline).foregroundColor(.secondary) }
                        }
                    }

                    // Dates
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Issue Date").font(.caption.bold()).foregroundColor(.secondary)
                            Text(DateFormatHelper.string(from: invoice.issueDate))
                        }
                        Spacer()
                        if let dueDate = invoice.dueDate {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Due Date").font(.caption.bold()).foregroundColor(.secondary)
                                Text(DateFormatHelper.string(from: dueDate))
                            }
                        }
                    }

                    // Line items
                    VStack(spacing: 0) {
                        HStack {
                            Text("Description").font(.caption.bold()).foregroundColor(.secondary).frame(maxWidth: .infinity, alignment: .leading)
                            Text("Qty").font(.caption.bold()).foregroundColor(.secondary).frame(width: 50)
                            Text("Price").font(.caption.bold()).foregroundColor(.secondary).frame(width: 80)
                            Text("Tax").font(.caption.bold()).foregroundColor(.secondary).frame(width: 50)
                            Text("Total").font(.caption.bold()).foregroundColor(.secondary).frame(width: 80, alignment: .trailing)
                        }
                        .padding(.vertical, 8)
                        .background(Color.gray.opacity(0.1))

                        Divider()

                        ForEach(invoice.lineItems ?? []) { item in
                            HStack {
                                Text(item.itemDescription).frame(maxWidth: .infinity, alignment: .leading)
                                Text("\(Int(item.quantity))").frame(width: 50)
                                Text(formatCurrency(item.price)).frame(width: 80)
                                Text("\(Int(item.tax))%").frame(width: 50)
                                Text(formatCurrency(item.total)).frame(width: 80, alignment: .trailing)
                            }
                            .padding(.vertical, 6)
                            Divider()
                        }
                    }

                    // Totals
                    VStack(spacing: 8) {
                        HStack { Text("Subtotal").foregroundColor(.secondary); Spacer(); Text(formatCurrency(invoice.subtotal)) }
                        if invoice.discount > 0 { HStack { Text("Discount").foregroundColor(.secondary); Spacer(); Text("-\(formatCurrency(invoice.discount))").foregroundColor(.red) } }
                        if invoice.tax > 0 { HStack { Text("Tax").foregroundColor(.secondary); Spacer(); Text("+\(formatCurrency(invoice.tax))").foregroundColor(.green) } }
                        Divider()
                        HStack { Text("Total").font(.headline); Spacer(); Text(formatCurrency(invoice.total)).font(.headline) }
                        HStack { Text("Balance Due").font(.headline); Spacer(); Text(formatCurrency(invoice.balanceDue)).font(.headline).foregroundColor(.red) }
                    }
                    .padding()

                    // Notes
                    if let notes = invoice.notes, !notes.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Notes").font(.caption.bold()).foregroundColor(.secondary)
                            Text(notes).font(.body)
                        }
                    }
                }
                .padding()
            }
        }
        .sheet(isPresented: $showingExportFallback) {
            PDFExportView(sourceInvoice: invoice)
        }
    }

    private func formatCurrency(_ amount: Double) -> String {
        CurrencyFormatter.shared.string(from: amount)
    }
}

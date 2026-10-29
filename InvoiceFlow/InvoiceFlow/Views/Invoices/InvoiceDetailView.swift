import SwiftUI
import SwiftData

/// Invoice detail sheet: page header, gradient balance hero, info card, line
/// items + totals card, notes card — the prototype's `v-detail`.
struct InvoiceDetailView: View {
    let invoice: Invoice
    var onEdit: (() -> Void)?
    var onExport: (() -> Void)?
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var showingExportFallback = false
    @State private var showingAddPayment = false
    @State private var paymentToDelete: Payment?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                PageHeader(
                    invoice.invoiceNumber,
                    subtitle: "\(invoice.invoiceType == "proforma" ? "Proforma Invoice" : "Invoice") · issued \(DateFormatHelper.string(from: invoice.issueDate))"
                ) {
                    Button {
                        dismiss()
                    } label: {
                        Label("Back", systemImage: "chevron.left")
                    }
                    .buttonStyle(.plain)
                    .capsuleButton(.ghost)
                    .accessibilityIdentifier("closeDetail")

                    if let onEdit {
                        Button(action: onEdit) {
                            Label("Edit", systemImage: "pencil")
                        }
                        .buttonStyle(.plain)
                        .capsuleButton(.plain)
                    }

                    Button {
                        if let onExport {
                            onExport()
                        } else {
                            showingExportFallback = true
                        }
                    } label: {
                        Label("Export PDF", systemImage: "square.and.arrow.up")
                    }
                    .buttonStyle(.plain)
                    .capsuleButton(.primary)
                    .accessibilityIdentifier("exportPDFButton")

                    Button {
                        showingAddPayment = true
                    } label: {
                        Label("Add Payment…", systemImage: "dollarsign.circle")
                    }
                    .buttonStyle(.plain)
                    .capsuleButton(.plain)
                    .help("Record a payment (⏎)")
                    .accessibilityIdentifier("addPaymentButton")
                }

                heroCard
                infoCard
                itemsCard
                paymentsCard

                if let notes = invoice.notes, !notes.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionLabel("Notes")
                        Text(notes)
                            .font(.system(size: 12.5))
                            .foregroundColor(Theme.textSecondary)
                            .lineSpacing(3)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(18)
                    .glassCard(radius: Theme.radiusLarge)
                }
            }
            .padding(28)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollIndicators(.hidden)
        .background { ThemeCanvas().ignoresSafeArea() }
        .sheet(isPresented: $showingExportFallback) {
            PDFExportView(sourceInvoice: invoice)
        }
        .sheet(isPresented: $showingAddPayment) {
            PaymentSheet(invoice: invoice)
        }
        .alert(
            "Delete this Payment?",
            isPresented: Binding(
                get: { paymentToDelete != nil },
                set: { if !$0 { paymentToDelete = nil } }
            )
        ) {
            Button("Delete", role: .destructive) {
                if let payment = paymentToDelete {
                    modelContext.delete(payment)
                    invoice.recalculateBalance()
                    modelContext.persist()
                }
                paymentToDelete = nil
            }
            Button("Cancel", role: .cancel) { paymentToDelete = nil }
        } message: {
            Text("This payment will be removed from the invoice and the balance due will go back up.")
        }
    }

    // MARK: - Hero

    private var heroCard: some View {
        HStack(alignment: .center, spacing: 18) {
            VStack(alignment: .leading, spacing: 4) {
                SectionLabel("Balance Due")
                    .foregroundColor(Theme.onAccent.opacity(0.85))
                Text(formatCurrency(invoice.balanceDue))
                    .font(.system(size: 30, weight: .bold))
                    .kerning(-0.6)
                    .monospacedDigit()
                    .foregroundColor(Theme.onAccent)
            }
            Spacer(minLength: 12)
            VStack(alignment: .trailing, spacing: 2) {
                Text(dueLineOne)
                    .font(.system(size: 11.5, weight: .semibold))
                Text(dueLineTwo)
                    .font(.system(size: 11.5))
                    .opacity(0.85)
            }
            .foregroundColor(Theme.onAccent.opacity(0.92))
            .multilineTextAlignment(.trailing)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 18)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: Theme.radiusLarge, style: .continuous)
                .fill(Theme.gradientDiagonal)
        )
        .shadow(color: Theme.palette.glowStrong, radius: 44, x: 0, y: 18)
    }

    private var dueLineOne: String {
        guard let due = invoice.dueDate else { return "No due date" }
        switch invoice.status {
        case .paid: return "Paid"
        case .partiallyPaid:
            let days = invoice.daysTo(due)
            if days < 0 {
                return "Partially Paid · Overdue by \(abs(days)) day\(abs(days) == 1 ? "" : "s")"
            }
            return "Partially Paid · Due in \(max(days, 0)) day\(days == 1 ? "" : "s")"
        case .overdue:
            return "Overdue by \(abs(invoice.daysTo(due))) day\(abs(invoice.daysTo(due)) == 1 ? "" : "s")"
        case .dueSoon, .upcoming:
            let days = invoice.daysTo(due)
            if days == 0 { return "Due today" }
            return "Due in \(days) day\(days == 1 ? "" : "s")"
        }
    }

    private var dueLineTwo: String {
        guard let due = invoice.dueDate else { return DateFormatHelper.string(from: invoice.issueDate) }
        return DateFormatHelper.string(from: due)
    }

    // MARK: - Info card

    private var infoCard: some View {
        HStack(alignment: .top, spacing: 24) {
            VStack(alignment: .leading, spacing: 4) {
                SectionLabel("Bill To")
                if let client = invoice.client {
                    Text(client.fullName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Theme.textPrimary)
                    if let company = client.company, !company.isEmpty {
                        detailLine(company)
                    }
                    if let email = client.email, !email.isEmpty {
                        detailLine(email)
                    }
                } else {
                    Text("No client")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Theme.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 4) {
                SectionLabel("Dates")
                Text("Issued \(DateFormatHelper.string(from: invoice.issueDate))")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Theme.textPrimary)
                if let due = invoice.dueDate {
                    detailLine("Due \(DateFormatHelper.string(from: due))")
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(18)
        .glassCard(radius: Theme.radiusLarge)
    }

    private func detailLine(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12.5))
            .foregroundColor(Theme.textSecondary)
    }

    // MARK: - Line items + totals

    private var itemsCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                tableHead("Description")
                tableHead("Qty", width: 46, align: .trailing)
                tableHead("Price", width: 84, align: .trailing)
                tableHead("Tax", width: 62, align: .trailing)
                tableHead("Total", width: 92, align: .trailing)
            }
            .padding(.horizontal, 10)
            .padding(.bottom, 8)

            ForEach(invoice.lineItems ?? []) { item in
                HStack(alignment: .top, spacing: 10) {
                    Text(item.itemDescription)
                        .font(.system(size: 12.5, weight: .medium))
                        .foregroundColor(Theme.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("\(Int(item.quantity))")
                        .frame(width: 46, alignment: .trailing)
                    Text(formatCurrency(item.price))
                        .frame(width: 84, alignment: .trailing)
                    Text("\(Int(item.tax))%")
                        .frame(width: 62, alignment: .trailing)
                    Text(formatCurrency(item.total))
                        .font(.system(size: 12.5, weight: .semibold))
                        .frame(width: 92, alignment: .trailing)
                }
                .font(.system(size: 12.5))
                .monospacedDigit()
                .foregroundColor(Theme.textSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 10)
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.rowSeparator).frame(height: 1)
                }
            }

            totals
                .padding(.top, 14)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard(radius: Theme.radiusLarge)
    }

    private func tableHead(_ title: String, width: CGFloat? = nil, align: Alignment = .leading) -> some View {
        SectionLabel(title)
            .frame(width: width, alignment: align == .trailing ? .trailing : .leading)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
    }

    private var totals: some View {
        VStack(spacing: 9) {
            totalRow("Subtotal", formatCurrency(invoice.subtotal))
            totalRow(
                "Discount",
                "−\(formatCurrency(discountAmount))",
                tint: invoice.discount > 0 ? Theme.negative : nil
            )
            totalRow(
                "Tax",
                "+\(formatCurrency(taxAmount))",
                tint: invoice.tax > 0 ? Theme.positive : nil
            )
            Rectangle().fill(Theme.rowSeparator).frame(height: 1)
            grandRow("Total", formatCurrency(invoice.total))
            if amountsPaid > .zero {
                totalRow(
                    "Payments",
                    "−\(formatCurrency(amountsPaid))",
                    tint: Theme.positive
                )
            }
            grandRow(
                "Balance Due",
                formatCurrency(invoice.balanceDue),
                tint: invoice.balanceDue > 0 ? Theme.negative : Theme.positive
            )
        }
        .frame(width: 280)
        .frame(maxWidth: .infinity, alignment: .trailing)
    }

    // The model stores discount/tax as percents, but the totals rows show
    // amounts (matching the form). There was a bug here where the raw
    // percents were formatted as money amounts; compute the amounts instead.
    private var discountAmount: Decimal {
        (invoice.subtotal * Decimal(invoice.discount) / 100).roundedCents
    }
    private var taxAmount: Decimal {
        ((invoice.subtotal - invoice.subtotal * Decimal(invoice.discount) / 100) * Decimal(invoice.tax) / 100).roundedCents
    }

    // MARK: - Payments

    private var sortedPayments: [Payment] {
        (invoice.payments ?? []).sorted { $0.date > $1.date }
    }

    private var amountsPaid: Decimal {
        (invoice.payments ?? []).reduce(Decimal.zero) { $0 + $1.amount }
    }

    /// Prototype `.payments` card: every recorded payment, newest first.
    /// Deleting a row raises the balance back — the balance is derived, so
    /// this card never needs a save button.
    private var paymentsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("Payments")

            if sortedPayments.isEmpty {
                VStack(spacing: 10) {
                    Text("No Payments Yet")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(Theme.textSecondary)
                    Button {
                        showingAddPayment = true
                    } label: {
                        Label("Add Payment…", systemImage: "dollarsign.circle")
                    }
                    .buttonStyle(.plain)
                    .capsuleButton(.plain, small: true)
                    .accessibilityIdentifier("addPaymentEmptyStateButton")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
            } else {
                ForEach(sortedPayments, id: \.id) { payment in
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(DateFormatHelper.string(from: payment.date))
                                .font(.system(size: 12.5, weight: .medium))
                                .foregroundColor(Theme.textPrimary)
                            Text(payment.method)
                                .font(.system(size: 11.5))
                                .foregroundColor(Theme.textSecondary)
                            if let notes = payment.notes, !notes.isEmpty {
                                Text(notes)
                                    .font(.system(size: 11.5))
                                    .foregroundColor(Theme.textMuted)
                            }
                        }
                        Spacer(minLength: 8)
                        Text(formatCurrency(payment.amount))
                            .font(.system(size: 12.5, weight: .semibold))
                            .monospacedDigit()
                            .foregroundColor(Theme.textPrimary)
                        Button {
                            paymentToDelete = payment
                        } label: {
                            Image(systemName: "trash")
                                .font(.system(size: 12))
                                .foregroundColor(Theme.textMuted)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .help("Delete this payment")
                        .accessibilityIdentifier("deletePaymentButton")
                    }
                    .padding(.vertical, 8)
                    .overlay(alignment: .bottom) {
                        Rectangle().fill(Theme.rowSeparator).frame(height: 1)
                    }
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard(radius: Theme.radiusLarge)
    }

    private func formatCurrency(_ amount: Decimal) -> String {
        CurrencyFormatter.shared.string(from: amount)
    }

    private func totalRow(_ label: String, _ value: String, tint: Color? = nil) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 12.5))
                .foregroundColor(Theme.textSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 12.5))
                .monospacedDigit()
                .foregroundColor(tint ?? Theme.textPrimary)
        }
    }

    private func grandRow(_ label: String, _ value: String, tint: Color? = nil) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(Theme.textPrimary)
            Spacer()
            Text(value)
                .font(.system(size: 15, weight: .bold))
                .monospacedDigit()
                .foregroundColor(tint ?? Theme.textPrimary)
        }
    }
}

// MARK: - Add Payment sheet

/// One short task: record a payment against the invoice. Prefills the
/// remaining balance and today's date; Return confirms, Escape cancels.
struct PaymentSheet: View {
    let invoice: Invoice

    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var amount: Decimal = .zero
    @State private var date = Date()
    @State private var method = "Bank Transfer"
    @State private var errorMessage: String?

    private static let methods = ["Bank Transfer", "Cash", "Card", "Mobile Money", "Other"]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Add Payment")
                .font(.system(size: 17, weight: .bold))
                .foregroundColor(Theme.textPrimary)
            Text("\(invoice.invoiceNumber) · balance due \(formatCurrency(invoice.balanceDue))")
                .font(.system(size: 12))
                .foregroundColor(Theme.textSecondary)

            VStack(alignment: .leading, spacing: 6) {
                Text("AMOUNT").modifier(FieldLabelStyle())
                TextField("0", value: $amount, format: .number)
                    .textFieldStyle(GlassFieldStyle())
                if let errorMessage {
                    Text(errorMessage)
                        .font(.system(size: 11.5))
                        .foregroundColor(Theme.negative)
                }
            }

            HStack(alignment: .top, spacing: 18) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("DATE").modifier(FieldLabelStyle())
                    DatePicker("", selection: $date, displayedComponents: .date)
                        .labelsHidden()
                        .textFieldStyle(GlassFieldStyle())
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("METHOD").modifier(FieldLabelStyle())
                    Picker("", selection: $method) {
                        ForEach(Self.methods, id: \.self) { option in
                            Text(option).tag(option)
                        }
                    }
                    .labelsHidden()
                    .textFieldStyle(GlassFieldStyle())
                }
            }

            HStack {
                Spacer()
                Button("Cancel") { dismiss() }
                    .buttonStyle(.plain)
                    .capsuleButton(.plain)
                    .keyboardShortcut(.cancelAction)
                Button("Record Payment") { recordPayment() }
                    .buttonStyle(.plain)
                    .capsuleButton(.primary)
                    .keyboardShortcut(.defaultAction)
            }
        }
        .padding(24)
        .frame(width: 420)
        .glassCard(radius: Theme.radiusLarge)
        .background { ThemeCanvas().ignoresSafeArea() }
        .onAppear { amount = invoice.balanceDue }
    }

    private func recordPayment() {
        if amount <= .zero {
            errorMessage = "Enter an amount."
            return
        }
        if amount > invoice.balanceDue {
            errorMessage = "Payment is larger than the balance due."
            return
        }
        let payment = Payment(amount: amount.roundedCents, date: date, method: method)
        modelContext.insert(payment)
        payment.invoice = invoice
        invoice.recalculateBalance()
        if modelContext.persist() {
            dismiss()
        } else {
            errorMessage = "Could not save the payment. Try again."
        }
    }

    private func formatCurrency(_ value: Decimal) -> String {
        CurrencyFormatter.shared.string(from: value)
    }
}

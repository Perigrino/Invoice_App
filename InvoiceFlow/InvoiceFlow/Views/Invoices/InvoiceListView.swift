import SwiftUI
import SwiftData

struct InvoiceListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Invoice.createdAt, order: .reverse) private var invoices: [Invoice]
    @State private var searchText = ""
    @Binding var statusFilter: InvoiceStatus?
    @State private var showNewInvoice = false
    @State private var editingInvoice: Invoice? = nil
    @State private var viewingInvoice: Invoice? = nil
    @State private var invoiceToDelete: Invoice? = nil
    @State private var showDeleteConfirmation = false
    @State private var exportingInvoice: Invoice? = nil
    @State private var paymentInvoice: Invoice? = nil

    private var searchedInvoices: [Invoice] {
        invoices.filter { invoice in
            searchText.isEmpty ||
                invoice.invoiceNumber.localizedCaseInsensitiveContains(searchText) ||
                (invoice.client?.fullName.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    private var filteredInvoices: [Invoice] {
        guard let status = statusFilter else { return searchedInvoices }
        return searchedInvoices.filter { $0.status == status }
    }

    var body: some View {
        VStack(spacing: 0) {
            PageHeader("Invoices", subtitle: "Track billing, payments, and what's due next.") {
                Button {
                    showNewInvoice = true
                } label: {
                    Label("New Invoice", systemImage: "plus")
                }
                .buttonStyle(.plain)
                .capsuleButton(.primary)
            }
            .padding(.horizontal, 28)

            HStack {
                Spacer(minLength: 0)
                inlineSearch
            }
            .padding(.horizontal, 28)
            .padding(.top, 12)

            statusFilterRow

            // Same hoisted label as the client list, so both lists open on a
            // data row and read identically.
            if !filteredInvoices.isEmpty {
                SectionLabel("\(filteredInvoices.count) Invoice\(filteredInvoices.count == 1 ? "" : "s")", uppercased: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 28)
                    .padding(.top, 14)
                    .padding(.bottom, 2)
                    .appear()
            }

            if filteredInvoices.isEmpty {
                Spacer(minLength: 0)
                EmptyStateView(
                    icon: "doc.text",
                    title: "No Invoices",
                    message: searchText.isEmpty ? "Create your first invoice to get started." : "No invoices match your search.",
                    actionTitle: searchText.isEmpty ? "Create Invoice" : nil,
                    action: searchText.isEmpty ? { showNewInvoice = true } : nil
                )
                Spacer(minLength: 0)
            } else {
                invoiceList
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .navigationTitle("Invoices")
        .sheet(isPresented: $showNewInvoice) {
            InvoiceFormView()
        }
        .sheet(item: $editingInvoice) { invoice in
            InvoiceFormView(invoice: invoice)
        }
        .sheet(item: $viewingInvoice) { invoice in
            InvoiceDetailView(invoice: invoice, onEdit: {
                viewingInvoice = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    editingInvoice = invoice
                }
            }) {
                viewingInvoice = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    exportingInvoice = invoice
                }
            }
            // Wide fixed sheet so the line-item table never squishes the
            // description into a one-letter-per-line column.
            .frame(minWidth: 820, idealWidth: 880, minHeight: 620)
        }
        .sheet(item: $exportingInvoice) { invoice in
            PDFExportView(sourceInvoice: invoice)
        }
        .sheet(item: $paymentInvoice) { invoice in
            PaymentSheet(invoice: invoice)
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

    // MARK: - Search

    @FocusState private var searchFocused: Bool

    /// Prototype `.search`: capsule field at the right end of the chips row.
    private var inlineSearch: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 11))
                .foregroundColor(Theme.textMuted)
            TextField("Search invoices...", text: $searchText)
                .textFieldStyle(.plain)
                .font(.system(size: 12.5))
                .foregroundColor(Theme.textPrimary)
                .focused($searchFocused)
        }
        .padding(.horizontal, 12)
        .frame(height: 32)
        .frame(minWidth: 210)
        .background(Capsule().fill(Theme.field))
        .overlay {
            Capsule().strokeBorder(
                searchFocused ? Theme.accent.opacity(0.55) : Theme.hairline,
                lineWidth: 1
            )
        }
        .accessibilityAddTraits(.isSearchField)
    }

    // MARK: - Status filter chips

    /// S-022: a row of status chips below the search bar. Clicking one narrows
    /// the list to that status; a "All" chip clears it. The dashboard's
    /// outstanding widget lands here with the same filter pre-set.
    private var statusFilterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                filterChip("All", kind: .plain, selected: statusFilter == nil) {
                    statusFilter = nil
                }
                ForEach(InvoiceStatus.allCases, id: \.self) { status in
                    filterChip(
                        status.filterLabel,
                        kind: status.pillKind,
                        selected: statusFilter == status
                    ) {
                        statusFilter = status
                    }
                }
            }
            .padding(.vertical, 2)
        }
        .padding(.horizontal, 28)
        .padding(.top, 8)
        .padding(.bottom, 2)
    }

    private func filterChip(
        _ text: String,
        kind: StatusPill.Kind,
        selected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(text)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(selected ? Theme.onAccent : Theme.textSecondary)
                .padding(.horizontal, 10)
                .frame(height: 22)
                .background {
                    Capsule()
                        .fill(selected ? AnyShapeStyle(Theme.gradient) : AnyShapeStyle(Theme.hover))
                }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("statusFilter-\(text)")
    }

    // MARK: - List

    private var invoiceList: some View {
        // No List(selection:) — the system's selection highlight bled through
        // the translucent cards (see ContentView sidebar note). Rows are
        // Buttons; a click opens the invoice detail (S-022 follow-up fix).
        List {
            ForEach(filteredInvoices) { invoice in
                invoiceRow(invoice)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .focusEffectDisabled()
        // Keep the table's row height in sync with the fixed row content —
        // rows inserted while a sheet covers the window are otherwise stuck at
        // the table's 24pt default (overlapping the next row).
        // See TableRowHeightFix.
        .overlay {
            TableRowHeightFix(
                height: InvoiceRow.tableRowHeight,
                dataCount: filteredInvoices.count
            )
        }
    }

    private func invoiceRow(_ invoice: Invoice) -> some View {
        Button {
            viewingInvoice = invoice
        } label: {
            InvoiceRow(invoice: invoice)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("invoiceRow-\(invoice.invoiceNumber)")
        .listRowInsets(EdgeInsets(top: 5, leading: 28, bottom: 5, trailing: 28))
        .listRowSeparator(.hidden)
        .listRowBackground(Color.clear)
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
                paymentInvoice = invoice
            } label: {
                Label("Add Payment…", systemImage: "dollarsign.circle")
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

    private func duplicateInvoice(_ invoice: Invoice) {
        let newNumber = generateUniqueInvoiceNumber()
        let newInvoice = Invoice(
            invoiceNumber: newNumber,
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
        modelContext.persist()
    }

    private func generateUniqueInvoiceNumber() -> String {
        let yearShort = Calendar.current.component(.year, from: Date()) % 100
        let yearPrefix = "INV-\(String(format: "%02d", yearShort))"

        // Fetch all existing invoice numbers
        let descriptor = FetchDescriptor<Invoice>()
        let allInvoices = (try? modelContext.fetch(descriptor)) ?? []
        let existingNumbers = Set(allInvoices.map { $0.invoiceNumber })

        // Find the highest sequence number for this year
        var maxSequence = 0
        for number in existingNumbers {
            if number.hasPrefix(yearPrefix + "-") {
                let suffix = String(number.dropFirst(yearPrefix.count + 1))
                if let seq = Int(suffix), seq > maxSequence {
                    maxSequence = seq
                }
            }
        }

        let nextSequence = maxSequence + 1
        return "\(yearPrefix)-\(String(format: "%04d", nextSequence))"
    }

    private func deleteInvoice(_ invoice: Invoice) {
        modelContext.delete(invoice)
        modelContext.persist()
    }
}


// MARK: - Invoice Row

/// One glass card: countdown tile, number + client, type pill + date, amount,
/// chevron — the prototype's `invoice-row` with its status wash.
struct InvoiceRow: View {
    /// Fixed height: SwiftUI's `List` only re-measures a row when it lays it
    /// out, and rows created while a sheet is on screen keep the table's
    /// default 24pt height — their second line then spills over the next row.
    static let rowHeight: CGFloat = 64
    /// Full row pitch inside the table: content height + the list's vertical
    /// row insets (5 + 5 in `invoiceList`).
    static let tableRowHeight: CGFloat = rowHeight + 10

    let invoice: Invoice

    @State private var hovering = false

    private var tintSeed: String { invoice.client?.fullName ?? invoice.invoiceNumber }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Theme.radiusCard, style: .continuous)

        HStack(spacing: 14) {
            tile

            VStack(alignment: .leading, spacing: 3) {
                Text(invoice.invoiceNumber.isEmpty ? "New Invoice" : invoice.invoiceNumber)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundColor(Theme.textPrimary)
                    .lineLimit(1)
                if let client = invoice.client {
                    HStack(spacing: 5) {
                        Image(systemName: "person")
                            .font(.system(size: 10))
                            .foregroundColor(Theme.textMuted)
                        Text(client.fullName)
                            .font(.system(size: 11.5))
                            .foregroundColor(Theme.textSecondary)
                            .lineLimit(1)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 10) {
                StatusPill(text: pillText, kind: pillKind)
                HStack(spacing: 5) {
                    Image(systemName: dateIcon)
                        .font(.system(size: 10))
                    Text(DateFormatHelper.string(from: displayDate))
                        .monospacedDigit()
                }
                .font(.system(size: 11.5))
                .foregroundColor(Theme.textSecondary)
            }

            Text(formatCurrency(invoice.total))
                .font(.system(size: 13.5, weight: .semibold))
                .monospacedDigit()
                .foregroundColor(Theme.textPrimary)
                .frame(minWidth: 92, alignment: .trailing)

            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(Theme.textMuted)
        }
        .padding(.horizontal, 14)
        .frame(height: Self.rowHeight)
        .background {
            ZStack {
                shape.fill(.ultraThinMaterial)
                shape.fill(Theme.cardFill)
                if let wash = wash {
                    shape.fill(wash)
                }
                // PosterTint port: a deterministic per-client wash, skewed 135°.
                LinearGradient(
                    colors: [Theme.tint(for: tintSeed).opacity(0.18), .clear],
                    startPoint: .topLeading,
                    endPoint: .center
                )
                .clipShape(shape)
            }
        }
        .overlay {
            shape.strokeBorder(
                LinearGradient(
                    colors: [Theme.cardStrokeTop, Theme.cardStrokeBottom],
                    startPoint: .top,
                    endPoint: .bottom
                ),
                lineWidth: 1
            )
        }
        .clipShape(shape)
        .shadow(color: hovering ? .black.opacity(0.35) : .clear, radius: 14, x: 0, y: 6)
        .scaleEffect(hovering ? 1.006 : 1)
        .animation(Theme.quick, value: hovering)
        .onHover { hovering = $0 }
        .appear(quick: true)
    }

    /// Days-to-due tile — the prototype's leading element, replacing the
    /// initials avatar. Open invoices show days to due (or days late) on a
    /// countdown gradient; paid invoices fall back to a muted "Paid" state.
    private var tile: some View {
        ZStack {
            switch tileKind {
            case .countdown(let gradient, let glow):
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(gradient)
                    .shadow(color: glow.opacity(0.22), radius: 9, x: 0, y: 8)
                tileText
            case .muted(let label, let symbol):
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Theme.hover)
                    .overlay {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .strokeBorder(Theme.hairline, lineWidth: 1)
                    }
                VStack(spacing: 3) {
                    Image(systemName: symbol)
                        .font(.system(size: 13, weight: .semibold))
                    Text(label)
                        .font(.system(size: 8.5, weight: .semibold))
                        .tracking(0.6)
                        .textCase(.uppercase)
                }
                .foregroundColor(Theme.textSecondary)
            }
        }
        .frame(width: 56, height: 62)
        .animation(Theme.quick, value: invoice.status)
    }

    /// The large countdown number over its small uppercase label, on-accent.
    private var tileText: some View {
        VStack(spacing: 3) {
            Text(tileNumber)
                .font(.system(size: 17, weight: .bold, design: .rounded))
                .monospacedDigit()
            Text(tileLabel)
                .font(.system(size: 8.5, weight: .semibold))
                .tracking(0.6)
                .textCase(.uppercase)
                .opacity(0.9)
        }
        .foregroundColor(Theme.onAccent)
    }

    private enum TileKind {
        case countdown(LinearGradient, Color)
        case muted(String, String)
    }

    private var tileKind: TileKind {
        switch invoice.status {
        case .paid:
            return .muted("Paid", "checkmark")
        default:
            guard let due = invoice.dueDate else {
                return .muted("Draft", "calendar")
            }
            let days = invoice.daysTo(due)
            if days < 0 {
                return .countdown(Theme.overdueGradient, Theme.glowOverdueTile)
            }
            return .countdown(Theme.gradient, Theme.glowAccent)
        }
    }

    /// Tile headline: days to due, days late, or a dash without a due date.
    private var tileNumber: String {
        guard let due = invoice.dueDate else { return "—" }
        let days = invoice.daysTo(due)
        let magnitude = days < 0 ? -days : days
        return magnitude > 99 ? "99+" : "\(magnitude)"
    }

    /// Tile sub-label: "Days" when due ahead, "Late" when overdue.
    private var tileLabel: String {
        guard let due = invoice.dueDate else { return "No Due" }
        return invoice.daysTo(due) < 0 ? "Late" : "Days"
    }

    private var wash: LinearGradient? {
        switch invoice.status {
        case .overdue: return Theme.washOverdue
        case .dueSoon: return Theme.washDue
        case .paid, .partiallyPaid, .upcoming: return nil
        }
    }

    private var pillKind: StatusPill.Kind {
        switch invoice.status {
        case .paid: return .paid
        case .partiallyPaid: return .due
        case .overdue: return .overdue
        case .dueSoon: return .due
        case .upcoming: return .plain
        }
    }

    /// Prototype pill copy: paid rows read "Paid"; open rows show the type.
    private var pillText: String {
        switch invoice.status {
        case .paid: return "Paid"
        case .partiallyPaid: return "Partially Paid"
        default: return invoice.invoiceType == "proforma" ? "Proforma" : "Invoice"
        }
    }

    private var displayDate: Date { invoice.dueDate ?? invoice.issueDate }

    private var dateIcon: String {
        invoice.status == .overdue ? "exclamationmark.triangle" : "calendar"
    }

    private func formatCurrency(_ amount: Decimal) -> String {
        CurrencyFormatter.shared.string(from: amount)
    }
}

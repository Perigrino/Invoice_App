//
//  DashboardView.swift
//  InvoiceFlow
//
//  The hub page (FreshBooks pattern): "Create New" comes first, then an
//  outstanding-money widget. M5 (S-040) fills the remaining widget slots.
//

import SwiftUI
import SwiftData

struct DashboardView: View {
    @Binding var selectedTab: SidebarTab
    @Environment(\.modelContext) private var modelContext
    @Query private var invoices: [Invoice]

    @State private var showNewInvoice = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PageHeader(
                    "Dashboard",
                    subtitle: "Your money at a glance."
                ) {
                    Button {
                        showNewInvoice = true
                    } label: {
                        Label("New Invoice", systemImage: "plus")
                    }
                    .capsuleButton(.primary)
                    .help("Create a new invoice (⌘N)")
                    .accessibilityIdentifier("dashboardNewInvoice")
                }

                // MARK: Create New (first widget — FreshBooks order)

                HStack(spacing: 14) {
                    createTile(
                        "New Invoice",
                        subtitle: "Bill a client",
                        symbol: "doc.text",
                        highlight: true
                    ) { showNewInvoice = true }

                    createTile(
                        "New Client",
                        subtitle: "Open the client list",
                        symbol: "person.2"
                    ) { selectedTab = .clients }

                    createTile(
                        "Export Backup",
                        subtitle: "Keep a safecopy",
                        symbol: "square.and.arrow.down"
                    ) { selectedTab = .settings }
                }

                // MARK: Outstanding money

                outstandingWidget

                // MARK: Widget slots for M5 (S-040 fills reports/aging deep-dives)

                SectionLabel("Coming Soon")
                VStack {
                    HStack(spacing: 10) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(Theme.accent)
                        Text("More widgets arrive with reports — revenue by client, aging detail, and saved views.")
                            .font(.system(size: 12.5))
                            .foregroundColor(Theme.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .glassCard()
            }
            .padding(24)
            .frame(maxWidth: 980, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .sheet(isPresented: $showNewInvoice) {
            InvoiceFormView()
                .frame(minWidth: 820, idealWidth: 880, minHeight: 620)
        }
    }

    // MARK: - Create tiles

    private func createTile(
        _ title: String,
        subtitle: String,
        symbol: String,
        highlight: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: symbol)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(highlight ? Theme.onAccent : Theme.accent)
                    .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 13.5, weight: .semibold))
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundColor(Theme.textMuted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Theme.radiusLarge, style: .continuous)
                    .fill(highlight ? AnyShapeStyle(Theme.gradient) : AnyShapeStyle(Theme.cardFill))
            )
            .overlay {
                RoundedRectangle(cornerRadius: Theme.radiusLarge, style: .continuous)
                    .strokeBorder(
                        highlight ? AnyShapeStyle(Color.clear) : AnyShapeStyle(Theme.hairline),
                        lineWidth: 1
                    )
            }
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLarge, style: .continuous))
        }
        .buttonStyle(.plain)
        .hoverLift()
        .accessibilityIdentifier("dashboardTile-\(title)")
    }

    // MARK: - Outstanding money

    private var openInvoices: [Invoice] {
        invoices.filter { $0.status != .paid }
    }

    private var overdueBucket: (count: Int, amount: Decimal) {
        let rows = openInvoices.filter { $0.status == .overdue }
        return (rows.count, rows.reduce(Decimal.zero) { $0 + $1.balanceDue })
    }

    private var dueSoonBucket: (count: Int, amount: Decimal) {
        let rows = openInvoices.filter { $0.status == .dueSoon || $0.status == .partiallyPaid }
        return (rows.count, rows.reduce(Decimal.zero) { $0 + $1.balanceDue })
    }

    private var outstandingBucket: (count: Int, amount: Decimal) {
        (openInvoices.count, openInvoices.reduce(Decimal.zero) { $0 + $1.balanceDue })
    }

    private var outstandingWidget: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Outstanding")
            VStack(spacing: 0) {
                agingRow(
                    label: "Overdue",
                    symbol: "exclamationmark.triangle",
                    color: Theme.negative,
                    bucket: overdueBucket
                )
                rowSeparator
                agingRow(
                    label: "Due Soon",
                    symbol: "clock",
                    color: Theme.warning,
                    bucket: dueSoonBucket
                )
                rowSeparator
                agingRow(
                    label: "All Outstanding",
                    symbol: "tray.full",
                    color: Theme.accent,
                    bucket: outstandingBucket
                )
            }
            .glassCard(radius: Theme.radiusLarge)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func agingRow(
        label: String,
        symbol: String,
        color: Color,
        bucket: (count: Int, amount: Decimal)
    ) -> some View {
        Button {
            selectedTab = .invoices
        } label: {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(color)
                    .frame(width: 16)
                Text(label)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Theme.textPrimary)
                Spacer(minLength: 8)
                Text(formatCurrency(bucket.amount))
                    .font(.system(size: 13.5, weight: .semibold))
                    .monospacedDigit()
                    .foregroundColor(Theme.textPrimary)
                Text(bucket.count == 1 ? "1 invoice" : "\(bucket.count) invoices")
                    .font(.system(size: 11))
                    .foregroundColor(Theme.textMuted)
                    .frame(minWidth: 74, alignment: .trailing)
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(Theme.textMuted)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .help("Open invoices (\(label))")
    }

    private var rowSeparator: some View {
        Rectangle()
            .fill(Theme.rowSeparator)
            .frame(height: 1)
            .padding(.leading, 16)
    }

    private func formatCurrency(_ amount: Decimal) -> String {
        CurrencyFormatter.shared.string(from: amount)
    }
}

import Foundation
import SwiftData

@Model
final class Invoice {
    var id: UUID
    var invoiceNumber: String
    var invoiceType: String
    var subtotal: Decimal
    /// Invoice-level percent (0–100), applied to the line-item subtotal.
    var discount: Double
    /// Invoice-level percent (0–100), applied after the discount.
    var tax: Double
    var total: Decimal
    var balanceDue: Decimal
    var notes: String?
    var issueDate: Date
    var dueDate: Date?
    var createdAt: Date
    var updatedAt: Date

    @Relationship(deleteRule: .cascade, inverse: \InvoiceLineItem.invoice)
    var lineItems: [InvoiceLineItem]?

    /// Money-in records; cascade so deleting an invoice removes its payments.
    @Relationship(deleteRule: .cascade, inverse: \Payment.invoice)
    var payments: [Payment]?

    var client: Client?

    init(
        id: UUID = UUID(),
        invoiceNumber: String = "",
        invoiceType: String = "invoice",
        subtotal: Decimal = .zero,
        discount: Double = 0,
        tax: Double = 0,
        total: Decimal = .zero,
        balanceDue: Decimal = .zero,
        notes: String? = nil,
        issueDate: Date = Date(),
        dueDate: Date? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.invoiceNumber = invoiceNumber
        self.invoiceType = invoiceType
        self.subtotal = subtotal
        self.discount = discount
        self.tax = tax
        self.total = total
        self.balanceDue = balanceDue
        self.notes = notes
        self.issueDate = issueDate
        self.dueDate = dueDate
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    /// Recomputes money totals from the line items. The formulas with
    /// `discount`/`tax` treated as invoice-level percents match the original
    /// 0.2.0 behaviour exactly — only the numeric type changed (and cents are
    /// now rounded deterministically instead of relying on `Double`).
    /// NOTE: per-line `total` already includes that line's percent tax, so
    /// the invoice-level `tax` percent is effectively applied on top. Fixing
    /// that semantics gap is deferred (M3, docs/STORIES.md S-021).
    func recalculate() {
        let items = lineItems ?? []
        let itemSubtotal = items.reduce(Decimal.zero) { $0 + $1.total }
        let discountTotal = items.reduce(Decimal.zero) { $0 + ($1.total * Decimal($1.discount) / 100) }
        let taxTotal = items.reduce(Decimal.zero) { $0 + ($1.total * Decimal($1.tax) / 100) }
        subtotal = itemSubtotal
        total = (itemSubtotal - discountTotal + taxTotal).roundedCents
        recalculateBalance()
        updatedAt = Date()
    }

    /// Balance due = total − payments, never negative. Payments are the
    /// only money-in, so this is derived — never stored as a flag.
    func recalculateBalance() {
        let paid = (payments ?? []).reduce(Decimal.zero) { $0 + $1.amount }
        balanceDue = max(total - paid, .zero).roundedCents
    }
}

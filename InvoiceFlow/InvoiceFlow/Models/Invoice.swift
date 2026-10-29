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

    /// Recomputes money totals from the line items. Per-line totals include
    /// their own discount and tax; the invoice-level percents apply to the
    /// resulting subtotal and tax again (S-021 semantics — mirrors saveInvoice).
    func recalculate() {
        let items = lineItems ?? []
        let itemSubtotal = items.reduce(Decimal.zero) { $0 + $1.total }
        subtotal = itemSubtotal
        // Invoice-level percents apply to the line-item subtotal; tax applies
        // after the discount (S-021 semantics — mirrors saveInvoice in the form).
        let taxable = itemSubtotal - (itemSubtotal * Decimal(discount) / 100)
        total = (taxable + (taxable * Decimal(tax) / 100)).roundedCents
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

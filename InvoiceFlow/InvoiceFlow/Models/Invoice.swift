import Foundation
import SwiftData

@Model
final class Invoice {
    var id: UUID
    var invoiceNumber: String
    var invoiceType: String
    var subtotal: Double
    var discount: Double
    var tax: Double
    var total: Double
    var balanceDue: Double
    var notes: String?
    var issueDate: Date
    var dueDate: Date?
    var createdAt: Date
    var updatedAt: Date

    @Relationship(deleteRule: .cascade, inverse: \InvoiceLineItem.invoice)
    var lineItems: [InvoiceLineItem]?

    var client: Client?

    init(
        id: UUID = UUID(),
        invoiceNumber: String = "",
        invoiceType: String = "invoice",
        subtotal: Double = 0,
        discount: Double = 0,
        tax: Double = 0,
        total: Double = 0,
        balanceDue: Double = 0,
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

    func recalculate() {
        let items = lineItems ?? []
        subtotal = items.reduce(0) { $0 + $1.total }
        let discountTotal = items.reduce(0) { $0 + ($1.total * $1.discount / 100) }
        let taxTotal = items.reduce(0) { $0 + ($1.total * $1.tax / 100) }
        total = subtotal - discountTotal + taxTotal
        balanceDue = total
        updatedAt = Date()
    }
}

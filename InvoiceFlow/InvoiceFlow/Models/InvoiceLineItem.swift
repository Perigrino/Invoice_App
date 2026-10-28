import Foundation
import SwiftData

@Model
final class InvoiceLineItem {
    var id: UUID
    var itemDescription: String
    var price: Decimal
    var quantity: Double
    var discount: Double
    var tax: Double
    var total: Decimal
    var sortOrder: Int

    var invoice: Invoice?

    init(
        id: UUID = UUID(),
        itemDescription: String = "",
        price: Decimal = .zero,
        quantity: Double = 1,
        discount: Double = 0,
        tax: Double = 0,
        total: Decimal = .zero,
        sortOrder: Int = 0
    ) {
        self.id = id
        self.itemDescription = itemDescription
        self.price = price
        self.quantity = quantity
        self.discount = discount
        self.tax = tax
        self.total = total
        self.sortOrder = sortOrder
        recalculate()
    }

    /// Line total = price × quantity, less the line's discount percent,
    /// plus the line's tax percent. Rounded to cents.
    func recalculate() {
        let lineTotal = price * Decimal(quantity)
        let discountAmount = lineTotal * Decimal(discount) / 100
        let afterDiscount = lineTotal - discountAmount
        let taxAmount = afterDiscount * Decimal(tax) / 100
        total = (afterDiscount + taxAmount).roundedCents
    }
}

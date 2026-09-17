import Foundation
import SwiftData

@Model
final class InvoiceLineItem {
    var id: UUID
    var itemDescription: String
    var price: Double
    var quantity: Double
    var discount: Double
    var tax: Double
    var total: Double
    var sortOrder: Int

    var invoice: Invoice?

    init(
        id: UUID = UUID(),
        itemDescription: String = "",
        price: Double = 0,
        quantity: Double = 1,
        discount: Double = 0,
        tax: Double = 0,
        total: Double = 0,
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

    func recalculate() {
        let lineTotal = price * quantity
        let discountAmount = lineTotal * discount / 100
        let afterDiscount = lineTotal - discountAmount
        let taxAmount = afterDiscount * tax / 100
        total = afterDiscount + taxAmount
    }
}

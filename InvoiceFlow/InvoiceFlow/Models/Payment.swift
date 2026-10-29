import Foundation
import SwiftData

/// A money-in record against one invoice. `Invoice.balanceDue` is always
/// `total − Σ payments` (never negative) — there is no stored "paid" flag.
@Model
final class Payment {
    var id: UUID
    var amount: Decimal
    var date: Date
    /// Free-form label for now ("Cash", "Bank Transfer", …); dropdown values
    /// are UI-level, not schema-level.
    var method: String
    var notes: String?

    var invoice: Invoice?

    init(
        id: UUID = UUID(),
        amount: Decimal = .zero,
        date: Date = Date(),
        method: String = "Bank Transfer",
        notes: String? = nil
    ) {
        self.id = id
        self.amount = amount
        self.date = date
        self.method = method
        self.notes = notes
    }
}

import Foundation

/// Invoicing-grade arithmetic for `Decimal`: money is rounded to cents with
/// half-away-from-zero ties (the convention invoice subtotal math uses) so
/// `recalculate()` and the form's preview totals agree to the cent.
extension Decimal {
    /// The cent-increment handler: `.plain` rounds to nearest on ties away
    /// from zero, at a fixed scale of 2.
    private static let centsHandler = NSDecimalNumberHandler(
        roundingMode: .plain,
        scale: 2,
        raiseOnExactness: false,
        raiseOnOverflow: false,
        raiseOnUnderflow: false,
        raiseOnDivideByZero: false
    )

    /// Rounds money to two decimal places, ties away from zero.
    var roundedCents: Decimal {
        NSDecimalNumber(decimal: self)
            .rounding(accordingToBehavior: Self.centsHandler)
            .decimalValue
    }

    /// Percentage conversion used by percent-of-money math: percent operands
    /// stay `Double` in the models, so `Decimal(value)` is the join point.
    static func percent(_ value: Double) -> Decimal {
        Decimal(value)
    }

    /// `value / 100` as a `Decimal`, for percent math on money amounts.
    static func fraction(ofPercent value: Double) -> Decimal {
        Decimal(value) / 100
    }
}

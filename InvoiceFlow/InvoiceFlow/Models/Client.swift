import Foundation
import SwiftData

@Model
final class Client {
    var id: UUID
    var fullName: String
    var company: String?
    var email: String?
    var phone: String?
    var address: String?
    var createdAt: Date
    var updatedAt: Date

    @Relationship(deleteRule: .nullify, inverse: \Invoice.client)
    var invoices: [Invoice]?

    init(
        id: UUID = UUID(),
        fullName: String = "",
        company: String? = nil,
        email: String? = nil,
        phone: String? = nil,
        address: String? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.fullName = fullName
        self.company = company
        self.email = email
        self.phone = phone
        self.address = address
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

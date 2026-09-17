import Foundation
import SwiftData

@Model
final class Company {
    var id: UUID
    var name: String?
    var logoData: Data?
    var address: String?
    var email: String?
    var phone: String?
    var website: String?

    init(
        id: UUID = UUID(),
        name: String? = nil,
        logoData: Data? = nil,
        address: String? = nil,
        email: String? = nil,
        phone: String? = nil,
        website: String? = nil
    ) {
        self.id = id
        self.name = name
        self.logoData = logoData
        self.address = address
        self.email = email
        self.phone = phone
        self.website = website
    }
}

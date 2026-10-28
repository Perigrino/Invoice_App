import Foundation
import SwiftData

/// Schema version 1 — the shipped 0.2.0 layout, with every money field as
/// `Double`. The definitions must stay byte-for-byte identical to the old
/// models (same property names, types, and relationship rules) so the legacy
/// store files keep their stored hashes and open unmodified. Used only by
/// `StoreMigrator` to read pre-Decimal stores; new code never touches these
/// classes.
///
/// See `docs/research/platform.md` and `docs/STORIES.md` S-001 for why this
/// is a staged file conversion rather than a `SwiftData` migration stage:
/// `.custom` stages cannot read a `Double` column into a `Decimal` property
/// without loss, and the 0.2.0 store predates any versioned schema plan.
enum SchemaV1 {
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

        @Relationship(deleteRule: .cascade, inverse: \SchemaV1.InvoiceLineItem.invoice)
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
    }

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
        }
    }

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

        @Relationship(deleteRule: .nullify, inverse: \SchemaV1.Invoice.client)
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

    @Model
    final class Setting {
        var id: UUID
        var profileName: String
        var currency: String
        var separator: String
        var decimalPlaces: Int
        var signPlacement: String
        var dateFormat: String
        var template: String
        var paperSize: String
        var pdfAccentColor: String
        var pdfSecondaryColor: String
        var notes: String
        var showInvoiceId: Bool
        var showDueDate: Bool
        var showCurrency: Bool
        var showDiscount: Bool
        var showTax: Bool
        var showNote: Bool
        var language: String
        var darkMode: Bool
        var isActive: Bool
        var logoData: Data?
        var companyName: String?
        var companyEmail: String?
        var companyPhone: String?
        var companyAddress: String?
        var companyWebsite: String?
        var exportPath: String?

        init(
            id: UUID = UUID(),
            profileName: String = "Default",
            currency: String = "USD",
            separator: String = "comma",
            decimalPlaces: Int = 2,
            signPlacement: String = "before",
            dateFormat: String = "MM/DD/YYYY",
            template: String = "modern",
            paperSize: String = "A4",
            pdfAccentColor: String = "#1E3A5F",
            pdfSecondaryColor: String = "#059669",
            notes: String = "Thank you for your business!",
            showInvoiceId: Bool = true,
            showDueDate: Bool = true,
            showCurrency: Bool = true,
            showDiscount: Bool = true,
            showTax: Bool = true,
            showNote: Bool = true,
            language: String = "en",
            darkMode: Bool = true,
            isActive: Bool = true,
            logoData: Data? = nil,
            companyName: String? = nil,
            companyEmail: String? = nil,
            companyPhone: String? = nil,
            companyAddress: String? = nil,
            companyWebsite: String? = nil,
            exportPath: String? = nil
        ) {
            self.id = id
            self.profileName = profileName
            self.currency = currency
            self.separator = separator
            self.decimalPlaces = decimalPlaces
            self.signPlacement = signPlacement
            self.dateFormat = dateFormat
            self.template = template
            self.paperSize = paperSize
            self.pdfAccentColor = pdfAccentColor
            self.pdfSecondaryColor = pdfSecondaryColor
            self.notes = notes
            self.showInvoiceId = showInvoiceId
            self.showDueDate = showDueDate
            self.showCurrency = showCurrency
            self.showDiscount = showDiscount
            self.showTax = showTax
            self.showNote = showNote
            self.language = language
            self.darkMode = darkMode
            self.isActive = isActive
            self.logoData = logoData
            self.companyName = companyName
            self.companyEmail = companyEmail
            self.companyPhone = companyPhone
            self.companyAddress = companyAddress
            self.companyWebsite = companyWebsite
            self.exportPath = exportPath
        }
    }
}

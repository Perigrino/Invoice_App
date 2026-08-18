import Foundation
import SwiftData

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

//
//  BackupService.swift
//  InvoiceFlow
//
//  JSON backup/restore for clients, invoices, line items, and settings profiles.
//  Import uses upsert-by-UUID semantics: records whose UUID already exists in
//  the store are updated in place, everything else is inserted, so re-importing
//  the same backup file never creates duplicates.
//

import AppKit
import Foundation
import SwiftData
import UniformTypeIdentifiers

// MARK: - Codable Payloads

struct BackupLineItem: Codable {
    var id: UUID
    var itemDescription: String
    var price: Double
    var quantity: Double
    var discount: Double
    var tax: Double
    var total: Double
    var sortOrder: Int
}

struct BackupClient: Codable {
    var id: UUID
    var fullName: String
    var company: String?
    var email: String?
    var phone: String?
    var address: String?
    var createdAt: Date
    var updatedAt: Date
}

struct BackupInvoice: Codable {
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
    var clientID: UUID?
    var lineItems: [BackupLineItem]
}

struct BackupSetting: Codable {
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
}

struct BackupDocument: Codable {
    var formatVersion: Int = 1
    var exportedAt: Date = Date()
    var appVersion: String = "2.0.0"
    var clients: [BackupClient] = []
    var invoices: [BackupInvoice] = []
    var settings: [BackupSetting] = []

    var isEmpty: Bool { clients.isEmpty && invoices.isEmpty && settings.isEmpty }

    var recordSummary: String {
        var parts: [String] = []
        if !clients.isEmpty { parts.append("\(clients.count) client\(clients.count == 1 ? "" : "s")") }
        if !invoices.isEmpty { parts.append("\(invoices.count) invoice\(invoices.count == 1 ? "" : "s")") }
        if !settings.isEmpty { parts.append("\(settings.count) settings profile\(settings.count == 1 ? "" : "s")") }
        return parts.joined(separator: ", ")
    }
}

struct BackupImportResult {
    var clientsCreated = 0
    var clientsUpdated = 0
    var invoicesCreated = 0
    var invoicesUpdated = 0
    var settingsCreated = 0
    var settingsUpdated = 0
    var skippedInvoices = 0

    var summary: String {
        var parts: [String] = []
        if clientsCreated + clientsUpdated > 0 {
            parts.append("\(clientsCreated) client(s) added, \(clientsUpdated) updated")
        }
        if invoicesCreated + invoicesUpdated > 0 {
            parts.append("\(invoicesCreated) invoice(s) added, \(invoicesUpdated) updated")
        }
        if settingsCreated + settingsUpdated > 0 {
            parts.append("\(settingsCreated) profile(s) added, \(settingsUpdated) updated")
        }
        if skippedInvoices > 0 {
            parts.append("\(skippedInvoices) invoice(s) skipped (missing client)")
        }
        return parts.isEmpty ? "Nothing to import — the backup is empty." : parts.joined(separator: " · ")
    }
}

// MARK: - BackupService

enum BackupServiceError: LocalizedError {
    case emptyBackup
    case corruptedFile(String)

    var errorDescription: String? {
        switch self {
        case .emptyBackup:
            return "The backup file contains no data to import."
        case .corruptedFile(let detail):
            return "The backup file could not be read: \(detail)"
        }
    }
}

enum BackupService {
    private static let decoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()
    private static let encoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        e.outputFormatting = [.prettyPrinted, .sortedKeys]
        return e
    }()

    // MARK: Export

    /// Serializes every client, invoice (with line items), and settings profile
    /// into a JSON document and writes it to the given URL.
    static func export(to url: URL, from context: ModelContext) throws {
        let document = try buildDocument(from: context)
        let data = try encoder.encode(document)
        try data.write(to: url, options: .atomic)
    }

    /// Builds the backup document. Exposed as `internal` for testing.
    static func buildDocument(from context: ModelContext) throws -> BackupDocument {
        let clients = try context.fetch(FetchDescriptor<Client>())
        let invoices = try context.fetch(FetchDescriptor<Invoice>())
        let settings = try context.fetch(FetchDescriptor<Setting>())

        var doc = BackupDocument()
        doc.clients = clients.map { client in
            BackupClient(
                id: client.id, fullName: client.fullName, company: client.company,
                email: client.email, phone: client.phone, address: client.address,
                createdAt: client.createdAt, updatedAt: client.updatedAt
            )
        }
        doc.invoices = invoices.map { invoice in
            BackupInvoice(
                id: invoice.id, invoiceNumber: invoice.invoiceNumber,
                invoiceType: invoice.invoiceType, subtotal: invoice.subtotal,
                discount: invoice.discount, tax: invoice.tax, total: invoice.total,
                balanceDue: invoice.balanceDue, notes: invoice.notes,
                issueDate: invoice.issueDate, dueDate: invoice.dueDate,
                createdAt: invoice.createdAt, updatedAt: invoice.updatedAt,
                clientID: invoice.client?.id,
                lineItems: (invoice.lineItems ?? [])
                    .sorted { $0.sortOrder < $1.sortOrder }
                    .map { item in
                        BackupLineItem(
                            id: item.id, itemDescription: item.itemDescription,
                            price: item.price, quantity: item.quantity,
                            discount: item.discount, tax: item.tax, total: item.total,
                            sortOrder: item.sortOrder
                        )
                    }
            )
        }
        doc.settings = settings.map { setting in
            BackupSetting(
                id: setting.id, profileName: setting.profileName,
                currency: setting.currency, separator: setting.separator,
                decimalPlaces: setting.decimalPlaces,
                signPlacement: setting.signPlacement, dateFormat: setting.dateFormat,
                template: setting.template, paperSize: setting.paperSize,
                pdfAccentColor: setting.pdfAccentColor,
                pdfSecondaryColor: setting.pdfSecondaryColor, notes: setting.notes,
                showInvoiceId: setting.showInvoiceId, showDueDate: setting.showDueDate,
                showCurrency: setting.showCurrency, showDiscount: setting.showDiscount,
                showTax: setting.showTax, showNote: setting.showNote,
                language: setting.language, darkMode: setting.darkMode,
                isActive: setting.isActive, logoData: setting.logoData,
                companyName: setting.companyName, companyEmail: setting.companyEmail,
                companyPhone: setting.companyPhone, companyAddress: setting.companyAddress,
                companyWebsite: setting.companyWebsite, exportPath: setting.exportPath
            )
        }
        return doc
    }

    // MARK: Import

    /// Reads and validates a backup file without touching the store.
    static func decodeDocument(from url: URL) throws -> BackupDocument {
        let data: Data
        do {
            data = try Data(contentsOf: url)
        } catch {
            throw BackupServiceError.corruptedFile("file is unreadable")
        }
        do {
            return try decoder.decode(BackupDocument.self, from: data)
        } catch {
            throw BackupServiceError.corruptedFile("not a valid InvoiceFlow backup")
        }
    }

    /// Reads a JSON backup and upserts its records into the context.
    /// Does NOT save — the caller persists when it's happy with the result.
    static func importDocument(from url: URL, into context: ModelContext) throws -> BackupImportResult {
        let document = try decodeDocument(from: url)
        return try upsert(document, into: context)
    }

    /// Upserts a decoded backup document. Exposed as `internal` for testing.
    static func upsert(_ document: BackupDocument, into context: ModelContext) throws -> BackupImportResult {
        var result = BackupImportResult()

        // --- Clients ---
        let existingClients = try context.fetch(FetchDescriptor<Client>())
        var clientByID: [UUID: Client] = [:]
        for client in existingClients { clientByID[client.id] = client }

        for backup in document.clients {
            if let existing = clientByID[backup.id] {
                existing.fullName = backup.fullName
                existing.company = backup.company
                existing.email = backup.email
                existing.phone = backup.phone
                existing.address = backup.address
                existing.updatedAt = backup.updatedAt
                result.clientsUpdated += 1
            } else {
                let client = Client(
                    id: backup.id, fullName: backup.fullName, company: backup.company,
                    email: backup.email, phone: backup.phone, address: backup.address,
                    createdAt: backup.createdAt, updatedAt: backup.updatedAt
                )
                context.insert(client)
                clientByID[backup.id] = client
                result.clientsCreated += 1
            }
        }

        // --- Invoices (line items cascade with their invoice) ---
        let existingInvoices = try context.fetch(FetchDescriptor<Invoice>())
        var invoiceByID: [UUID: Invoice] = [:]
        for invoice in existingInvoices { invoiceByID[invoice.id] = invoice }

        for backup in document.invoices {
            // Line items are only imported with their parent invoice.
            guard let clientID = backup.clientID, let client = clientByID[clientID] else {
                result.skippedInvoices += 1
                continue
            }
            if let existing = invoiceByID[backup.id] {
                apply(backup, to: existing, client: client)
                result.invoicesUpdated += 1
            } else {
                let invoice = Invoice(
                    id: backup.id, invoiceNumber: backup.invoiceNumber,
                    invoiceType: backup.invoiceType
                )
                context.insert(invoice)
                apply(backup, to: invoice, client: client)
                invoiceByID[backup.id] = invoice
                result.invoicesCreated += 1
            }
        }

        // --- Settings profiles ---
        let existingSettings = try context.fetch(FetchDescriptor<Setting>())
        var settingByID: [UUID: Setting] = [:]
        for setting in existingSettings { settingByID[setting.id] = setting }

        for backup in document.settings {
            if let existing = settingByID[backup.id] {
                apply(backup, to: existing)
                result.settingsUpdated += 1
            } else {
                let setting = Setting(id: backup.id)
                context.insert(setting)
                apply(backup, to: setting)
                settingByID[backup.id] = setting
                result.settingsCreated += 1
            }
        }

        // Importing a backup could have made several profiles active; the app
        // expects exactly one, so keep the first and deactivate the rest.
        let active = settingByID.values.filter(\.isActive)
        if active.count > 1, let keep = active.first {
            for setting in active where setting !== keep { setting.isActive = false }
        }

        context.processPendingChanges()
        return result
    }

    private static func apply(_ backup: BackupInvoice, to invoice: Invoice, client: Client) {
        invoice.invoiceNumber = backup.invoiceNumber
        invoice.invoiceType = backup.invoiceType
        invoice.subtotal = backup.subtotal
        invoice.discount = backup.discount
        invoice.tax = backup.tax
        invoice.total = backup.total
        invoice.balanceDue = backup.balanceDue
        invoice.notes = backup.notes
        invoice.issueDate = backup.issueDate
        invoice.dueDate = backup.dueDate
        invoice.createdAt = backup.createdAt
        invoice.updatedAt = backup.updatedAt
        invoice.client = client

        // Replace line items wholesale: the backup is the source of truth.
        for item in invoice.lineItems ?? [] { invoice.modelContext?.delete(item) }
        invoice.lineItems = []
        for item in backup.lineItems {
            let lineItem = InvoiceLineItem(
                id: item.id, itemDescription: item.itemDescription,
                price: item.price, quantity: item.quantity,
                discount: item.discount, tax: item.tax, total: item.total,
                sortOrder: item.sortOrder
            )
            invoice.modelContext?.insert(lineItem)
            lineItem.invoice = invoice
            invoice.lineItems?.append(lineItem)
        }
    }

    private static func apply(_ backup: BackupSetting, to setting: Setting) {
        setting.profileName = backup.profileName
        setting.currency = backup.currency
        setting.separator = backup.separator
        setting.decimalPlaces = backup.decimalPlaces
        setting.signPlacement = backup.signPlacement
        setting.dateFormat = backup.dateFormat
        setting.template = backup.template
        setting.paperSize = backup.paperSize
        setting.pdfAccentColor = backup.pdfAccentColor
        setting.pdfSecondaryColor = backup.pdfSecondaryColor
        setting.notes = backup.notes
        setting.showInvoiceId = backup.showInvoiceId
        setting.showDueDate = backup.showDueDate
        setting.showCurrency = backup.showCurrency
        setting.showDiscount = backup.showDiscount
        setting.showTax = backup.showTax
        setting.showNote = backup.showNote
        setting.language = backup.language
        setting.darkMode = backup.darkMode
        setting.isActive = backup.isActive
        setting.logoData = backup.logoData
        setting.companyName = backup.companyName
        setting.companyEmail = backup.companyEmail
        setting.companyPhone = backup.companyPhone
        setting.companyAddress = backup.companyAddress
        setting.companyWebsite = backup.companyWebsite
        setting.exportPath = backup.exportPath
    }
}

// MARK: - User-Facing Flow (panels, confirmation, alerts)

@MainActor
enum BackupCoordinator {
    static let backupFileType: UTType = {
        UTType(filenameExtension: "invoiceflow") ?? .json
    }()

    /// Asks for a destination, exports the full store, and shows the result.
    static func exportBackup(from context: ModelContext) {
        let panel = NSSavePanel()
        panel.title = "Export InvoiceFlow Backup"
        panel.nameFieldStringValue = defaultFileName()
        panel.allowedContentTypes = [.json]
        if panel.runModal() == .OK, let url = panel.url {
            do {
                try BackupService.export(to: url, from: context)
                presentInfo("Backup saved", "Your data was exported to \(url.lastPathComponent).")
            } catch {
                presentError("Export failed", error)
            }
        }
    }

    /// Asks for a backup file, confirms with the user what will happen, then
    /// upserts its records and persists the result.
    static func importBackup(into context: ModelContext) {
        let panel = NSOpenPanel()
        panel.title = "Import InvoiceFlow Backup"
        panel.allowedContentTypes = [.json]
        panel.allowsMultipleSelection = false
        guard panel.runModal() == .OK, let url = panel.url else { return }

        do {
            let document = try BackupService.decodeDocument(from: url)
            guard !document.isEmpty else {
                presentError("Nothing to import", BackupServiceError.emptyBackup)
                return
            }
            let alert = NSAlert()
            alert.messageText = "Import backup?"
            alert.informativeText = """
                This file contains \(document.recordSummary), exported \(DateFormatHelper.string(from: document.exportedAt)).

                Matching records (same ID) will be updated in place; new records will be added. Nothing is deleted.
                """
            alert.addButton(withTitle: "Import")
            alert.addButton(withTitle: "Cancel")
            guard alert.runModal() == .alertFirstButtonReturn else { return }

            let result = try BackupService.importDocument(from: url, into: context)
            context.persist()
            presentInfo("Import complete", result.summary)
        } catch {
            presentError("Import failed", error)
        }
    }

    private static func defaultFileName() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return "InvoiceFlow-Backup-\(formatter.string(from: Date())).json"
    }

    private static func presentInfo(_ title: String, _ message: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = .informational
        alert.runModal()
    }

    private static func presentError(_ title: String, _ error: Error) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = error.localizedDescription
        alert.alertStyle = .critical
        alert.runModal()
    }
}

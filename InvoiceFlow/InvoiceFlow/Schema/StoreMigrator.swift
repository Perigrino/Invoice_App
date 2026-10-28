import Foundation
import SwiftData

/// Staged file conversion from the 0.2.0 schema (`SchemaV1`, money as
/// `Double`) to the current schema (money as `Decimal`).
///
/// SwiftData migration stages cannot rewrite a `Double` column into a
/// `Decimal` property (they are mapped across types without value scaling),
/// so the conversion is done the MoneyWorks way: open the old document, copy
/// every record into a fresh store, then swap the files. The old trio is
/// moved aside first so a failure mid-copy can roll back to the original.
///
/// Progress is tracked with a `store-version.json` marker next to the store;
/// without it there is no way to tell a pre-Decimal store from a migrated one
/// (SwiftData version hashes change for external reasons too).
@MainActor
enum StoreMigrator {
    private static let markerName = "store-version.json"
    /// The current schema marker version. Bump when a future migration lands.
    static let currentVersion = 2

    struct Marker: Codable {
        var schemaVersion: Int
    }

    static func markerURL(for storeURL: URL) -> URL {
        storeURL.deletingLastPathComponent().appendingPathComponent(markerName)
    }

    /// Migrates the store at `storeURL` in place if it predates
    /// `currentVersion`. Returns true when a conversion was performed.
    @discardableResult
    static func migrateIfNeeded(storeURL: URL) -> Bool {
        let fileManager = FileManager.default
        do {
            // Downgrading: pre-Decimal snapshots restored on top of a newer
            // install need the rerun, so a fresh marker with the old version
            // is written by the caller before this check.
            let version = readMarker(storeURL: storeURL) ?? 1
            let hasStore = fileManager.fileExists(atPath: storeURL.path)
            if version >= currentVersion {
                return false
            }
            if !hasStore {
                // Brand-new store — nothing to convert, mark it current.
                writeMarker(storeURL: storeURL, version: currentVersion)
                return false
            }
            return try migrateDoubleStoreToDecimal(storeURL: storeURL)
        } catch {
            // A failed migration leaves the store untouched; the app will
            // still open it and SwiftData's automatic migration is the
            // fallback of last resort.
            NSLog("StoreMigrator: migration failed: \(error)")
            return false
        }
    }

    static func readMarker(storeURL: URL) -> Int? {
        let url = markerURL(for: storeURL)
        guard let data = try? Data(contentsOf: url),
              let marker = try? JSONDecoder().decode(Marker.self, from: data)
        else { return nil }
        return marker.schemaVersion
    }

    static func writeMarker(storeURL: URL, version: Int) {
        let url = markerURL(for: storeURL)
        do {
            let data = try JSONEncoder().encode(Marker(schemaVersion: version))
            try data.write(to: url, options: .atomic)
        } catch {
            NSLog("StoreMigrator: failed to write version marker: \(error)")
        }
    }

    /// Forced rerecord — used when a pre-Decimal snapshot is staged in over a
    /// migrated store, so the next `migrateIfNeeded` actually runs.
    static func markUncertain(storeURL: URL) {
        writeMarker(storeURL: storeURL, version: 1)
    }

    // MARK: - Conversion

    private static func migrateDoubleStoreToDecimal(storeURL: URL) throws -> Bool {
        let directory = storeURL.deletingLastPathComponent()
        let legacyURL = storeURL
        let newURL = directory.appendingPathComponent("migration-\(UUID().uuidString).store")

        // 1. Open the legacy document without autosave so nothing writes back.
        let legacyContainer = try ModelContainer(
            for: SchemaV1.Invoice.self,
            SchemaV1.InvoiceLineItem.self,
            SchemaV1.Client.self,
            SchemaV1.Company.self,
            SchemaV1.Setting.self,
            configurations: ModelConfiguration(url: legacyURL)
        )
        let legacyContext = legacyContainer.mainContext
        legacyContext.autosaveEnabled = false

        let legacyClients = try legacyContext.fetch(FetchDescriptor<SchemaV1.Client>())
        let legacyInvoices = try legacyContext.fetch(FetchDescriptor<SchemaV1.Invoice>())
        let legacyCompanies = try legacyContext.fetch(FetchDescriptor<SchemaV1.Company>())
        let legacySettings = try legacyContext.fetch(FetchDescriptor<SchemaV1.Setting>())

        // 2. Build the Decimal-era store alongside it.
        let newContainer = try ModelContainer(
            for: Invoice.self,
            InvoiceLineItem.self,
            Client.self,
            Company.self,
            Setting.self,
            configurations: ModelConfiguration(url: newURL)
        )
        let newContext = newContainer.mainContext
        newContext.autosaveEnabled = false

        var clientMap: [UUID: Client] = [:]
        try newContext.transaction {
            for oldClient in legacyClients {
                let client = Client(
                    id: oldClient.id,
                    fullName: oldClient.fullName,
                    company: oldClient.company,
                    email: oldClient.email,
                    phone: oldClient.phone,
                    address: oldClient.address,
                    createdAt: oldClient.createdAt,
                    updatedAt: oldClient.updatedAt
                )
                newContext.insert(client)
                clientMap[client.id] = client
            }

            for oldInvoice in legacyInvoices {
                let invoice = Invoice(
                    id: oldInvoice.id,
                    invoiceNumber: oldInvoice.invoiceNumber,
                    invoiceType: oldInvoice.invoiceType,
                    subtotal: Decimal(oldInvoice.subtotal).roundedCents,
                    discount: oldInvoice.discount,
                    tax: oldInvoice.tax,
                    total: Decimal(oldInvoice.total).roundedCents,
                    balanceDue: Decimal(oldInvoice.balanceDue).roundedCents,
                    notes: oldInvoice.notes,
                    issueDate: oldInvoice.issueDate,
                    dueDate: oldInvoice.dueDate,
                    createdAt: oldInvoice.createdAt,
                    updatedAt: oldInvoice.updatedAt
                )
                newContext.insert(invoice)

                let lineItems = (oldInvoice.lineItems ?? [])
                    .sorted { $0.sortOrder < $1.sortOrder }
                    .map { oldItem in
                        InvoiceLineItem(
                            id: oldItem.id,
                            itemDescription: oldItem.itemDescription,
                            price: Decimal(oldItem.price).roundedCents,
                            quantity: oldItem.quantity,
                            discount: oldItem.discount,
                            tax: oldItem.tax,
                            total: Decimal(oldItem.total).roundedCents,
                            sortOrder: oldItem.sortOrder
                        )
                    }
                if !lineItems.isEmpty {
                    invoice.lineItems = lineItems
                    for item in lineItems {
                        newContext.insert(item)
                        item.invoice = invoice
                    }
                }
                if let oldClient = oldInvoice.client {
                    invoice.client = clientMap[oldClient.id]
                }
            }

            for oldCompany in legacyCompanies {
                newContext.insert(Company(
                    id: oldCompany.id,
                    name: oldCompany.name,
                    logoData: oldCompany.logoData,
                    address: oldCompany.address,
                    email: oldCompany.email,
                    phone: oldCompany.phone,
                    website: oldCompany.website
                ))
            }

            for oldSetting in legacySettings {
                newContext.insert(Setting(
                    id: oldSetting.id,
                    profileName: oldSetting.profileName,
                    currency: oldSetting.currency,
                    separator: oldSetting.separator,
                    decimalPlaces: oldSetting.decimalPlaces,
                    signPlacement: oldSetting.signPlacement,
                    dateFormat: oldSetting.dateFormat,
                    template: oldSetting.template,
                    paperSize: oldSetting.paperSize,
                    pdfAccentColor: oldSetting.pdfAccentColor,
                    pdfSecondaryColor: oldSetting.pdfSecondaryColor,
                    notes: oldSetting.notes,
                    showInvoiceId: oldSetting.showInvoiceId,
                    showDueDate: oldSetting.showDueDate,
                    showCurrency: oldSetting.showCurrency,
                    showDiscount: oldSetting.showDiscount,
                    showTax: oldSetting.showTax,
                    showNote: oldSetting.showNote,
                    language: oldSetting.language,
                    darkMode: oldSetting.darkMode,
                    isActive: oldSetting.isActive,
                    logoData: oldSetting.logoData,
                    companyName: oldSetting.companyName,
                    companyEmail: oldSetting.companyEmail,
                    companyPhone: oldSetting.companyPhone,
                    companyAddress: oldSetting.companyAddress,
                    companyWebsite: oldSetting.companyWebsite,
                    exportPath: oldSetting.exportPath
                ))
            }
        }
        try newContext.save()

        // 3. Swap the files. The old trio moves aside first; if anything
        // fails mid-swap the original comes back.
        try swapStoreFiles(oldTrioAt: legacyURL, newTrioAt: newURL)

        writeMarker(storeURL: storeURL, version: currentVersion)
        return true
    }

    // MARK: - File shuffling

    static func storeTrio(_ url: URL) -> [URL] {
        [
            url,
            URL(fileURLWithPath: url.path + "-wal"),
            URL(fileURLWithPath: url.path + "-shm"),
        ]
        .filter { FileManager.default.fileExists(atPath: $0.path) }
    }

    /// Moves the old store trio into `<dir>/.pre-migration-<uuid>` and moves
    /// the new trio into the old location. On failure under `setAside` the
    /// original is restored and the error is rethrown.
    private static func swapStoreFiles(oldTrioAt oldURL: URL, newTrioAt newURL: URL) throws {
        let fileManager = FileManager.default
        let directory = oldURL.deletingLastPathComponent()
        let setAside = directory.appendingPathComponent(".pre-migration-\(UUID().uuidString)")

        try fileManager.createDirectory(at: setAside, withIntermediateDirectories: true)
        do {
            for fileURL in storeTrio(oldURL) {
                let destination = setAside.appendingPathComponent(fileURL.lastPathComponent)
                try fileManager.moveItem(at: fileURL, to: destination)
            }
            for fileURL in storeTrio(newURL) {
                let destination = directory.appendingPathComponent(fileURL.lastPathComponent)
                try fileManager.moveItem(at: fileURL, to: destination)
            }
            // Remove the new trio under its temp name as well (the trio is in
            // a different name pattern, but any temp files left behind are
            // cleaned here).
            if fileManager.fileExists(atPath: newURL.path) {
                try? fileManager.removeItem(at: newURL)
            }
        } catch {
            // Rollback: bring the original files back.
            for fileURL in storeTrio(setAside.appendingPathComponent(oldURL.lastPathComponent)) {
                let destination = directory.appendingPathComponent(fileURL.lastPathComponent)
                if !fileManager.fileExists(atPath: destination.path) {
                    try? fileManager.moveItem(at: fileURL, to: destination)
                }
            }
            try? fileManager.removeItem(at: setAside)
            throw error
        }
        // Success: discard the pristinely-moved old trio.
        try? fileManager.removeItem(at: setAside)
    }
}

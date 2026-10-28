import XCTest
import SwiftData
@testable import InvoiceFlow

/// S-001: the staged conversion from the 0.2.0 Double-money schema.
/// Builds a legacy store exactly the way 0.2.0 wrote it (SchemaV1 classes),
/// runs the migrator, and asserts the reopened store carries cent-exact
/// Decimal values for every money field, across all record types.
///
/// The test keeps SchemaV1 usage inside an autoreleasepool with no live-model
/// container open at the same time: entity names are shared between the
/// legacy and current classes by design, so the two must never be open
/// simultaneously (see StoreMigrator's header).
final class MigrationTests: XCTestCase {

    private var workDir: URL!

    override func setUpWithError() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("invoiceflow-migration-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        workDir = dir
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: workDir)
    }

    private var storeURL: URL {
        workDir.appendingPathComponent("InvoiceFlow.store")
    }

    private func d(_ string: String) -> Decimal {
        Decimal(string: string) ?? .zero
    }

    /// Writes a v1 store the way the 0.2.0 app would have left it: line
    /// totals carry per-line tax, invoice totals carry the percent fields
    /// stacked on top (v1 semantics, verbatim), unrounded because Double.
    private func makeLegacyFixture() throws {
        try autoreleasepool {
            let container = try ModelContainer(
                for: SchemaV1.Invoice.self,
                SchemaV1.InvoiceLineItem.self,
                SchemaV1.Client.self,
                SchemaV1.Company.self,
                SchemaV1.Setting.self,
                configurations: ModelConfiguration(url: storeURL)
            )
            // A fresh background-style context: the fixture runs inside an
            // autoreleasepool on a nonisolated path, so avoid mainContext.
            let context = ModelContext(container)
            context.autosaveEnabled = false
            try context.transaction {
                let client = SchemaV1.Client(fullName: "Ada Lovelace")
                context.insert(client)

                let company = SchemaV1.Company(name: "Lagoon")
                context.insert(company)

                let setting = SchemaV1.Setting(profileName: "Default")
                context.insert(setting)

                let line = SchemaV1.InvoiceLineItem(
                    itemDescription: "Brand identity",
                    price: 33.335,
                    quantity: 3,
                    discount: 5,
                    tax: 7.5,
                    sortOrder: 0
                )
                // v1 recalculate(), verbatim.
                let lineTotal = line.price * line.quantity
                let disc = lineTotal * line.discount / 100
                let afterDisc = lineTotal - disc
                line.total = afterDisc + afterDisc * line.tax / 100
                context.insert(line)

                let invoice = SchemaV1.Invoice(
                    invoiceNumber: "INV-00-000001",
                    discount: 10,
                    tax: 5
                )
                context.insert(invoice)
                invoice.lineItems = [line]
                line.invoice = invoice
                invoice.client = client
                let items = [line]
                invoice.subtotal = items.reduce(0) { $0 + $1.total }
                let discountTotal = items.reduce(0) { $0 + ($1.total * $1.discount / 100) }
                let taxTotal = items.reduce(0) { $0 + ($1.total * $1.tax / 100) }
                invoice.total = invoice.subtotal - discountTotal + taxTotal
                invoice.balanceDue = invoice.total
            }
            try context.save()
        }
    }

    @MainActor
    func testFreshStoreGetsMarkerWithoutMigration() throws {
        XCTAssertFalse(FileManager.default.fileExists(atPath: storeURL.path))
        let migrated = StoreMigrator.migrateIfNeeded(storeURL: storeURL)
        XCTAssertFalse(migrated)
        XCTAssertEqual(StoreMigrator.readMarker(storeURL: storeURL), StoreMigrator.currentVersion)
    }

    @MainActor
    func testLegacyFixturePersistsWithSchemaV1Alone() throws {
        try makeLegacyFixture()

        try autoreleasepool {
            let container = try ModelContainer(
                for: SchemaV1.Invoice.self,
                SchemaV1.InvoiceLineItem.self,
                SchemaV1.Client.self,
                SchemaV1.Company.self,
                SchemaV1.Setting.self,
                configurations: ModelConfiguration(url: storeURL)
            )
            let invoices = try container.mainContext.fetch(FetchDescriptor<SchemaV1.Invoice>())
            XCTAssertEqual(invoices.count, 1, "fixture store must contain the seeded invoice")
            let invoice = try XCTUnwrap(invoices.first)
            XCTAssertEqual(invoice.subtotal, 102.13010625, accuracy: 1e-9)
            XCTAssertEqual(invoice.total, 104.68335890625, accuracy: 1e-9)
        }
    }

    @MainActor
    func testMigratesLegacyDoubleStoreToDecimalStore() throws {
        try makeLegacyFixture()

        XCTAssertTrue(
            StoreMigrator.migrateIfNeeded(storeURL: storeURL),
            "the legacy fixture should have been upgraded"
        )

        // A second run is a no-op.
        XCTAssertFalse(StoreMigrator.migrateIfNeeded(storeURL: storeURL))
        XCTAssertEqual(StoreMigrator.readMarker(storeURL: storeURL), StoreMigrator.currentVersion)

        let container = try ModelContainer(
            for: Invoice.self, InvoiceLineItem.self, Client.self, Company.self,
            Setting.self, configurations: ModelConfiguration(url: storeURL)
        )
        let context = container.mainContext
        context.autosaveEnabled = false

        let invoices = try context.fetch(FetchDescriptor<Invoice>())
        XCTAssertEqual(invoices.count, 1)
        let invoice = try XCTUnwrap(invoices.first)

        // Line: 33.335 × 3 = 100.005; −5% = 95.00475; +7.5% = 102.13010625
        // → normalized to the cent. Values survive the Double→Decimal
        // conversion to the cent.
        let line = try XCTUnwrap(invoice.lineItems?.first)
        XCTAssertEqual(line.price, d("33.34"))
        XCTAssertEqual(line.total, d("102.13"))

        // Invoice totals preserve the stored v1 formulas: the percent fields
        // (discount 10, tax 5) applied to the line total —
        // 102.13010625 − 5.1065053125 + 7.65975796875 = 104.68335890625
        // — now cent-exact.
        XCTAssertEqual(invoice.subtotal, d("102.13"))
        XCTAssertEqual(invoice.discount, 10)
        XCTAssertEqual(invoice.tax, 5)
        XCTAssertEqual(invoice.total, d("104.68"))
        XCTAssertEqual(invoice.balanceDue, invoice.total)

        let clients = try context.fetch(FetchDescriptor<Client>())
        XCTAssertEqual(clients.count, 1)
        XCTAssertEqual(clients.first?.fullName, "Ada Lovelace")
        XCTAssertEqual(clients.first?.id, invoice.client?.id)

        let companies = try context.fetch(FetchDescriptor<Company>())
        XCTAssertEqual(companies.first?.name, "Lagoon")

        let settings = try context.fetch(FetchDescriptor<Setting>())
        XCTAssertEqual(settings.count, 1)
        XCTAssertEqual(settings.first?.profileName, "Default")
        XCTAssertEqual(settings.first?.decimalPlaces, 2)
    }

    @MainActor
    func testNormalizationIsIdempotent() throws {
        try makeLegacyFixture()
        XCTAssertTrue(StoreMigrator.migrateIfNeeded(storeURL: storeURL))

        let container = try ModelContainer(
            for: Invoice.self, InvoiceLineItem.self, Client.self, Company.self,
            Setting.self, configurations: ModelConfiguration(url: storeURL)
        )
        let context = container.mainContext
        context.autosaveEnabled = false
        let before = try XCTUnwrap(try context.fetch(FetchDescriptor<Invoice>()).first)

        // Running the normalization again must not change anything.
        StoreMigrator.normalizeMoney(context: context)
        let after = try XCTUnwrap(try context.fetch(FetchDescriptor<Invoice>()).first)
        XCTAssertEqual(after.subtotal, before.subtotal)
        XCTAssertEqual(after.total, before.total)
        XCTAssertEqual(after.balanceDue, before.balanceDue)
        XCTAssertEqual(after.lineItems?.first?.price, before.lineItems?.first?.price)
        XCTAssertEqual(after.lineItems?.first?.total, before.lineItems?.first?.total)
    }
}

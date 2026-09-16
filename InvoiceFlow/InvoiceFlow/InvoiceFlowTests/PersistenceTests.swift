//
//  PersistenceTests.swift
//  InvoiceFlowTests
//
//  Regression tests for the "data vanished on relaunch" bug (P0, 2026-08).
//
//  The original bug: client/invoice mutations relied on SwiftData autosave,
//  which never flushed them, so everything lived only in memory until the app
//  quit. The fix added explicit saves (ModelContext.persist()) plus a
//  save-on-quit hook. These tests pin that contract by simulating an app
//  relaunch: open a file-backed container, mutate, tear the container down
//  completely, reopen the same store file, and verify the data is really there.
//

import XCTest
import SwiftData
@testable import InvoiceFlow

final class PersistenceTests: XCTestCase {

    private var storeURL: URL!
    private var backupURL: URL!

    override func setUpWithError() throws {
        let unique = UUID().uuidString
        storeURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("invoiceflow-tests-\(unique).store")
        backupURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("invoiceflow-tests-\(unique).json")
    }

    override func tearDownWithError() throws {
        for url in [storeURL, backupURL].compactMap({ $0 }) {
            for suffix in ["", "-wal", "-shm"] {
                try? FileManager.default.removeItem(
                    at: URL(fileURLWithPath: url.path + suffix))
            }
        }
        storeURL = nil
        backupURL = nil
    }

    // MARK: - Helpers

    /// Opens a store exactly like a fresh app launch would.
    private func openContainer() throws -> ModelContainer {
        let container = try ModelContainer(
            for: Invoice.self, InvoiceLineItem.self, Client.self, Company.self, Setting.self,
            configurations: ModelConfiguration(url: storeURL)
        )
        return container
    }

    /// A context with autosave disabled, so only explicit saves persist.
    private func makeContext(for container: ModelContainer) -> ModelContext {
        let context = ModelContext(container)
        context.autosaveEnabled = false
        return context
    }

    /// Seeds one client and one invoice (with a line item) through the same
    /// code paths the app uses, saves, then tears the container down — the
    /// equivalent of "create data, quit the app".
    private func seedAndQuit() throws -> (clientID: UUID, invoiceID: UUID) {
        var clientID: UUID!
        var invoiceID: UUID!
        try autoreleasepool {
            let container = try openContainer()
            let context = makeContext(for: container)

            let client = Client(
                fullName: "Ada Lovelace",
                company: "Analytical Engines Ltd",
                email: "ada@example.com"
            )
            context.insert(client)

            let invoice = Invoice(invoiceNumber: "INV-001", notes: "Net 30")
            invoice.client = client
            context.insert(invoice)

            let item = InvoiceLineItem(itemDescription: "Consulting", price: 120, quantity: 3)
            context.insert(item)
            item.invoice = invoice
            invoice.lineItems?.append(item)
            invoice.recalculate()

            context.persist()
            XCTAssertEqual(try context.fetchCount(FetchDescriptor<Client>()), 1)

            clientID = client.id
            invoiceID = invoice.id
        }
        return (clientID, invoiceID)
    }

    func testPersistReportsReadOnlySaveFailureWithoutDiscardingChanges() throws {
        _ = try seedAndQuit()
        try autoreleasepool {
            let container = try openReadOnlyContainer()
            let context = makeContext(for: container)
            let existing = try XCTUnwrap(context.fetch(FetchDescriptor<Client>()).first)
            existing.fullName = "Unrelated pending edit"
            let client = Client(fullName: "Unsaved draft")
            context.insert(client)

            XCTAssertThrowsError(try context.save())
            var errors: [NSError] = []
            XCTAssertFalse(context.persist { errors.append($0 as NSError) })
            XCTAssertEqual(errors.count, 1)
            XCTAssertEqual(errors.first?.domain, NSCocoaErrorDomain)
            XCTAssertEqual(errors.first?.code, NSFileWriteNoPermissionError)
            XCTAssertTrue(context.hasChanges)
            XCTAssertEqual(client.fullName, "Unsaved draft")
            XCTAssertEqual(existing.fullName, "Unrelated pending edit")
        }
    }

    private func openReadOnlyContainer() throws -> ModelContainer {
        try ModelContainer(
            for: Invoice.self, InvoiceLineItem.self, Client.self, Company.self, Setting.self,
            configurations: ModelConfiguration(url: storeURL, allowsSave: false)
        )
    }

    func testPersistReturnsTrueAfterSuccessfulSave() throws {
        try autoreleasepool {
            let container = try openContainer()
            let context = makeContext(for: container)
            context.insert(Client(fullName: "Saved Client"))
            XCTAssertTrue(context.persist())
        }

        try autoreleasepool {
            let container = try openContainer()
            let context = makeContext(for: container)
            XCTAssertEqual(try context.fetchCount(FetchDescriptor<Client>()), 1)
            let client = try XCTUnwrap(context.fetch(FetchDescriptor<Client>()).first)
            XCTAssertEqual(client.fullName, "Saved Client")
        }
    }

    func testPersistWithNoPendingChangesSucceeds() throws {
        try autoreleasepool {
            let container = try openContainer()
            let context = makeContext(for: container)
            XCTAssertTrue(context.persist())
        }
    }

    @MainActor
    func testClientFormRetriesFailedCreateWithoutDuplicates() throws {
        _ = try seedAndQuit()
        try autoreleasepool {
            let container = try openReadOnlyContainer()
            let context = makeContext(for: container)
            let unrelated = try XCTUnwrap(context.fetch(FetchDescriptor<Client>()).first)
            unrelated.phone = "Unrelated edit"
            var pending: Client?
            var errors = 0
            for name in ["Draft name", "Corrected name", "Final name"] {
                XCTAssertFalse(ClientFormView.saveClient(
                    in: context, pending: &pending, fullName: name,
                    company: "Company", email: "draft@example.com", phone: "123", address: "Address",
                    onError: { _ in errors += 1 }
                ))
                XCTAssertEqual(pending?.fullName, name)
                XCTAssertEqual(try context.fetch(FetchDescriptor<Client>()).count, 2)
            }
            XCTAssertEqual(errors, 3)
            XCTAssertEqual(pending?.company, "Company")
            XCTAssertEqual(pending?.email, "draft@example.com")
            XCTAssertEqual(pending?.phone, "123")
            XCTAssertEqual(pending?.address, "Address")
            XCTAssertEqual(unrelated.phone, "Unrelated edit")
        }
        try autoreleasepool {
            let context = makeContext(for: try openContainer())
            XCTAssertEqual(try context.fetch(FetchDescriptor<Client>()).count, 1)
        }
    }

    @MainActor
    func testInvoiceFormRetriesFailedCreateAndEditWithoutDuplicateLineItems() throws {
        _ = try seedAndQuit()
        try autoreleasepool {
            let context = makeContext(for: try openReadOnlyContainer())
            let unrelated = try XCTUnwrap(context.fetch(FetchDescriptor<Client>()).first)
            unrelated.phone = "Unrelated edit"
            let existing = try XCTUnwrap(context.fetch(FetchDescriptor<Invoice>()).first)
            for editing in [false, true] {
                var pending: Invoice? = editing ? existing : nil
                var rows = [LineItemData(itemDescription: "Draft row", price: 20, quantity: 2)]
                var firstItem: InvoiceLineItem?
                var record: Invoice?
                var errors = 0
                for attempt in 0..<3 {
                    rows[0].itemDescription = "Edited row \(attempt)"
                    if attempt == 1 {
                        rows.append(LineItemData(itemDescription: "Temporary row", price: 5))
                    } else if attempt == 2 {
                        rows.removeLast()
                        rows.append(LineItemData(itemDescription: "Final row", price: 10))
                    }
                    XCTAssertFalse(InvoiceFormView.saveInvoice(
                        in: context, pending: &pending, invoiceNumber: "INV-RETRY-\(editing)",
                        invoiceType: "proforma", client: unrelated, issueDate: Date(timeIntervalSince1970: 100),
                        dueDate: Date(timeIntervalSince1970: 200), notes: "Draft notes",
                        discount: 10, taxRate: 5, lineItems: rows, onError: { _ in errors += 1 }
                    ))
                    let invoice = try XCTUnwrap(pending)
                    if attempt == 0 {
                        record = invoice
                        firstItem = invoice.lineItems?.first
                    }
                    XCTAssertTrue(invoice === record)
                    XCTAssertTrue(invoice.lineItems?.contains { $0 === firstItem } == true)
                    XCTAssertEqual(invoice.lineItems?.count, rows.count)
                    XCTAssertEqual(Set(invoice.lineItems?.map(\.id) ?? []), Set(rows.map(\.id)))
                    XCTAssertEqual(invoice.lineItems?.first { $0.id == rows[0].id }?.itemDescription, "Edited row \(attempt)")
                    XCTAssertFalse(invoice.lineItems?.contains { $0.isDeleted } ?? true)
                }
                XCTAssertEqual(errors, 3)
                XCTAssertEqual(pending?.notes, "Draft notes")
                XCTAssertEqual(pending?.invoiceType, "proforma")
                XCTAssertEqual(pending?.subtotal, 50)
                XCTAssertEqual(pending?.total ?? 0, 47.25, accuracy: 0.001)
                XCTAssertEqual(pending?.client?.id, unrelated.id)
                XCTAssertEqual(pending?.dueDate, Date(timeIntervalSince1970: 200))
            }
            XCTAssertEqual(try context.fetch(FetchDescriptor<Invoice>()).count, 2)
            XCTAssertEqual(try context.fetch(FetchDescriptor<InvoiceLineItem>()).filter { !$0.isDeleted }.count, 4)
            XCTAssertEqual(unrelated.phone, "Unrelated edit")
        }
        try autoreleasepool {
            let context = makeContext(for: try openContainer())
            XCTAssertEqual(try context.fetch(FetchDescriptor<Invoice>()).count, 1)
            XCTAssertEqual(try context.fetch(FetchDescriptor<InvoiceLineItem>()).count, 1)
        }
    }

    @MainActor
    func testFailedEditThenCancelRestoresOriginalItemWithoutDeletedFlag() throws {
        _ = try seedAndQuit()
        try autoreleasepool {
            let context = makeContext(for: try openReadOnlyContainer())
            let invoice = try XCTUnwrap(context.fetch(FetchDescriptor<Invoice>()).first)
            let item = try XCTUnwrap(invoice.lineItems?.first)
            let originalItemID = item.id
            let unrelated = Client(fullName: "Unrelated pending insert")
            context.insert(unrelated)
            unrelated.phone = "Unrelated pending edit"
            var pendingInvoice: Invoice? = invoice
            var errors = 0
            let rows = [
                LineItemData(id: item.id, itemDescription: "Changed", price: 1),
                LineItemData(itemDescription: "New row", price: 2)
            ]
            let cancel = InvoiceFormView.makeCancelAction(for: invoice, in: context)
            XCTAssertFalse(InvoiceFormView.saveInvoice(
                in: context, pending: &pendingInvoice, invoiceNumber: "Changed", invoiceType: "proforma",
                client: unrelated, issueDate: Date(), dueDate: Date(), notes: "Changed",
                discount: 10, taxRate: 10, lineItems: rows, onError: { _ in errors += 1 }
            ))
            XCTAssertEqual(errors, 1)
            XCTAssertNotNil(pendingInvoice)
            XCTAssertTrue(context.insertedModelsArray.contains { $0 === unrelated })
            XCTAssertTrue(context.hasChanges)
            cancel(pendingInvoice)
            pendingInvoice = nil
            XCTAssertEqual(invoice.invoiceNumber, "INV-001")
            XCTAssertEqual(invoice.lineItems?.count, 1)
            let restored = try XCTUnwrap(invoice.lineItems?.first)
            XCTAssertEqual(restored.id, originalItemID)
            XCTAssertFalse(restored.isDeleted)
            XCTAssertEqual(restored.itemDescription, "Consulting")
            XCTAssertEqual(restored.price, 120)
            XCTAssertEqual(restored.quantity, 3)
            XCTAssertEqual(restored.total, 360)
            XCTAssertTrue(restored.invoice === invoice)
            XCTAssertEqual(try context.fetch(FetchDescriptor<Invoice>()).count, 1)
            XCTAssertEqual(try context.fetch(FetchDescriptor<InvoiceLineItem>()).count, 1)
            XCTAssertEqual(unrelated.phone, "Unrelated pending edit")
            XCTAssertTrue(context.insertedModelsArray.contains { $0 === unrelated })
            XCTAssertTrue(context.hasChanges)
        }
    }

    // MARK: - The core regression test

    @MainActor
    func testFormSavesAndRepeatedEditsSurviveReopenWithoutOrphanItems() throws {
        try autoreleasepool {
            let context = makeContext(for: try openContainer())
            var client: Client?
            var invoice: Invoice?
            var rows = [
                LineItemData(itemDescription: "Retained", price: 20, quantity: 2),
                LineItemData(itemDescription: "Removed", price: 5)
            ]
            for attempt in 0..<3 {
                XCTAssertTrue(ClientFormView.saveClient(
                    in: context, pending: &client, fullName: "Client \(attempt)",
                    company: "", email: "", phone: "", address: "",
                    onError: { XCTFail("Unexpected save error: \($0)") }
                ))
                if attempt == 1 {
                    rows.removeLast()
                    rows.append(LineItemData(itemDescription: "Added", price: 10))
                }
                rows[0].quantity = Double(attempt + 1)
                XCTAssertTrue(InvoiceFormView.saveInvoice(
                    in: context, pending: &invoice, invoiceNumber: "INV-SAVED", invoiceType: "invoice",
                    client: client, issueDate: Date(timeIntervalSince1970: 100), dueDate: nil,
                    notes: "Final notes", discount: 0, taxRate: 0, lineItems: rows,
                    onError: { XCTFail("Unexpected save error: \($0)") }
                ))
            }
        }
        try autoreleasepool {
            let context = makeContext(for: try openContainer())
            XCTAssertEqual(try context.fetch(FetchDescriptor<Client>()).count, 1)
            XCTAssertEqual(try context.fetch(FetchDescriptor<Invoice>()).count, 1)
            XCTAssertEqual(try context.fetch(FetchDescriptor<InvoiceLineItem>()).count, 2)
            let invoice = try XCTUnwrap(context.fetch(FetchDescriptor<Invoice>()).first)
            XCTAssertEqual(invoice.client?.fullName, "Client 2")
            XCTAssertEqual(invoice.notes, "Final notes")
            XCTAssertEqual(invoice.subtotal, 70)
            XCTAssertEqual(invoice.total, 70)
            XCTAssertEqual(invoice.balanceDue, 70)
            XCTAssertEqual(Set(invoice.lineItems?.map(\.itemDescription) ?? []), ["Retained", "Added"])
        }
    }

    // MARK: - The core regression test

    func testClientAndInvoiceSurviveContextTeardownAndRefetch() throws {
        let seeded = try seedAndQuit()

        // "Relaunch": brand-new container over the same store file.
        try autoreleasepool {
            let container = try openContainer()
            let context = makeContext(for: container)

            var clientID = seeded.clientID
            let clients = try context.fetch(
                FetchDescriptor<Client>(predicate: #Predicate { $0.id == clientID }))
            XCTAssertEqual(clients.count, 1, "client must survive a relaunch")
            let client = try XCTUnwrap(clients.first)
            XCTAssertEqual(client.fullName, "Ada Lovelace")
            XCTAssertEqual(client.company, "Analytical Engines Ltd")
            XCTAssertEqual(client.email, "ada@example.com")

            var invoiceID = seeded.invoiceID
            let invoices = try context.fetch(
                FetchDescriptor<Invoice>(predicate: #Predicate { $0.id == invoiceID }))
            XCTAssertEqual(invoices.count, 1, "invoice must survive a relaunch")
            let invoice = try XCTUnwrap(invoices.first)
            XCTAssertEqual(invoice.invoiceNumber, "INV-001")
            XCTAssertEqual(invoice.notes, "Net 30")
            XCTAssertEqual(invoice.total, 360, accuracy: 0.001, "120 x 3, no tax/discount")
            XCTAssertEqual(invoice.client?.id, clientID, "client relationship must survive")
            XCTAssertEqual(invoice.lineItems?.count, 1, "line items must survive")
            XCTAssertEqual(invoice.lineItems?.first?.itemDescription, "Consulting")
            XCTAssertEqual(invoice.lineItems?.first?.total ?? 0, 360, accuracy: 0.001)
        }
    }

    func testUpdatedRecordsSurviveRelaunch() throws {
        let seeded = try seedAndQuit()

        // First relaunch: edit the records and save.
        try autoreleasepool {
            let container = try openContainer()
            let context = makeContext(for: container)

            var clientID = seeded.clientID
            let client = try XCTUnwrap(
                context.fetch(
                    FetchDescriptor<Client>(predicate: #Predicate { $0.id == clientID })
                ).first)

            var invoiceID = seeded.invoiceID
            let invoice = try XCTUnwrap(
                context.fetch(
                    FetchDescriptor<Invoice>(predicate: #Predicate { $0.id == invoiceID })
                ).first)

            client.fullName = "Ada King, Countess of Lovelace"
            invoice.notes = "Net 60"
            invoice.lineItems?.first?.quantity = 10
            invoice.lineItems?.first?.recalculate() // the app's form does this on every edit
            invoice.recalculate()
            context.persist()
        }

        // Second relaunch: the edits must still be there.
        try autoreleasepool {
            let container = try openContainer()
            let context = makeContext(for: container)

            var clientID = seeded.clientID
            let client = try XCTUnwrap(
                context.fetch(
                    FetchDescriptor<Client>(predicate: #Predicate { $0.id == clientID })
                ).first)
            XCTAssertEqual(client.fullName, "Ada King, Countess of Lovelace")

            var invoiceID = seeded.invoiceID
            let invoice = try XCTUnwrap(
                context.fetch(
                    FetchDescriptor<Invoice>(predicate: #Predicate { $0.id == invoiceID })
                ).first)
            XCTAssertEqual(invoice.notes, "Net 60")
            XCTAssertEqual(invoice.total, 1200, accuracy: 0.001, "120 x 10 after edit")
        }
    }

    func testDeletedClientStaysDeletedAfterRelaunch() throws {
        let seeded = try seedAndQuit()

        try autoreleasepool {
            let container = try openContainer()
            let context = makeContext(for: container)
            var clientID = seeded.clientID
            let client = try XCTUnwrap(
                context.fetch(
                    FetchDescriptor<Client>(predicate: #Predicate { $0.id == clientID })
                ).first)
            context.delete(client)
            context.persist()
        }

        try autoreleasepool {
            let container = try openContainer()
            let context = makeContext(for: container)
            XCTAssertEqual(try context.fetchCount(FetchDescriptor<Client>()), 0,
                           "deleted client must stay deleted after relaunch")
            // Client.invoices uses .nullify, so the invoice survives detached.
            XCTAssertEqual(try context.fetchCount(FetchDescriptor<Invoice>()), 1)
            let invoice = try XCTUnwrap(try context.fetch(FetchDescriptor<Invoice>()).first)
            XCTAssertNil(invoice.client, "invoice must be detached from the deleted client")
        }
    }

    func testDoublePersistDoesNotDuplicateRecords() throws {
        try autoreleasepool {
            let container = try openContainer()
            let context = makeContext(for: container)
            let client = Client(fullName: "Grace Hopper")
            context.insert(client)
            context.persist()
            context.persist()
        }

        try autoreleasepool {
            let container = try openContainer()
            let context = makeContext(for: container)
            XCTAssertEqual(try context.fetchCount(FetchDescriptor<Client>()), 1,
                           "saving twice must not create duplicate rows")
        }
    }

    // MARK: - Negative controls (document the original bug)

    func testUnsavedChangesVanishAfterTeardown() throws {
        // Reproduces the original P0: inserts without an explicit save die
        // with the context. If this ever starts failing, persistence behavior
        // changed and the app's save strategy must be re-examined.
        try autoreleasepool {
            let container = try openContainer()
            let context = makeContext(for: container)
            context.insert(Client(fullName: "Ghost Client"))
            let invoice = Invoice(invoiceNumber: "INV-GHOST")
            context.insert(invoice)
            // No persist() — exactly the bug.
        }

        try autoreleasepool {
            let container = try openContainer()
            let context = makeContext(for: container)
            XCTAssertEqual(try context.fetchCount(FetchDescriptor<Client>()), 0,
                           "unsaved inserts must not survive teardown (bug contract)")
            XCTAssertEqual(try context.fetchCount(FetchDescriptor<Invoice>()), 0)
        }
    }

    func testUnsavedChangesAreInvisibleToOtherContexts() throws {
        // Why persist() matters even while the app runs: unsaved changes are
        // private to their context and never reach the store.
        let container = try ModelContainer(
            for: Invoice.self, InvoiceLineItem.self, Client.self, Company.self, Setting.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
        let writer = makeContext(for: container)
        writer.insert(Client(fullName: "Unsaved Client"))

        let reader = makeContext(for: container)
        XCTAssertEqual(try reader.fetchCount(FetchDescriptor<Client>()), 0,
                       "another context must not see unsaved changes")

        writer.persist()
        XCTAssertEqual(try reader.fetchCount(FetchDescriptor<Client>()), 1,
                       "after save, the change must be visible to other contexts")
    }

    // MARK: - Backup round trip

    func testBackupExportImportRoundTripAcrossRelaunch() throws {
        // Session 1: seed, export a backup.
        try autoreleasepool {
            let container = try openContainer()
            let context = makeContext(for: container)
            let client = Client(fullName: "Alan Turing")
            context.insert(client)
            let invoice = Invoice(invoiceNumber: "INV-BK-1")
            invoice.client = client
            context.insert(invoice)
            let item = InvoiceLineItem(itemDescription: "Cryptanalysis", price: 500, quantity: 1)
            context.insert(item)
            item.invoice = invoice
            invoice.lineItems?.append(item)
            invoice.recalculate()
            context.persist()
            try BackupService.export(to: backupURL, from: context)
        }

        // Session 2: the store is wiped (disaster scenario).
        try autoreleasepool {
            let container = try openContainer()
            let context = makeContext(for: container)
            for client in try context.fetch(FetchDescriptor<Client>()) { context.delete(client) }
            for invoice in try context.fetch(FetchDescriptor<Invoice>()) { context.delete(invoice) }
            context.persist()
        }

        // Session 3: restore from the backup file and verify.
        try autoreleasepool {
            let container = try openContainer()
            let context = makeContext(for: container)
            let result = try BackupService.importDocument(from: backupURL, into: context)
            context.persist()

            XCTAssertEqual(result.clientsCreated, 1)
            XCTAssertEqual(result.invoicesCreated, 1)
            XCTAssertEqual(try context.fetchCount(FetchDescriptor<Client>()), 1)
            XCTAssertEqual(try context.fetchCount(FetchDescriptor<Invoice>()), 1)
            let invoice = try XCTUnwrap(try context.fetch(FetchDescriptor<Invoice>()).first)
            XCTAssertEqual(invoice.invoiceNumber, "INV-BK-1")
            XCTAssertEqual(invoice.total, 500, accuracy: 0.001)
            XCTAssertEqual(invoice.client?.fullName, "Alan Turing")
        }
    }
}

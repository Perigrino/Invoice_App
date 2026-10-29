import XCTest
import SwiftData
@testable import InvoiceFlow

/// Cent-exactness of the money math (S-003), the payment balance chain
/// (S-004), and mid-session durability (S-002).
///
/// The rounding cases are exact-`Decimal` literals everywhere — a `Double`
/// literal would poison the tie cases the tests exist to pin down.
final class RecalculateTests: XCTestCase {

    private var tempDir: URL!
    private var originalBackupsDirectory: URL!

    override func setUpWithError() throws {
        tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("recalc-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        originalBackupsDirectory = RollingBackupService.backupsDirectory
        RollingBackupService.backupsDirectory = tempDir.appendingPathComponent("Backups", isDirectory: true)
    }

    override func tearDownWithError() throws {
        RollingBackupService.backupsDirectory = originalBackupsDirectory
        try? FileManager.default.removeItem(at: tempDir)
    }

    private func d(_ value: String) -> Decimal {
        guard let decimal = Decimal(string: value) else {
            fatalError("bad literal \(value)")
        }
        return decimal
    }

    private func invoiceWithLines(
        _ lines: [(price: Decimal, quantity: Double, discount: Double, tax: Double)],
        invoiceDiscount: Double = 0,
        invoiceTax: Double = 0
    ) -> Invoice {
        let invoice = Invoice(invoiceNumber: "T-0001", discount: invoiceDiscount, tax: invoiceTax)
        invoice.lineItems = lines.enumerated().map { index, line in
            InvoiceLineItem(
                itemDescription: "Item \(index)",
                price: line.price,
                quantity: line.quantity,
                discount: line.discount,
                tax: line.tax,
                sortOrder: index
            )
        }
        invoice.recalculate()
        return invoice
    }

    // MARK: - S-003: cent-exact rounding (6 cases)

    /// Exactly half a cent rounds away from zero.
    func testLineItemHalfCentRoundsAwayFromZero() {
        let invoice = invoiceWithLines([(d("10.005"), 1, 0, 0)])
        XCTAssertEqual(invoice.lineItems?.first?.total, d("10.01"))
        XCTAssertEqual(invoice.subtotal, d("10.01"))
        XCTAssertEqual(invoice.total, d("10.01"))
    }

    /// Just below half a cent rounds down.
    func testLineItemBelowHalfCentRoundsDown() {
        let invoice = invoiceWithLines([(d("10.004"), 1, 0, 0)])
        XCTAssertEqual(invoice.lineItems?.first?.total, d("10.00"))
        XCTAssertEqual(invoice.total, d("10.00"))
    }

    /// Per-line discount and tax percents compose to a cents-exact total.
    /// 33.335 × 3 = 100.005 → −5% → 95.0025 → +7.5% → 102.1276875 → 102.13.
    func testLineItemWithDiscountAndTaxIsCentExact() {
        let invoice = invoiceWithLines([(d("33.335"), 3, 5, 7.5)])
        XCTAssertEqual(invoice.lineItems?.first?.total, d("102.13"))
    }

    /// Values already at cents come through with no creep.
    func testLineItemExactCentsUnchanged() {
        let invoice = invoiceWithLines([(d("19.99"), 2, 0, 0)])
        XCTAssertEqual(invoice.lineItems?.first?.price, d("19.99"))
        XCTAssertEqual(invoice.lineItems?.first?.total, d("39.98"))
        XCTAssertEqual(invoice.total, d("39.98"))
        XCTAssertEqual(invoice.balanceDue, d("39.98"))
    }

    /// The preserved v1 formula: recalculate() uses the LINE-level discount
    /// and tax percents (invoice-level discount/tax are stored but do not
    /// enter this math). 102.13 − 5.1065 + 7.65975 = 104.68325 → 104.68 —
    /// the same value the MigrationTests v1 fixture produced.
    func testInvoiceAggregateRoundsToCents() {
        let invoice = invoiceWithLines(
            [(d("33.335"), 3, 5, 7.5)],
            invoiceDiscount: 10,
            invoiceTax: 5
        )
        XCTAssertEqual(invoice.subtotal, d("102.13"))
        XCTAssertEqual(invoice.total, d("104.68"))
        XCTAssertEqual(invoice.balanceDue, d("104.68"))
    }

    /// Two cents-tight lines on one invoice aggregate exactly.
    /// 10.01 + 10.00 = 20.01 — no Double drift is allowed to appear.
    func testInvoiceSumsCentExactLines() {
        let invoice = invoiceWithLines([
            (d("10.005"), 1, 0, 0),
            (d("10.004"), 1, 0, 0),
        ])
        XCTAssertEqual(invoice.subtotal, d("20.01"))
        XCTAssertEqual(invoice.total, d("20.01"))
        XCTAssertEqual(invoice.balanceDue, d("20.01"))
    }

    // MARK: - S-004: payment chain

    private func paidInvoice(total: Decimal, paymentAmounts: [Decimal]) -> Invoice {
        let invoice = invoiceWithLines([(d("50"), 2, 0, 0)]) // total 100
        XCTAssertEqual(invoice.total, total)
        let payments = paymentAmounts.map { Payment(amount: $0) }
        invoice.payments = payments
        payments.forEach { $0.invoice = invoice }
        invoice.recalculateBalance()
        return invoice
    }

    func testBalanceDueIsTotalMinusPayments() {
        let invoice = paidInvoice(total: d("100.00"), paymentAmounts: [d("40.00")])
        XCTAssertEqual(invoice.balanceDue, d("60.00"))
    }

    func testBalanceDueSumsMultiplePayments() {
        let invoice = paidInvoice(total: d("100.00"), paymentAmounts: [d("25.25"), d("14.75")])
        XCTAssertEqual(invoice.balanceDue, d("60.00"))
    }

    func testBalanceDueNeverGoesNegative() {
        let invoice = paidInvoice(total: d("100.00"), paymentAmounts: [d("160.00")])
        XCTAssertEqual(invoice.balanceDue, .zero)
        XCTAssertEqual(invoice.status, .paid)
    }

    func testHalfPaymentShowsPartiallyPaid() {
        let invoice = paidInvoice(total: d("100.00"), paymentAmounts: [d("50.00")])
        XCTAssertEqual(invoice.balanceDue, d("50.00"))
        XCTAssertEqual(invoice.status, .partiallyPaid)
    }

    func testFullPaymentShowsPaid() {
        let invoice = paidInvoice(total: d("100.00"), paymentAmounts: [d("100.00")])
        XCTAssertEqual(invoice.balanceDue, .zero)
        XCTAssertEqual(invoice.status, .paid)
    }

    /// S-002: an edit persisted mid-session must reach the store file
    /// immediately — a crash before quit-time persist loses nothing.
    @MainActor
    func testMidSessionEditSurvivesImmediateReopen() throws {
        let storeURL = tempDir.appendingPathComponent("kill.store")

        // Session 1: create an invoice and edit it in the same session.
        let container1 = try ModelContainer(
            for: Invoice.self, InvoiceLineItem.self, Client.self, Company.self, Setting.self, Payment.self,
            configurations: ModelConfiguration(url: storeURL)
        )
        let context1 = container1.mainContext
        context1.autosaveEnabled = false

        let invoice = Invoice(invoiceNumber: "KILL-1")
        let line = InvoiceLineItem(itemDescription: "Sitting", price: d("25"), quantity: 2, sortOrder: 0)
        line.invoice = invoice
        invoice.lineItems = [line]
        context1.insert(invoice)
        invoice.recalculate()
        XCTAssertTrue(context1.persist())

        // Edit right before the "crash": no quit, no extra flush.
        line.price = d("30")
        line.recalculate()
        invoice.recalculate()
        XCTAssertTrue(context1.persist())

        // Session 2: nothing in-app persisted the change except our save.
        let container2 = try ModelContainer(
            for: Invoice.self, InvoiceLineItem.self, Client.self, Company.self, Setting.self, Payment.self,
            configurations: ModelConfiguration(url: storeURL)
        )
        let context2 = container2.mainContext
        context2.autosaveEnabled = false

        let refetched = try context2.fetch(FetchDescriptor<Invoice>())
        XCTAssertEqual(refetched.count, 1)
        XCTAssertEqual(refetched.first?.total, d("60.00"))
        XCTAssertEqual(refetched.first?.lineItems?.first?.price, d("30"))
    }

    /// S-002: a rolling snapshot taken mid-session contains the edit the
    /// moment it was saved — not only the quit-time snapshot.
    @MainActor
    func testMidSessionSnapshotCapturesJustSavedEdit() throws {
        let liveStore = tempDir.appendingPathComponent("live.store")

        let container = try ModelContainer(
            for: Invoice.self, InvoiceLineItem.self, Client.self, Company.self, Setting.self, Payment.self,
            configurations: ModelConfiguration(url: liveStore)
        )
        let context = container.mainContext
        context.autosaveEnabled = false

        let invoice = Invoice(invoiceNumber: "SNAP-1")
        let line = InvoiceLineItem(itemDescription: "Foundry", price: d("25"), quantity: 2, sortOrder: 0)
        line.invoice = invoice
        invoice.lineItems = [line]
        context.insert(invoice)
        invoice.recalculate()
        XCTAssertTrue(context.persist())

        // Snapshot right after the save.
        let snapshotDir = RollingBackupService.takeSnapshot(storeURL: liveStore)
        XCTAssertNotNil(snapshotDir)

        // Mount the snapshot as if the app restored it: copy the trio to a
        // fresh location and open it.
        let restoredURL = tempDir.appendingPathComponent("restored.store")
        let fm = FileManager.default
        for suffix in ["", "-wal", "-shm"] {
            let source = snapshotDir!.appendingPathComponent("default.store" + suffix)
            if fm.fileExists(atPath: source.path) {
                try fm.copyItem(at: source, to: URL(fileURLWithPath: restoredURL.path + suffix))
            }
        }

        let restoredContainer = try ModelContainer(
            for: Invoice.self, InvoiceLineItem.self, Client.self, Company.self, Setting.self, Payment.self,
            configurations: ModelConfiguration(url: restoredURL)
        )
        let restoredContext = restoredContainer.mainContext
        let invoices = try restoredContext.fetch(FetchDescriptor<Invoice>())
        XCTAssertEqual(invoices.count, 1)
        XCTAssertEqual(invoices.first?.total, d("50.00"))
        XCTAssertEqual(invoices.first?.lineItems?.first?.price, d("25"))
    }
}

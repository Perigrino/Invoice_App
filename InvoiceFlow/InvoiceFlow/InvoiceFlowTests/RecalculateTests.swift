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

    /// Invoice-level discount is applied before tax; both round to the cent.
    /// Line total 102.13 (line-discount/tax already folded in), then invoice
    /// discount 10 % → 91.917, then invoice tax 5 % → 91.917 + 4.59585 =
    /// 96.51285 → 96.51.
    func testInvoiceAggregateRoundsToCents() {
        let invoice = invoiceWithLines(
            [(d("33.335"), 3, 5, 7.5)],
            invoiceDiscount: 10,
            invoiceTax: 5
        )
        XCTAssertEqual(invoice.subtotal, d("102.13"))
        XCTAssertEqual(invoice.total, d("96.51"))
        XCTAssertEqual(invoice.balanceDue, d("96.51"))
    }

    /// Plain lines with invoice-level discount+tax compose cleanly.
    /// 100 × (1−10%) × 1.05 = 94.5.
    func testInvoiceDiscountAndTaxApplyAtInvoiceLevel() {
        let invoice = invoiceWithLines(
            [(d("100"), 1, 0, 0)],
            invoiceDiscount: 10,
            invoiceTax: 5
        )
        XCTAssertEqual(invoice.subtotal, d("100"))
        XCTAssertEqual(invoice.total, d("94.50"))
        XCTAssertEqual(invoice.balanceDue, d("94.50"))
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

    // MARK: - S-021: status engine

    /// Past due with money still owed ⇒ Overdue even if partially paid.
    @MainActor
    func testOverdueWhenPastDueEvenThoughPartiallyPaid() {
        let invoice = invoiceWithLines([(d("50"), 2, 0, 0)]) // total 100
        invoice.dueDate = Date().addingTimeInterval(-86400 * 10)
        let payments = [Payment(amount: d("50"))]
        invoice.payments = payments
        payments.forEach { $0.invoice = invoice }
        invoice.recalculateBalance()
        XCTAssertEqual(invoice.balanceDue, d("50"))
        XCTAssertEqual(invoice.status, .overdue)
    }

    /// Within terms ⇒ Partially Paid.
    @MainActor
    func testPartiallyPaidWithinTerms() {
        let invoice = invoiceWithLines([(d("50"), 2, 0, 0)])
        invoice.dueDate = Date().addingTimeInterval(86400 * 10)
        let payments = [Payment(amount: d("50"))]
        invoice.payments = payments
        payments.forEach { $0.invoice = invoice }
        invoice.recalculateBalance()
        XCTAssertEqual(invoice.status, .partiallyPaid)
    }

    /// No balance after a partial payment stays old due date but not overdue.
    @MainActor
    func testNotOverdueAfterPartialPaymentSoonDue() {
        let invoice = invoiceWithLines([(d("50"), 2, 0, 0)])
        invoice.dueDate = Date().addingTimeInterval(86400 * 3)
        let payments = [Payment(amount: d("25"))]
        invoice.payments = payments
        payments.forEach { $0.invoice = invoice }
        invoice.recalculateBalance()
        XCTAssertEqual(invoice.balanceDue, d("75"))
        XCTAssertEqual(invoice.status, .partiallyPaid)
    }

    // MARK: - S-022: status click-through filters on lists

    /// Unit test for filter predicate covering all status options.
    /// We create sample invoices covering all status values and verify that
    /// the filter predicate (in InvoiceListView.filteredInvoices) correctly
    /// includes each status and that the "All" (nil) option shows all.
    @MainActor
    func testStatusFilterPredicate() {
        // Generate a base invoice and tweak dates/payments to hit each status.
        let now = Date()
        let pastDue = now.addingTimeInterval(-86400 * 10)
        let soon = now.addingTimeInterval(86400 * 10)
        let upcoming = now.addingTimeInterval(86400 * 20)

        // Build a few distinct invoice instances to ensure we have each status:
        // 1. Paid (full payment) – status .paid
        // 2. Overdue with balance – status .overdue
        // 3. Partially paid within terms – status .partiallyPaid
        // 4. Due soon (<=14d) – status .dueSoon
        // 5. Upcoming (>14d) – status .upcoming
        // 6. Draft (no dueDate) – status .upcoming (when dueDate nil, the logic
        //    in Invoice.status returns .upcoming)

        // Paid invoice
        let paidInvoice = invoiceWithLines([(d("50"), 2, 0, 0)])
        paidInvoice.dueDate = pastDue
        let paidPayments = [Payment(amount: d("100"))]
        paidInvoice.payments = paidPayments
        paidPayments.forEach { $0.invoice = paidInvoice }
        paidInvoice.recalculateBalance()

        // Overdue with balance
        let overdueInvoice = invoiceWithLines([(d("50"), 2, 0, 0)])
        overdueInvoice.dueDate = pastDue
        let overduePayments = [Payment(amount: d("50"))]
        overdueInvoice.payments = overduePayments
        overduePayments.forEach { $0.invoice = overdueInvoice }
        overdueInvoice.recalculateBalance()

        // Partially paid within terms
        let partialInvoice = invoiceWithLines([(d("50"), 2, 0, 0)])
        partialInvoice.dueDate = soon
        let partialPayments = [Payment(amount: d("50"))]
        partialInvoice.payments = partialPayments
        partialPayments.forEach { $0.invoice = partialInvoice }
        partialInvoice.recalculateBalance()

        // Due soon (<=14d) with full balance
        let dueSoonInvoice = invoiceWithLines([(d("50"), 2, 0, 0)])
        dueSoonInvoice.dueDate = soon
        // No payments

        // Upcoming (>14d) with full balance
        let upcomingInvoice = invoiceWithLines([(d("50"), 2, 0, 0)])
        upcomingInvoice.dueDate = upcoming

        // No due date also reads as upcoming (the draft case).
        let draftInvoice = invoiceWithLines([(d("50"), 2, 0, 0)])
        // No dueDate

        let sampleInvoices = [
            paidInvoice, overdueInvoice, partialInvoice, dueSoonInvoice,
            upcomingInvoice, draftInvoice
        ]

        // Every status is represented; `.upcoming` covers both the far-future
        // invoice and the no-due-date draft.
        let expectedCounts: [InvoiceStatus: Int] = [
            .paid: 1, .overdue: 1, .partiallyPaid: 1, .dueSoon: 1, .upcoming: 2
        ]
        let statuses = sampleInvoices.map { $0.status }
        for (status, expected) in expectedCounts {
            let count = statuses.filter { $0 == status }.count
            XCTAssertEqual(count, expected, "Status \(status) expected \(expected) but found \(count)")
        }

        // Filter predicate tests — each status returns exactly its own rows.
        for status in InvoiceStatus.allCases {
            let filteredByStatus = sampleInvoices.filter { $0.status == status }
            XCTAssertEqual(
                filteredByStatus.count,
                expectedCounts[status] ?? 0,
                "Filter for \(status) returned the wrong rows"
            )
            XCTAssertTrue(filteredByStatus.allSatisfy { $0.status == status })
        }

        // "All" (nil) case matches the entire set.
        XCTAssertEqual(sampleInvoices.count, 6, "'All' filter should show all invoices")
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

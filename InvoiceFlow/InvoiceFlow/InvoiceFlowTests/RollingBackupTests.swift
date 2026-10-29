//
//  RollingBackupTests.swift
//  InvoiceFlowTests
//

import XCTest
import SwiftData
@testable import InvoiceFlow

final class RollingBackupTests: XCTestCase {

    private var tempDir: URL!
    private var liveStore: URL!
    private var originalBackupsDir: URL!

    override func setUpWithError() throws {
        tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("rolling-backup-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        liveStore = tempDir.appendingPathComponent("default.store")
        originalBackupsDir = RollingBackupService.backupsDirectory
        RollingBackupService.backupsDirectory = tempDir.appendingPathComponent("Backups")
    }

    override func tearDownWithError() throws {
        RollingBackupService.backupsDirectory = originalBackupsDir
        RollingBackupService.clearStagedRestore()
        try? FileManager.default.removeItem(at: tempDir)
    }

    // MARK: - Helpers

    /// Creates a plausible store trio with distinct content per file.
    private func makeLiveStore(content: String = "live-data") throws {
        try content.write(to: liveStore, atomically: true, encoding: .utf8)
        try (content + "-wal").write(to: URL(fileURLWithPath: liveStore.path + "-wal"), atomically: true, encoding: .utf8)
        try (content + "-shm").write(to: URL(fileURLWithPath: liveStore.path + "-shm"), atomically: true, encoding: .utf8)
    }

    private func readStore(_ url: URL, suffix: String = "") throws -> String {
        try String(contentsOf: URL(fileURLWithPath: url.path + suffix), encoding: .utf8)
    }

    // MARK: - Snapshotting

    func testSnapshotCopiesStoreTrio() throws {
        try makeLiveStore(content: "important-data")

        let snapshot = try XCTUnwrap(RollingBackupService.takeSnapshot(storeURL: liveStore))

        XCTAssertEqual(try readStore(snapshot.appendingPathComponent("default.store")), "important-data")
        XCTAssertEqual(try readStore(snapshot.appendingPathComponent("default.store"), suffix: "-wal"), "important-data-wal")
        XCTAssertEqual(try readStore(snapshot.appendingPathComponent("default.store"), suffix: "-shm"), "important-data-shm")
    }

    /// The live store file is named `InvoiceFlow.store` these days; snapshots
    /// must keep the canonical `default.store` layout either way, so older
    /// snapshots stay restorable and restore code stays name-agnostic.
    func testSnapshotNormalizesNonDefaultStoreName() throws {
        let renamedStore = tempDir.appendingPathComponent("InvoiceFlow.store")
        defer {
            for suffix in ["", "-wal", "-shm"] {
                try? FileManager.default.removeItem(at: URL(fileURLWithPath: renamedStore.path + suffix))
            }
        }
        try "renamed-live-data".write(to: renamedStore, atomically: true, encoding: .utf8)
        try "renamed-live-data-wal".write(to: URL(fileURLWithPath: renamedStore.path + "-wal"), atomically: true, encoding: .utf8)
        try "renamed-live-data-shm".write(to: URL(fileURLWithPath: renamedStore.path + "-shm"), atomically: true, encoding: .utf8)

        let snapshot = try XCTUnwrap(RollingBackupService.takeSnapshot(storeURL: renamedStore))

        XCTAssertEqual(try readStore(snapshot.appendingPathComponent("default.store")), "renamed-live-data")
        XCTAssertEqual(try readStore(snapshot.appendingPathComponent("default.store"), suffix: "-wal"), "renamed-live-data-wal")
        XCTAssertEqual(try readStore(snapshot.appendingPathComponent("default.store"), suffix: "-shm"), "renamed-live-data-shm")
    }

    func testSnapshotWithoutStoreReturnsNil() {
        XCTAssertNil(RollingBackupService.takeSnapshot(storeURL: liveStore))
        XCTAssertTrue(RollingBackupService.snapshots().isEmpty)
    }

    func testSnapshotsPrunedToKeepCount() throws {
        try makeLiveStore()
        let keep = RollingBackupService.keepCount

        // One more snapshot than the cap, spaced a second apart for unique names.
        var created: [URL] = []
        for offset in 0..<(keep + 2) {
            let date = Calendar.current.date(byAdding: .second, value: offset, to: Date())!
            let snap = try XCTUnwrap(RollingBackupService.takeSnapshot(storeURL: liveStore, now: date))
            created.append(snap)
        }

        let remainingNames = Set(RollingBackupService.snapshots().map(\.lastPathComponent))
        XCTAssertEqual(remainingNames.count, keep, "only the newest \(keep) snapshots should survive")
        // The two oldest must be gone; the newest must have survived.
        XCTAssertFalse(remainingNames.contains(created[0].lastPathComponent), "oldest snapshot should have been pruned")
        XCTAssertFalse(remainingNames.contains(created[1].lastPathComponent), "second-oldest snapshot should have been pruned")
        XCTAssertTrue(remainingNames.contains(created[keep + 1].lastPathComponent), "newest snapshot should survive")
    }

    // MARK: - Staged restore

    func testStagedRestoreAppliesOnNextLaunch() throws {
        try makeLiveStore(content: "live-state")

        // Capture a snapshot (holding "live-state"), then change the live store.
        let snapshot = try XCTUnwrap(RollingBackupService.takeSnapshot(storeURL: liveStore))
        try makeLiveStore(content: "user-made-a-mess")

        // User stages the restore while the app is running.
        try RollingBackupService.stageRestore(snapshot: snapshot)
        XCTAssertTrue(FileManager.default.fileExists(atPath: RollingBackupService.stagedRestoreURL.path))

        // Next launch: apply before opening the container.
        XCTAssertTrue(RollingBackupService.applyStagedRestoreIfAny(liveStoreURL: liveStore))

        XCTAssertEqual(try readStore(liveStore), "live-state", "store must be rolled back to the snapshot")
        XCTAssertEqual(try readStore(liveStore, suffix: "-wal"), "live-state-wal", "WAL companion must be restored too")
        XCTAssertFalse(FileManager.default.fileExists(atPath: RollingBackupService.stagedRestoreURL.path),
                       "marker must be consumed after applying")
    }

    func testStagedRestoreWithMissingSnapshotLeavesStoreAlone() throws {
        try makeLiveStore(content: "precious")

        // Stage a marker pointing at a directory with no store file.
        let bogus = tempDir.appendingPathComponent("Snapshot-bogus", isDirectory: true)
        try FileManager.default.createDirectory(at: bogus, withIntermediateDirectories: true)
        // The marker lives inside the backups directory; create it like the
        // app's stageRestore flow would.
        try FileManager.default.createDirectory(at: RollingBackupService.backupsDirectory, withIntermediateDirectories: true)
        try bogus.path.write(to: RollingBackupService.stagedRestoreURL, atomically: true, encoding: .utf8)

        XCTAssertFalse(RollingBackupService.applyStagedRestoreIfAny(liveStoreURL: liveStore))
        XCTAssertEqual(try readStore(liveStore), "precious", "a broken marker must never clobber the live store")
        XCTAssertFalse(FileManager.default.fileExists(atPath: RollingBackupService.stagedRestoreURL.path),
                       "marker should still be consumed to avoid retry loops")
    }

    func testNoStagedMarkerIsANoOp() throws {
        try makeLiveStore(content: "untouched")
        XCTAssertFalse(RollingBackupService.applyStagedRestoreIfAny(liveStoreURL: liveStore))
        XCTAssertEqual(try readStore(liveStore), "untouched")
    }

    // MARK: - Real stores with payments (S-0010)

    /// Snapshots of a REAL store trio carry payments: take a snapshot of a
    /// live store byte-for-byte in the middle of a session, drop the trio
    /// back at a fresh store path (what restore does), and verify the
    /// payment and its derived balance come with it.
    func testSnapshotOfRealStoreKeepsPayments() throws {
        // Seed a real file-backed store with an invoice and a payment.
        try autoreleasepool {
            let container = try ModelContainer(
                for: Invoice.self, InvoiceLineItem.self, Client.self, Company.self, Setting.self,
                configurations: ModelConfiguration(url: liveStore)
            )
            let context = ModelContext(container)
            context.autosaveEnabled = false
            let invoice = Invoice(invoiceNumber: "INV-SNAP-1")
            context.insert(invoice)
            let item = InvoiceLineItem(itemDescription: "Consulting", price: 80, quantity: 1)
            context.insert(item)
            item.invoice = invoice
            invoice.lineItems?.append(item)
            invoice.recalculate()
            let payment = Payment(amount: Decimal(string: "30.00")!, method: "Cash")
            context.insert(payment)
            payment.invoice = invoice
            invoice.payments?.append(payment)
            invoice.recalculateBalance()
            context.persist()
        }

        let snapshot = try XCTUnwrap(RollingBackupService.takeSnapshot(storeURL: liveStore))
        let restoredStore = tempDir.appendingPathComponent("restored.store")
        for suffix in ["", "-wal", "-shm"] {
            try FileManager.default.copyItem(
                at: URL(fileURLWithPath: snapshot.appendingPathComponent(RollingBackupService.snapshotStoreFileName).path + suffix),
                to: URL(fileURLWithPath: restoredStore.path + suffix))
        }

        try autoreleasepool {
            let container = try ModelContainer(
                for: Invoice.self, InvoiceLineItem.self, Client.self, Company.self, Setting.self,
                configurations: ModelConfiguration(url: restoredStore)
            )
            let context = ModelContext(container)
            context.autosaveEnabled = false
            let invoice = try XCTUnwrap(try context.fetch(FetchDescriptor<Invoice>()).first)
            XCTAssertEqual(invoice.payments?.count, 1, "snapshot keeps the recorded payment")
            XCTAssertEqual(invoice.payments?.first?.amount, Decimal(string: "30.00")!)
            XCTAssertEqual(invoice.balanceDue, Decimal(string: "50.00")!)
        }
    }
}

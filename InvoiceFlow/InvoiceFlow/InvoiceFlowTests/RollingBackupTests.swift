//
//  RollingBackupTests.swift
//  InvoiceFlowTests
//

import XCTest
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

    func testSnapshotWithoutStoreReturnsNil() {
        XCTAssertNil(RollingBackupService.takeSnapshot(storeURL: liveStore))
        XCTAssertTrue(RollingBackupService.snapshots().isEmpty)
    }

    func testSnapshotsPrunedToKeepCount() throws {
        try makeLiveStore()
        let keep = RollingBackupService.keepCount

        // One more snapshot than the cap, spaced a second apart for unique names.
        for offset in 0..<(keep + 2) {
            let date = Calendar.current.date(byAdding: .second, value: offset, to: Date())!
            _ = RollingBackupService.takeSnapshot(storeURL: liveStore, now: date)
        }

        let remaining = RollingBackupService.snapshots()
        XCTAssertEqual(remaining.count, keep, "only the newest \(keep) snapshots should survive")
        // The two oldest must be gone.
        let oldestName = remaining.first!.lastPathComponent
        XCTAssertFalse(oldestName.contains(String(format: "%02d", 0)), "oldest snapshots should have been pruned")
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
}

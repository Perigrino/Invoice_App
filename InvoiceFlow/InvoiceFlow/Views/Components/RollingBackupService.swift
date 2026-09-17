//
//  RollingBackupService.swift
//  InvoiceFlow
//
//  Automatic rolling snapshots of the SwiftData store, taken every time the
//  app quits. Keeps the most recent 5 snapshots in
//  ~/Library/Application Support/InvoiceFlow/Backups/.
//
//  SQLite stores live as a trio of files (store, -wal, -shm); all three are
//  copied together so a snapshot is always a consistent, restorable unit.
//  Restoring swaps files on disk, which can't happen while SQLite has the
//  store open — so a restore is *staged* and applied on the next launch
//  before any container is created.
//

import Foundation

enum RollingBackupService {

    static let keepCount = 5

    /// Directory that holds the snapshot folders: ~/Library/Application Support/InvoiceFlow/Backups/
    static var backupsDirectory: URL = {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return appSupport.appendingPathComponent("InvoiceFlow/Backups", isDirectory: true)
    }()

    /// The staged-restore marker file path (inside the snapshots directory).
    static var stagedRestoreURL: URL {
        backupsDirectory.appendingPathComponent("RESTORE_PENDING")
    }

    // MARK: - Snapshotting

    /// Copies the store trio (store, -wal, -shm) into a timestamped snapshot
    /// folder, then prunes old snapshots beyond `keepCount`. Never throws:
    /// a failed backup must not block the app from quitting.
    @discardableResult
    static func takeSnapshot(storeURL: URL, now: Date = Date()) -> URL? {
        let fm = FileManager.default

        // Resolve the canonical store path (no -wal/-shm suffix on the base).
        let base = URL(fileURLWithPath: storeURL.path.deletingSuffix("-wal").deletingSuffix("-shm"))
        let trio = [
            base.path,
            base.path + "-wal",
            base.path + "-shm",
        ]
        guard fm.fileExists(atPath: base.path) else { return nil }

        do {
            try fm.createDirectory(at: backupsDirectory, withIntermediateDirectories: true)

            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
            formatter.locale = Locale(identifier: "en_US_POSIX")
            let snapshotDir = backupsDirectory
                .appendingPathComponent("Snapshot-" + formatter.string(from: now), isDirectory: true)
            try fm.createDirectory(at: snapshotDir, withIntermediateDirectories: true)

            for path in trio where fm.fileExists(atPath: path) {
                let dest = snapshotDir.appendingPathComponent((path as NSString).lastPathComponent)
                try fm.copyItem(atPath: path, toPath: dest.path)
            }

            pruneSnapshots()
            return snapshotDir
        } catch {
            #if DEBUG
            print("⚠️ InvoiceFlow: rolling backup failed: \(error)")
            #endif
            return nil
        }
    }

    /// Snapshot folders, oldest first.
    static func snapshots() -> [URL] {
        let fm = FileManager.default
        guard let contents = try? fm.contentsOfDirectory(
            at: backupsDirectory,
            includingPropertiesForKeys: [.creationDateKey, .isDirectoryKey]
        ) else { return [] }
        return contents
            .filter { $0.lastPathComponent.hasPrefix("Snapshot-") && (try? $0.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    /// Deletes the oldest snapshots so at most `keepCount` remain.
    static func pruneSnapshots(keep: Int = keepCount) {
        let fm = FileManager.default
        let all = snapshots()
        guard all.count > keep else { return }
        for old in all.prefix(all.count - keep) {
            try? fm.removeItem(at: old)
        }
    }

    /// Human-readable description of a snapshot (timestamp from its name).
    static func snapshotDate(_ snapshot: URL) -> Date? {
        // Name format: Snapshot-yyyy-MM-dd_HH-mm-ss
        let name = snapshot.lastPathComponent
        guard name.hasPrefix("Snapshot-") else { return nil }
        let stamp = String(name.dropFirst("Snapshot-".count))
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter.date(from: stamp)
    }

    // MARK: - Restore

    /// Stages a restore: records which snapshot should replace the live store
    /// at next launch. Safe to call while the app is running — nothing is
    /// touched until the next launch applies it before opening the store.
    static func stageRestore(snapshot: URL) throws {
        let fm = FileManager.default
        guard fm.fileExists(atPath: snapshot.appendingPathComponent("default.store").path) else {
            throw RollingBackupError.snapshotIncomplete(snapshot)
        }
        try fm.createDirectory(at: backupsDirectory, withIntermediateDirectories: true)
        try snapshot.path.write(to: stagedRestoreURL, atomically: true, encoding: .utf8)
    }

    /// If a restore was staged, swaps the snapshot trio into the live store
    /// location and clears the marker. Call once at launch, BEFORE creating
    /// the ModelContainer. Returns true if a restore was applied.
    @discardableResult
    static func applyStagedRestoreIfAny(liveStoreURL: URL) -> Bool {
        let fm = FileManager.default
        guard let stagedPath = try? String(contentsOf: stagedRestoreURL, encoding: .utf8) else {
            return false
        }
        // Consume the marker first so a half-finished swap never loops.
        try? fm.removeItem(at: stagedRestoreURL)

        let snapshotBase = URL(fileURLWithPath: stagedPath.trimmingCharacters(in: .whitespacesAndNewlines))
            .appendingPathComponent("default.store")

        guard fm.fileExists(atPath: snapshotBase.path) else { return false }

        // Move the current trio aside into a temp folder so the swap is
        // fully reversible if the copy step fails midway.
        let asideDir = liveStoreURL.deletingLastPathComponent()
            .appendingPathComponent(".pre-restore-\(UUID().uuidString)", isDirectory: true)
        let suffixes = ["", "-wal", "-shm"]
        var movedAside = false
        if fm.fileExists(atPath: liveStoreURL.path) {
            try? fm.createDirectory(at: asideDir, withIntermediateDirectories: true)
            for suffix in suffixes {
                let p = URL(fileURLWithPath: liveStoreURL.path + suffix)
                if fm.fileExists(atPath: p.path) {
                    try? fm.moveItem(at: p, to: asideDir.appendingPathComponent(p.lastPathComponent))
                }
            }
            movedAside = true
        }

        do {
            for suffix in suffixes {
                let src = URL(fileURLWithPath: snapshotBase.path + suffix)
                let dst = URL(fileURLWithPath: liveStoreURL.path + suffix)
                if fm.fileExists(atPath: dst.path) { try fm.removeItem(at: dst) }
                if fm.fileExists(atPath: src.path) {
                    try fm.copyItem(at: src, to: dst)
                }
            }
            // Success: the aside copy of the old state is no longer needed.
            if movedAside { try? fm.removeItem(at: asideDir) }
            return true
        } catch {
            // Put the live trio back if the restore failed midway.
            if movedAside {
                for suffix in suffixes {
                    let asideFile = asideDir.appendingPathComponent(liveStoreURL.lastPathComponent + suffix)
                    let dst = URL(fileURLWithPath: liveStoreURL.path + suffix)
                    if fm.fileExists(atPath: asideFile.path) {
                        try? fm.removeItem(at: dst)
                        try? fm.moveItem(at: asideFile, to: dst)
                    }
                }
                try? fm.removeItem(at: asideDir)
            }
            #if DEBUG
            print("⚠️ InvoiceFlow: staged restore failed: \(error)")
            #endif
            return false
        }
    }

    /// Removes a stale staged-restore marker (e.g. snapshot was deleted).
    static func clearStagedRestore() {
        try? FileManager.default.removeItem(at: stagedRestoreURL)
    }
}

enum RollingBackupError: LocalizedError {
    case snapshotIncomplete(URL)

    var errorDescription: String? {
        switch self {
        case .snapshotIncomplete(let url):
            return "The snapshot at \(url.lastPathComponent) has no store file and cannot be restored."
        }
    }
}

private extension String {
    func deletingSuffix(_ suffix: String) -> String {
        hasSuffix(suffix) ? String(dropLast(suffix.count)) : self
    }
}

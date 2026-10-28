import Foundation
import SwiftData

/// S-001 — moves a 0.2.0 store (money as `Double`) onto the Decimal-money
/// schema.
///
/// How it works: SwiftData performs automatic lightweight migrations, and
/// `Double` → `Decimal` is a compatible attribute change (both are REAL
/// columns in SQLite), so opening the old store with the current models
/// converts the layout. What remains for this wrapper:
///
/// 1. a `store-version.json` marker next to the store records that the
///    migration happened (and guards the backup/restore paths);
/// 2. a normalization pass that rounds every migrated money value to cents
///    (REAL storage carries `Double` noise — 33.335 comes back as
///    33.334999…), making all money cent-exact from now on.
///
/// Do NOT open the store under a legacy `SchemaV1` container anywhere in the
/// same process: duplicates of the entity names collide with the live models
/// in SwiftData's schema cache (found in MigrationTests).
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

    /// True when the store was upgraded (marker written + money normalized).
    @discardableResult
    static func migrateIfNeeded(storeURL: URL) -> Bool {
        let fileManager = FileManager.default
        do {
            // A restored pre-Decimal backup snapshot lands under an already-
            // migrated marker; the caller resets the marker via markUncertain
            // so this path reruns on the next launch after a restore.
            let version = readMarker(storeURL: storeURL) ?? 1
            guard version < currentVersion else { return false }

            guard fileManager.fileExists(atPath: storeURL.path) else {
                // Brand-new store — nothing to convert, mark it current.
                writeMarker(storeURL: storeURL, version: currentVersion)
                return false
            }

            // Open with the current models: SwiftData's automatic migration
            // reconciles the Double store to the Decimal schema.
            let container = try ModelContainer(
                for: Invoice.self,
                InvoiceLineItem.self,
                Client.self,
                Company.self,
                Setting.self,
                configurations: ModelConfiguration(url: storeURL)
            )
            let context = container.mainContext
            context.autosaveEnabled = false

            normalizeMoney(context: context)
            try context.save()
            writeMarker(storeURL: storeURL, version: currentVersion)
            return true
        } catch {
            // A failed migration leaves the store untouched: the container
            // creation inside the app will surface the real error rather
            // than silently continue with mixed data.
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

    /// Used when a pre-Decimal snapshot is staged in over a migrated store,
    /// so the next `migrateIfNeeded` runs again on the restored files.
    static func markUncertain(storeURL: URL) {
        writeMarker(storeURL: storeURL, version: 1)
    }

    // MARK: - Value normalization

    /// Rounds every money value to the cent. Idempotent: the app keeps all
    /// prices and totals cent-exact from here on, so running it twice (or on
    /// an already-Decimal store after a restore) is a no-op.
    static func normalizeMoney(context: ModelContext) {
        let lineItems = (try? context.fetch(FetchDescriptor<InvoiceLineItem>())) ?? []
        for item in lineItems {
            item.price = item.price.roundedCents
            item.total = item.total.roundedCents
        }
        let invoices = (try? context.fetch(FetchDescriptor<Invoice>())) ?? []
        for invoice in invoices {
            invoice.subtotal = invoice.subtotal.roundedCents
            invoice.total = invoice.total.roundedCents
            invoice.balanceDue = invoice.balanceDue.roundedCents
        }
    }
}

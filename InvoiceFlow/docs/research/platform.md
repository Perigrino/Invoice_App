# Platform

Research for InvoiceFlow. Done 2026-10-28.
[V] verified in a source, [K] from knowledge, [U] unverified, test first.

Question: which macOS APIs, permissions, and limits does each candidate feature need?
Decision it informs: what to redesign (UI), re-architect (data/robustness), rebuild in InvoiceFlow's next version.

## Current app state (verified from repo)

- Bundle id `com.invoiceflow.app`, deployment target macOS 14.0, Swift 5.0, version 0.2.0 — `InvoiceFlow.xcodeproj/project.pbxproj`. [V]
- **No `.entitlements` file; no `CODE_SIGN_ENTITLEMENTS`** → app is currently unsandboxed. [V]
- `Info.plist` has **no URL schemes, no usage-description strings** — none registered yet. [V]
- Data: SwiftData custom store `~/Library/Application Support/InvoiceFlow/InvoiceFlow.store` with rolling backup trio at quit + `persist()` safety-net (InvoiceFlowApp.swift) [V]

## Findings

1. **PDF generation/sharing** [V](https://developer.apple.com/documentation/pdfkit/pdfview) [K, WWDC22 10089]: PDFKit is for viewing/editing; pixel-perfect invoice PDFs fit SwiftUI `ImageRenderer` or `NSPrintInfo`/`PDFPrintOperation`. `NSSharingServicePicker` (AppKit) needs no entitlement. Quick Look via `QLPreviewPanel` (responder chain), no entitlement.
2. **Due-date reminders**: UserNotifications works on macOS 10.14+, per-type authorization, no entitlement [V](https://developer.apple.com/documentation/usernotifications/unusernotificationcenter); but scheduled notifications only fire if app is registered to run [K — test]. EventKit reminders: `requestFullAccessToReminders` (macOS 14+ async), needs `NSCalendars` usage strings in Info.plist and a sandbox calendar entitlement *if* sandboxed [V](https://developer.apple.com/documentation/eventkit/ekeventstore/requestfullaccesstoreminders(completion:)).
3. **Data robustness**: mainContext autosave saves at lifecycle events, not immediately — crash between events loses edits [V](https://developer.apple.com/documentation/swiftdata/modelcontext/autosaveenabled); explicit `save()`/`transaction(block:)` per operation available [V](https://developer.apple.com/documentation/swiftdata/modelcontext/save()). Migrations: every schema version needs `VersionedSchema`; `MigrationStage.lightweight` vs `.custom` via `SchemaMigrationPlan` [V](https://developer.apple.com/documentation/swiftdata/migrationstage), [V WWDC23 10195]. Current app already has persistence regression guards + staged restore (PersistenceTests, RollingBackupService). No Apple-published pattern for backing up a custom `.store` file [K][U].
4. **Sync**: SwiftData+CloudKit requires iCloud + Background Modes capabilities + `ModelConfiguration(cloudKitDatabase: .private(...))`; public/shared DB not supported via SwiftData alone [V](https://developer.apple.com/documentation/swiftdata/syncing-model-data-across-a-persons-devices); dev-vs-prod CloudKit environment trap on direct distribution [V](https://www.hackingwithswift.com/forums/swift/thread/26080).
5. **Money/tax**: `Decimal` (base-10) is the reference type for money vs `Double` binary error; `FormatStyle.rounded(rule:increment:)` implements invoice rounding [V](https://developer.apple.com/documentation/foundation/formatstyle). Per-invoice currency should override system locale selection [K][U]. **InvoiceFlow's Invoice/InvoiceLineItem models use `Double` for all money fields today** [V — repo inspection].
6. **Spotlight/print/exports**: CoreSpotlight indexable, no entitlement, but macOS 27's `CSSearchableIndex` may be broken — AppIntents IndexedEntity works instead [V](https://developer.apple.com/forums/thread/835514). Print via `NSPrintOperation` [K]. Unsandboxed = any save path works; if sandbox adopted, add `com.apple.security.files.user-selected.read-write` [K][U].

## Decisions

1. **Decide CloudKit sync up-front**: adding it later means migrating the schema to a `VersionedSchema` with both capabilities. For a local-first v2, recommend **deferring sync** (keep export/backup as the sync story) and documenting the versioned-schema exit ramp. [V]
2. **Autosave is the invisible robustness gap**: the app does `persist()` only at quit + takes snapshots at quit; a crash loses in-flight edits. Adopt explicit `transaction { }` saves on every write path. [V](autosave docs) — addresses the "trust through reliability" research pattern.
3. **Migrate money fields from `Double` to `Decimal`** with a versioned schema migration before the rebuild grows further. [V](Foundation docs) + current code uses Double.
4. Reminders: choose UserNotifications (no permission strings, simpler UX) for v2; revisit EventKit only if users demand native Reminders tasks. [V]

## Open questions (each [U] → planned test)

- [U] Scheduled UserNotifications actually firing after app launch on macOS 14 target → probe: schedule a 2-min notification during a debug build, verify delivery.
- [U] `Decimal` migration across SwiftData lightweight migration with `Double→Decimal` same-named fields → write a PersistenceTests-style migration test on a copied store fixture.
- [U] Rolling backup integrity when store is mid-transaction at quit → simulated-crash test after the transaction refactor.
- [K][U] `QLPreviewPanel` responder-chain integration inside a SwiftUI `WindowGroup` → probe in build-and-verify snapshot run.

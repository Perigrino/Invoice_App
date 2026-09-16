import SwiftUI
import SwiftData

@main
struct InvoiceFlowApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false

    /// Kept so the app can flush pending changes to disk when it quits.
    static var sharedContainer: ModelContainer?

    /// The on-disk location of the SwiftData store (non-sandboxed default).
    /// Used by the rolling-backup service for snapshots and restores.
    static var defaultStoreURL: URL {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return appSupport.appendingPathComponent("default.store")
    }

    private let container: ModelContainer

    init() {
        // Apply a staged backup restore (if the user requested one) BEFORE
        // the container opens the store file.
        RollingBackupService.applyStagedRestoreIfAny(liveStoreURL: Self.defaultStoreURL)

        do {
            let newContainer = try ModelContainer(
                for: Invoice.self, InvoiceLineItem.self, Client.self, Company.self, Setting.self
            )
            container = newContainer
            Self.sharedContainer = newContainer
        } catch {
            fatalError("InvoiceFlow could not create its data store: \(error)")
        }
        // Belt and braces: make sure autosave is on for the shared main context.
        container.mainContext.autosaveEnabled = true
    }

    var body: some Scene {
        WindowGroup {
            if hasCompletedOnboarding {
                ContentView()
            } else {
                LandingView {
                    withAnimation(.easeInOut(duration: 0.6)) {
                        hasCompletedOnboarding = true
                    }
                }
            }
        }
        .modelContainer(container)
        .commands {
            CommandGroup(after: .newItem) {
                Button("Export Backup…") {
                    BackupCoordinator.exportBackup(from: Self.sharedContainer?.mainContext ?? container.mainContext)
                }
                .keyboardShortcut("e", modifiers: [.command, .shift])

                Button("Import Backup…") {
                    BackupCoordinator.importBackup(into: Self.sharedContainer?.mainContext ?? container.mainContext)
                }
                .keyboardShortcut("i", modifiers: [.command, .shift])
            }
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    /// Set when quitting as part of a restore flow: the current (about to be
    /// replaced) store must not be snapshotted over the backup set.
    static var suppressNextSnapshot = false

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        // Safety net: write any pending changes to disk before the process exits,
        // so data is never lost when the user closes the app.
        InvoiceFlowApp.sharedContainer?.mainContext.persist()
        // Rolling backup: snapshot the store trio, keeping the last 5.
        if !Self.suppressNextSnapshot {
            RollingBackupService.takeSnapshot(storeURL: InvoiceFlowApp.defaultStoreURL)
        }
        Self.suppressNextSnapshot = false
        return .terminateNow
    }
}

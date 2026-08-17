import SwiftUI
import SwiftData

@main
struct InvoiceFlowApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false

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
        .modelContainer(for: [Invoice.self, InvoiceLineItem.self, Client.self, Company.self, Setting.self])
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

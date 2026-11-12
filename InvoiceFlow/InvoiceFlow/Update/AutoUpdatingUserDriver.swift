#if DEBUG
import AppKit
import Sparkle

/// Debug-only driver used to prove the update path end to end without a human
/// clicking through Sparkle's window. Enabled only when the app is launched
/// with `INVOICEFLOW_AUTO_UPDATE=1`; it is compiled out of Release builds.
final class AutoUpdatingUserDriver: NSObject, SPUUserDriver {
    weak var owner: UpdateController?

    func show(_ request: SPUUpdatePermissionRequest, reply: @escaping (SUUpdatePermissionResponse) -> Void) {
        updateLog("permission requested")
        reply(SUUpdatePermissionResponse(automaticUpdateChecks: true, sendSystemProfile: false))
    }

    func showUserInitiatedUpdateCheck(cancellation: @escaping () -> Void) {
        updateLog("user-initiated check started")
    }

    func showUpdateFound(with appcastItem: SUAppcastItem, state: SPUUserUpdateState, reply: @escaping (SPUUserUpdateChoice) -> Void) {
        updateLog("showing update \(appcastItem.displayVersionString) build \(appcastItem.versionString), stage \(state.stage.rawValue) → install")
        owner?.handleFound(appcastItem)
        reply(.install)
    }

    func showUpdateReleaseNotes(with downloadData: SPUDownloadData) {
        updateLog("release notes downloaded (\(downloadData.data.count) bytes)")
    }

    func showUpdateReleaseNotesFailedToDownloadWithError(_ error: Error) {
        updateLog("release notes failed: \(error.localizedDescription)")
    }

    func showUpdateNotFoundWithError(_ error: Error, acknowledgement: @escaping () -> Void) {
        updateLog("update not found: \(error.localizedDescription)")
        owner?.handleNotFound()
        acknowledgement()
    }

    func showUpdaterError(_ error: Error, acknowledgement: @escaping () -> Void) {
        updateLog("updater error: \(error.localizedDescription)")
        owner?.handleAbort(error)
        acknowledgement()
    }

    func showDownloadInitiated(cancellation: @escaping () -> Void) {
        updateLog("download initiated")
    }

    func showDownloadDidReceiveExpectedContentLength(_ expectedContentLength: UInt64) {
        updateLog("download size \(expectedContentLength) bytes")
    }

    func showDownloadDidReceiveData(ofLength length: UInt64) {}

    func showDownloadDidStartExtractingUpdate() {
        updateLog("extracting update")
    }

    func showExtractionReceivedProgress(_ progress: Double) {}

    func showReady(toInstallAndRelaunch reply: @escaping (SPUUserUpdateChoice) -> Void) {
        updateLog("ready to install → install")
        reply(.install)
    }

    func showInstallingUpdate(withApplicationTerminated applicationTerminated: Bool, retryTerminatingApplication: @escaping () -> Void) {
        updateLog("installing (app terminated: \(applicationTerminated))")
    }

    func showUpdateInstalledAndRelaunched(_ relaunched: Bool, acknowledgement: @escaping () -> Void) {
        updateLog("installed, relaunched: \(relaunched)")
        acknowledgement()
    }

    func dismissUpdateInstallation() {
        updateLog("dismissed")
    }

    func showUpdateInFocus() {}

    func showAcknowledgement(_ acknowledgement: @escaping () -> Void) {
        acknowledgement()
    }
}
#endif

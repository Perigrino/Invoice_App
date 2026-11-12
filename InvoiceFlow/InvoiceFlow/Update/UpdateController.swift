import AppKit
import Combine
import Sparkle

/// Owns Sparkle and publishes the little bit of state our own UI needs.
///
/// Sparkle's standard user driver still runs the real check → download →
/// install flow (release notes, progress, postpone, errors). Nothing here
/// reimplements that; the banner and the Settings card only mirror it.
@MainActor
final class UpdateController: ObservableObject {
    static let shared = UpdateController()

    enum Phase: Equatable {
        case idle
        case checking
        case available
        case downloading
        case installing
        case upToDate
        case failed(String)

        var isWorking: Bool {
            switch self {
            case .checking, .downloading, .installing: return true
            default: return false
            }
        }
    }

    @Published private(set) var phase: Phase = .idle
    @Published private(set) var availableVersion: String?
    @Published private(set) var releaseNotesURL: URL?
    @Published private(set) var lastCheckDate: Date?
    @Published private(set) var canCheckForUpdates = false
    @Published private(set) var automaticChecksEnabled = true

    private let delegate: UpdateDelegate
    private let controller: SPUStandardUpdaterController
    private var cancellables: Set<AnyCancellable> = []
    #if DEBUG
    /// Kept alive for the automated Phase 0 install harness.
    private var automatedUpdater: SPUUpdater?
    #endif

    var updater: SPUUpdater { controller.updater }

    var currentVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
    }

    var currentBuild: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "—"
    }

    var isUpdateAvailable: Bool {
        if case .available = phase, availableVersion != nil { return true }
        return false
    }

    private init() {
        let delegate = UpdateDelegate()
        self.delegate = delegate
        self.controller = SPUStandardUpdaterController(
            startingUpdater: false,
            updaterDelegate: delegate,
            userDriverDelegate: nil
        )
        delegate.owner = self
        observe()
        start()
    }

    // MARK: - Actions

    /// User-initiated check. Sparkle's window takes it from here.
    func checkForUpdates() {
        guard !phase.isWorking else { return }
        phase = .checking
        controller.checkForUpdates(nil)
    }

    /// The banner's "Update…" button. Re-opening the check is how Sparkle's
    /// standard driver brings the pending update (with its release notes and
    /// Install action) back to the front.
    func showAvailableUpdate() {
        controller.checkForUpdates(nil)
    }

    func setAutomaticChecks(_ enabled: Bool) {
        updater.automaticallyChecksForUpdates = enabled
        automaticChecksEnabled = enabled
    }

    // MARK: - Wiring

    private func observe() {
        updater.publisher(for: \.canCheckForUpdates)
            .receive(on: RunLoop.main)
            .sink { [weak self] value in self?.canCheckForUpdates = value }
            .store(in: &cancellables)

        updater.publisher(for: \.automaticallyChecksForUpdates)
            .receive(on: RunLoop.main)
            .sink { [weak self] value in self?.automaticChecksEnabled = value }
            .store(in: &cancellables)

        updater.publisher(for: \.lastUpdateCheckDate)
            .receive(on: RunLoop.main)
            .sink { [weak self] value in self?.lastCheckDate = value }
            .store(in: &cancellables)
    }

    private func start() {
        guard !InvoiceFlowApp.isRunningTests else { return }

        #if DEBUG
        // Phase 0 harness: a local appcast + a driver that installs without
        // clicks, so an ad-hoc signed update can be verified end to end.
        let environment = ProcessInfo.processInfo.environment
        if environment["INVOICEFLOW_AUTO_UPDATE"] == "1" {
            runAutomatedUpdateCheck()
            return
        }
        #endif

        controller.startUpdater()
    }

    // MARK: - Events from Sparkle

    func handleFound(_ item: SUAppcastItem) {
        availableVersion = item.displayVersionString
        releaseNotesURL = item.releaseNotesURL ?? Self.releasePage(for: item.displayVersionString)
        phase = .available
        lastCheckDate = Date()
    }

    func handleNotFound() {
        availableVersion = nil
        releaseNotesURL = nil
        phase = .upToDate
        lastCheckDate = Date()
    }

    func handleChoice(_ choice: SPUUserUpdateChoice) {
        if choice == .install {
            phase = .downloading
        }
    }

    func handleDownloadFinished() {
        if phase == .downloading { phase = .installing }
    }

    func handleInstallStarted() {
        phase = .installing
    }

    func handleAbort(_ error: Error) {
        let message = Self.failureMessage(for: error)
        updateLog("aborted: \(message)")
        phase = .failed(message)
    }

    /// Sparkle reports a wrapped, generic sentence ("…please try again later")
    /// while the actual cause sits in the underlying error chain. Show both, so
    /// a failed feed fetch says it timed out instead of hiding behind the wrap.
    static func failureMessage(for error: Error) -> String {
        var chain: [NSError] = []
        var current = error as NSError
        while true {
            chain.append(current)
            guard let underlying = current.userInfo[NSUnderlyingErrorKey] as? NSError else { break }
            current = underlying
        }

        let headline = trimmedPeriod(chain[0].localizedDescription)
        // CFNetwork ends the chain with a filler node ("The operation couldn’t
        // be completed…"); the node above it carries the real reason.
        let generic = chain.dropFirst().filter { !isMeaningful($0.localizedDescription) }
        let candidates = chain.dropFirst().filter { isMeaningful($0.localizedDescription) }
        guard let detail = candidates.last ?? generic.last ?? chain.dropFirst().last else {
            return describe(headline, domain: chain[0].domain, code: chain[0].code)
        }

        let cause = trimmedPeriod(detail.localizedDescription)
        if headline.localizedCaseInsensitiveContains(cause) {
            return describe(headline, domain: detail.domain, code: detail.code)
        }
        return "\(headline). Cause: \(describe(cause, domain: detail.domain, code: detail.code))"
    }

    /// Appends domain and code unless the sentence already names them.
    private static func describe(_ text: String, domain: String, code: Int) -> String {
        guard !text.localizedCaseInsensitiveContains(domain) else { return text }
        return "\(text) (\(domain) \(code))"
    }

    private static func isMeaningful(_ text: String) -> Bool {
        let lowercased = text.lowercased()
        return !(lowercased.contains("couldn") && lowercased.contains("be completed"))
    }

    private static func trimmedPeriod(_ text: String) -> String {
        var result = text.trimmingCharacters(in: .whitespacesAndNewlines)
        while result.hasSuffix(".") { result.removeLast() }
        return result
    }

    /// Fallback link when an appcast item carries no `releaseNotesLink`.
    static func releasePage(for version: String?) -> URL? {
        guard let version, !version.isEmpty else { return nil }
        return URL(string: "https://github.com/Perigrino/Invoice_App/releases/tag/v\(version)")
    }

    #if DEBUG
    /// Snapshot-test seam: renders the banner in its "update available" state
    /// without touching Sparkle.
    func debugPresentUpdate(version: String, notes: URL?) {
        availableVersion = version
        releaseNotesURL = notes
        phase = .available
    }

    private func runAutomatedUpdateCheck() {
        let driver = AutoUpdatingUserDriver()
        driver.owner = self
        let updater = SPUUpdater(
            hostBundle: .main,
            applicationBundle: .main,
            userDriver: driver,
            delegate: delegate
        )
        automatedUpdater = updater
        phase = .checking
        do {
            try updater.start()
            updater.checkForUpdates()
        } catch {
            updateLog("failed to start AutomatedUpdater: \(error.localizedDescription)")
            phase = .failed(error.localizedDescription)
        }
    }
    #endif
}

// MARK: - Sparkle delegate

final class UpdateDelegate: NSObject, SPUUpdaterDelegate {
    weak var owner: UpdateController?

    /// Debug builds can be pointed at a local or alternate feed, which is how
    /// the release flow is rehearsed without touching the shipped feed URL.
    func feedURLString(for updater: SPUUpdater) -> String? {
        #if DEBUG
        if let override = ProcessInfo.processInfo.environment["INVOICEFLOW_FEED_URL"],
           !override.isEmpty {
            updateLog("using feed override \(override)")
            return override
        }
        #endif
        return nil
    }

    func updater(_ updater: SPUUpdater, didFindValidUpdate item: SUAppcastItem) {
        updateLog("found \(item.displayVersionString) (build \(item.versionString))")
        owner?.handleFound(item)
    }

    func updaterDidNotFindUpdate(_ updater: SPUUpdater) {
        updateLog("no update found")
        owner?.handleNotFound()
    }

    func updater(_ updater: SPUUpdater, userDidMake choice: SPUUserUpdateChoice, forUpdate updateItem: SUAppcastItem, state: SPUUserUpdateState) {
        updateLog("user choice \(choice.rawValue) at stage \(state.stage.rawValue)")
        owner?.handleChoice(choice)
    }

    func updater(_ updater: SPUUpdater, didDownloadUpdate item: SUAppcastItem) {
        updateLog("downloaded \(item.displayVersionString)")
        owner?.handleDownloadFinished()
    }

    func updater(_ updater: SPUUpdater, willInstallUpdate item: SUAppcastItem) {
        updateLog("installing \(item.displayVersionString)")
        owner?.handleInstallStarted()
    }

    func updater(_ updater: SPUUpdater, didAbortWithError error: Error) {
        updateLog("aborted: \(error.localizedDescription)")
        owner?.handleAbort(error)
    }

    func updater(_ updater: SPUUpdater, didFinishUpdateCycleFor updateCheck: SPUUpdateCheck, error: Error?) {
        if let error {
            updateLog("cycle failed: \(error.localizedDescription)")
            owner?.handleAbort(error)
        } else {
            updateLog("cycle finished (check \(updateCheck.rawValue))")
        }
    }
}

/// Line log shared by the delegate and the debug harness. Lives outside the
/// bundle so it can be read after the app has relaunched itself into a new
/// version.
func updateLog(_ message: String) {
    let path = ProcessInfo.processInfo.environment["INVOICEFLOW_UPDATE_LOG"]
        ?? NSTemporaryDirectory() + "invoiceflow-update.log"
    let line = "\(Date().formatted(date: .omitted, time: .standard))  \(message)\n"
    if let handle = FileHandle(forWritingAtPath: path) {
        handle.seekToEndOfFile()
        handle.write(Data(line.utf8))
        try? handle.close()
    } else {
        try? line.write(toFile: path, atomically: true, encoding: .utf8)
    }
    NSLog("InvoiceFlow update: %@", message)
}

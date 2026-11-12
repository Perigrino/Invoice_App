import SwiftUI

/// Slim, dismissible strip in the detail column when a new version exists.
/// Never steals focus, never appears twice for the same build.
struct UpdateBanner: View {
    @ObservedObject var updates: UpdateController
    @AppStorage("dismissedUpdateVersion") private var dismissedVersion = ""

    private var version: String? {
        guard let version = updates.availableVersion, version != dismissedVersion else { return nil }
        return version
    }

    var body: some View {
        if let version {
            HStack(spacing: 12) {
                Image(systemName: "arrow.down.circle.fill")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(Theme.accent)

                VStack(alignment: .leading, spacing: 1) {
                    Text("InvoiceFlow \(version) is available")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundColor(Theme.textPrimary)
                    Text(updates.phase == .downloading || updates.phase == .installing
                         ? "Downloading the update…"
                         : "Your invoices and clients stay exactly where they are.")
                        .font(.system(size: 11.5))
                        .foregroundColor(Theme.textSecondary)
                }

                Spacer(minLength: 12)

                if let notes = updates.releaseNotesURL {
                    Button("What's new") { NSWorkspace.shared.open(notes) }
                        .buttonStyle(.plain)
                        .capsuleButton(.ghost, small: true)
                }

                Button("Update…") { updates.showAvailableUpdate() }
                    .buttonStyle(.plain)
                    .capsuleButton(.primary, small: true)
                    .disabled(updates.phase.isWorking)

                Button {
                    dismissedVersion = version
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 9.5, weight: .semibold))
                        .foregroundColor(Theme.textMuted)
                        .frame(width: 22, height: 22)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help("Not now")
                .accessibilityLabel("Dismiss update notice")
            }
            .padding(.leading, 14)
            .padding(.trailing, 8)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: Theme.radiusControl + 2, style: .continuous)
                    .fill(Theme.chip)
            )
            .overlay {
                RoundedRectangle(cornerRadius: Theme.radiusControl + 2, style: .continuous)
                    .strokeBorder(Theme.hairline, lineWidth: 1)
            }
            .padding(.horizontal, 28)
            .padding(.top, 6)
            .transition(.opacity.combined(with: .move(edge: .top)))
            .animation(Theme.quick, value: updates.availableVersion)
        }
    }
}

/// Settings → General → Updates. Reuses the existing row chrome so it reads as
/// part of the page rather than a new surface.
struct UpdateSettingsCard: View {
    @ObservedObject var updates: UpdateController

    private var lastCheckedText: String {
        guard let date = updates.lastCheckDate else { return "Not checked yet" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private var statusText: String {
        switch updates.phase {
        case .available: return "\(updates.availableVersion ?? "Update") available"
        case .checking: return "Checking…"
        case .downloading: return "Downloading…"
        case .installing: return "Installing…"
        case .upToDate: return "Up to date"
        case .failed: return "Check failed"
        case .idle: return "Idle"
        }
    }

    var body: some View {
        SettingsCard {
            SettingsCardHeader(title: "Updates")
            SettingRow(
                "Version",
                description: "InvoiceFlow \(updates.currentVersion) (build \(updates.currentBuild))."
            ) {
                StatusPill(text: statusText)
            }
            SettingRow(
                "Check automatically",
                description: "Looks for a new version once a day in the background."
            ) {
                Toggle("", isOn: Binding(
                    get: { updates.automaticChecksEnabled },
                    set: { updates.setAutomaticChecks($0) }
                ))
                .labelsHidden()
                .toggleStyle(GlassToggleStyle())
            }
            SettingRow(
                "Check for updates",
                description: "Download and install a new version without leaving the app."
            ) {
                if updates.isUpdateAvailable, let notes = updates.releaseNotesURL {
                    Button("What's new") { NSWorkspace.shared.open(notes) }
                        .buttonStyle(.plain)
                        .capsuleButton(.ghost, small: true)
                }
                Button("Check Now") { updates.checkForUpdates() }
                    .buttonStyle(.plain)
                    .capsuleButton(.plain, small: true)
                    .disabled(!updates.canCheckForUpdates)
            }
            SettingRow("Last checked", showsDivider: false) {
                Text(lastCheckedText)
                    .font(.system(size: 11.5))
                    .foregroundColor(Theme.textSecondary)
                if case let .failed(message) = updates.phase {
                    Text(message)
                        .font(.system(size: 11))
                        .foregroundColor(Theme.negative)
                        .lineLimit(2)
                }
            }
        }
    }
}

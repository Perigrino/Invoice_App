import SwiftUI
import SwiftData
import AppKit

struct SettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(filter: #Predicate<Setting> { $0.isActive }) private var activeSettings: [Setting]
    @Query(sort: \Setting.profileName) private var allSettings: [Setting]
    @State private var selectedTab = 0
    @State private var setting: Setting?
    @State private var isLoading = true

    private var currentSetting: Setting? {
        setting ?? activeSettings.first ?? allSettings.first
    }

    /// Prototype `.tabstrip`: inline capsule container (chip bg + hairline
    /// border), accent-gradient pill on the active tab.
    private var tabstrip: some View {
        HStack(spacing: 4) {
            tabButton("Profile", icon: "person.2", tag: 0)
            tabButton("Invoice", icon: "doc.text", tag: 1)
            tabButton("Currency", icon: "dollarsign.circle", tag: 2)
            tabButton("General", icon: "gearshape", tag: 3)
        }
        .padding(4)
        .background(Capsule().fill(Theme.chip))
        .overlay { Capsule().strokeBorder(Theme.hairline, lineWidth: 1) }
        .animation(Theme.quick, value: selectedTab)
    }

    private func tabButton(_ title: String, icon: String, tag: Int) -> some View {
        let isActive = selectedTab == tag
        return Button {
            withAnimation(Theme.quick) { selectedTab = tag }
        } label: {
            HStack(spacing: 7) {
                Image(systemName: icon).font(.system(size: 12, weight: .medium))
                Text(title).font(.system(size: 12, weight: isActive ? .semibold : .medium))
            }
            .foregroundColor(isActive ? Theme.onAccent : Theme.textSecondary)
            .padding(.horizontal, 16)
            .padding(.vertical, 7)
            .background {
                if isActive {
                    Capsule().fill(Theme.gradient)
                        .shadow(color: Theme.palette.glowStrong, radius: 8, x: 0, y: 3)
                }
            }
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    var body: some View {
        Group {
            if let setting = currentSetting {
                VStack(spacing: 0) {
                    PageHeader("Settings", subtitle: "Configure your invoice preferences.") {
                        profileMenu
                    }
                    .padding(.horizontal, 28)
                    .padding(.top, 22)

                    // Prototype `.tabstrip`: one dark capsule, inline width,
                    // accent-gradient pill on the active tab.
                    tabstrip
                        .padding(.horizontal, 28)
                        .padding(.top, 14)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Group {
                        switch selectedTab {
                        case 0: ProfileSettingsView(
                            setting: setting,
                            profiles: allSettings,
                            onSwitch: switchProfile,
                            onCreate: createProfile
                        )
                        case 1: InvoiceSettingsView(setting: setting)
                        case 2: CurrencySettingsView(setting: setting)
                        default: GeneralSettingsView(setting: setting)
                        }
                    }
                    .padding(.horizontal, 28)
                    .padding(.top, 20)
                    .padding(.bottom, 24)
                    .frame(maxHeight: .infinity)
                }
            } else if isLoading {
                VStack(spacing: 12) {
                    ProgressView()
                    Text("Loading settings...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .navigationTitle("Settings")
        .task { await loadSetting() }
    }

    // MARK: - Profile menu (prototype: "Default profile" header action)

    private var profileMenu: some View {
        Menu {
            ForEach(allSettings) { s in
                Button {
                    switchProfile(s)
                } label: {
                    HStack {
                        Text(s.profileName)
                        if s.isActive {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
            Divider()
            Button {
                createProfile()
            } label: {
                Label("New Profile", systemImage: "plus")
            }
            if allSettings.count > 1, let active = setting {
                Button(role: .destructive) {
                    deleteProfile(active)
                } label: {
                    Label("Delete \"\(active.profileName)\"", systemImage: "trash")
                }
            }
        } label: {
            HStack(spacing: 7) {
                Image(systemName: "person.2")
                    .font(.system(size: 12, weight: .medium))
                Text(setting?.profileName ?? "Default")
                    .font(.system(size: 12.5, weight: .medium))
                Image(systemName: "chevron.right")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundColor(Theme.textMuted)
            }
            .foregroundColor(Theme.textPrimary)
            .padding(.horizontal, 6)
            .fixedSize()
        }
        .menuIndicator(.hidden)
        .fixedSize()
    }

    private func loadSetting() async {
        let existing = (try? modelContext.fetch(FetchDescriptor<Setting>())) ?? []
        if let active = existing.first(where: { $0.isActive }) {
            setting = active
        } else if let first = existing.first {
            setting = first
        } else {
            let newSetting = Setting()
            modelContext.insert(newSetting)
            try? modelContext.save()
            setting = newSetting
        }
        isLoading = false
        if let active = setting {
            applySettingsGlobals(active)
        }
    }

    private func switchProfile(_ s: Setting) {
        for setting in allSettings { setting.isActive = false }
        s.isActive = true
        setting = s
        applySettingsGlobals(s)
        modelContext.persist()
    }

    private func createProfile() {
        let count = allSettings.count
        let new = Setting(profileName: "Profile \(count + 1)", isActive: false)
        modelContext.insert(new)
        switchProfile(new)
    }

    private func deleteProfile(_ s: Setting) {
        let remaining = allSettings.filter { $0.id != s.id }
        modelContext.delete(s)
        modelContext.persist()
        if let next = remaining.first {
            switchProfile(next)
        }
    }
}// MARK: - Shared row/section helpers

/// Prototype `.setting-row`: label + description left, control right, hairline
/// separator below.
struct SettingRow<Trailing: View>: View {
    let label: String
    var description: String? = nil
    var showsDivider: Bool = true
    private let trailing: Trailing

    init(
        _ label: String,
        description: String? = nil,
        showsDivider: Bool = true,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.label = label
        self.description = description
        self.showsDivider = showsDivider
        self.trailing = trailing()
    }

    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundColor(Theme.textPrimary)
                if let description {
                    Text(description)
                        .font(.system(size: 11))
                        .foregroundColor(Theme.textMuted)
                }
            }
            Spacer(minLength: 12)
            HStack(spacing: 8) { trailing }
                .foregroundColor(Theme.textSecondary)
        }
        .padding(.vertical, 11)
        .padding(.horizontal, 2)
        .overlay(alignment: .bottom) {
            if showsDivider {
                Rectangle().fill(Theme.rowSeparator).frame(height: 1)
            }
        }
    }
}

/// Section group wrapping `SettingRow`s. No card surface: the rows sit
/// directly on the page canvas so settings don't read as stacked grey boxes.
struct SettingsCard<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
    }
}

/// Section heading inside a card (prototype `.section-label`).
struct SettingsCardHeader: View {
    let title: String
    var body: some View {
        SectionLabel(title)
            .padding(.top, 12)
            .padding(.bottom, 2)
    }
}

/// Mutually-exclusive choice group rendered as the prototype's chips
/// (`.chip` / `.chip.is-filled` inside `.sr-value`).
struct SettingsChips<Value: Hashable>: View {
    let options: [(label: String, value: Value)]
    @Binding var selection: Value

    var body: some View {
        HStack(spacing: 8) {
            ForEach(options, id: \.value) { option in
                Button {
                    selection = option.value
                } label: {
                    Text(option.label)
                        .font(.system(size: 11.5, weight: selection == option.value ? .semibold : .medium))
                        .foregroundColor(selection == option.value ? Theme.onAccent : Theme.textSecondary)
                        .padding(.horizontal, 12)
                        .frame(height: 26)
                        .background(
                            Capsule().fill(
                                selection == option.value
                                    ? AnyShapeStyle(Theme.gradient)
                                    : AnyShapeStyle(Theme.chip)
                            )
                        )
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Profile Settings

struct ProfileSettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Bindable var setting: Setting

    /// Profile management (prototype's "Profiles" card) — wired by the parent.
    var profiles: [Setting] = []
    var onSwitch: (Setting) -> Void = { _ in }
    var onCreate: () -> Void = {}

    @State private var companyName = ""
    @State private var companyEmail = ""
    @State private var companyPhone = ""
    @State private var companyAddress = ""
    @State private var companyWebsite = ""
    @State private var saved = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                SettingsCard {
                    SettingsCardHeader(title: "Logo")
                    if let data = setting.logoData, let nsImage = NSImage(data: data) {
                        VStack(spacing: 14) {
                            Image(nsImage: nsImage)
                                .resizable()
                                .interpolation(.high)
                                .scaledToFit()
                                .frame(maxWidth: .infinity)
                                .frame(height: 300)
                                .background(Theme.field)
                                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusControl, style: .continuous))
                                .overlay {
                                    RoundedRectangle(cornerRadius: Theme.radiusControl, style: .continuous)
                                        .strokeBorder(Theme.hairline, lineWidth: 1)
                                }
                            logoActions
                        }
                        .padding(.top, 2)
                    } else {
                        // Prototype layout: 74 × 74 dashed box + copy + action.
                        HStack(alignment: .top, spacing: 14) {
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(Theme.placeholder)
                                .frame(width: 74, height: 74)
                                .overlay {
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .strokeBorder(Theme.controlBorder, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                                    Image(systemName: "photo")
                                        .font(.system(size: 18, weight: .light))
                                        .foregroundColor(Theme.textMuted)
                                }
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Company logo")
                                    .font(.system(size: 12.5, weight: .medium))
                                    .foregroundColor(Theme.textPrimary)
                                Text("PNG or JPG, recommended 512×512. Shown in the app and on exported PDFs.")
                                    .font(.system(size: 11))
                                    .foregroundColor(Theme.textMuted)
                                    .fixedSize(horizontal: false, vertical: true)
                                logoActions
                                    .padding(.top, 6)
                            }
                            Spacer(minLength: 0)
                        }
                        .padding(.top, 2)
                    }
                }

                SettingsCard {
                    SettingsCardHeader(title: "Company Information")
                    VStack(spacing: 14) {
                        HStack(alignment: .top, spacing: 18) {
                            field(label: "Company Name", placeholder: "Acme Inc.", text: $companyName)
                            field(label: "Company Email", placeholder: "billing@acme.com", text: $companyEmail)
                        }
                        HStack(alignment: .top, spacing: 18) {
                            field(label: "Phone", placeholder: "+1 (555) 000-0000", text: $companyPhone)
                            field(label: "Website", placeholder: "acmestudio.co", text: $companyWebsite)
                        }
                        field(label: "Address", placeholder: "14 Ridgeway Terrace, Lisbon, Portugal", text: $companyAddress, multiline: true)
                    }
                    .padding(.bottom, 2)
                }

                SettingsCard {
                    SettingsCardHeader(title: "Profiles")
                    SettingRow(
                        "Active profile",
                        description: "Settings profiles let you keep separate businesses or brands."
                    ) {
                        Text(setting.profileName)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(Theme.onAccent)
                            .padding(.horizontal, 10)
                            .frame(height: 22)
                            .background(Capsule().fill(Theme.gradient))
                    }
                    SettingRow(
                        "Manage profiles",
                        description: "Create a new profile or remove the current one.",
                        showsDivider: false
                    ) {
                        Button(action: onCreate) {
                            Label("New Profile", systemImage: "plus")
                        }
                        .buttonStyle(.plain)
                        .capsuleButton(.plain, small: true)
                        Menu {
                            ForEach(profiles) { profile in
                                Button(profile.profileName) { onSwitch(profile) }
                            }
                            Divider()
                            Button("New Profile", action: onCreate)
                        } label: {
                            Image(systemName: "ellipsis")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(Theme.textSecondary)
                                .frame(width: 26, height: 26)
                                .background(Capsule().fill(Theme.chip))
                                .overlay { Capsule().strokeBorder(Theme.hairline, lineWidth: 1) }
                        }
                        .menuIndicator(.hidden)
                    }
                }

                HStack {
                    Spacer()
                    if saved {
                        Label("Saved", systemImage: "checkmark.circle.fill")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(Theme.positive)
                            .transition(.opacity)
                    }
                    Button("Save Profile") { saveProfile() }
                        .buttonStyle(.plain)
                        .capsuleButton(.primary)
                        .keyboardShortcut(.defaultAction)
                }
            }
            .padding(.top, 4)
        }
        .onAppear { loadProfile() }
    }

    /// Prototype `.field`: uppercase label over a glass input.
    private func field(label: String, placeholder: String, text: Binding<String>, multiline: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).modifier(FieldLabelStyle())
            if multiline {
                TextField(placeholder, text: text, axis: .vertical)
                    .lineLimit(2...6)
                    .textFieldStyle(GlassFieldMultilineStyle())
            } else {
                TextField(placeholder, text: text)
                    .textFieldStyle(GlassFieldStyle())
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var logoActions: some View {
        HStack(spacing: 8) {
            Button("Choose file…") { pickLogo() }
                .buttonStyle(.plain)
                .capsuleButton(.plain, small: true)
            if setting.logoData != nil {
                Button("Remove") {
                    setting.logoData = nil
                    modelContext.persist()
                }
                .buttonStyle(.plain)
                .capsuleButton(.plain, small: true)
                .foregroundColor(Theme.negative)
            }
        }
    }

    private func loadProfile() {
        companyName = (setting.companyName ?? "").isEmpty ? setting.profileName : setting.companyName ?? ""
        companyEmail = setting.companyEmail ?? ""
        companyPhone = setting.companyPhone ?? ""
        companyAddress = setting.companyAddress ?? ""
        companyWebsite = setting.companyWebsite ?? ""
    }

    private func saveProfile() {
        setting.profileName = companyName.isEmpty ? "Default" : companyName
        setting.companyName = companyName
        setting.companyEmail = companyEmail
        setting.companyPhone = companyPhone
        setting.companyAddress = companyAddress
        setting.companyWebsite = companyWebsite
        modelContext.persist()
        saved = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            withAnimation { saved = false }
        }
    }

    private func pickLogo() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.image]
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let url = panel.url, let data = try? Data(contentsOf: url) {
            setting.logoData = data
            modelContext.persist()
        }
    }
}

// MARK: - Invoice Settings

struct InvoiceSettingsView: View {
    @Bindable var setting: Setting
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                SettingsCard {
                    SettingsCardHeader(title: "PDF Template")
                    SettingRow("Template", description: "Applied to exported PDFs.") {
                        SettingsChips(
                            options: [("Dark", "dark"), ("Light", "light")],
                            selection: $setting.template
                        )
                    }
                    SettingRow("Paper Size", showsDivider: false) {
                        SettingsChips(
                            options: [("A3", "A3"), ("A4", "A4"), ("Letter", "Letter"), ("Legal", "Legal")],
                            selection: $setting.paperSize
                        )
                    }
                }

                SettingsCard {
                    SettingsCardHeader(title: "Colors")
                    SettingRow("Accent Color", description: "Primary brand colour on the PDF.") {
                        ColorPicker("", selection: accentBinding, supportsOpacity: false)
                            .labelsHidden()
                    }
                    SettingRow("Secondary Color", description: "Used for the gradient and headings.", showsDivider: false) {
                        ColorPicker("", selection: secondaryBinding, supportsOpacity: false)
                            .labelsHidden()
                    }
                }

                SettingsCard {
                    SettingsCardHeader(title: "Document Options")
                    SettingRow("Show invoice number") {
                        Toggle("", isOn: $setting.showInvoiceId).labelsHidden().toggleStyle(GlassToggleStyle())
                    }
                    SettingRow("Show due date") {
                        Toggle("", isOn: $setting.showDueDate).labelsHidden().toggleStyle(GlassToggleStyle())
                    }
                    SettingRow("Show currency") {
                        Toggle("", isOn: $setting.showCurrency).labelsHidden().toggleStyle(GlassToggleStyle())
                    }
                    SettingRow("Show discount") {
                        Toggle("", isOn: $setting.showDiscount).labelsHidden().toggleStyle(GlassToggleStyle())
                    }
                    SettingRow("Show tax") {
                        Toggle("", isOn: $setting.showTax).labelsHidden().toggleStyle(GlassToggleStyle())
                    }
                    SettingRow("Show notes") {
                        Toggle("", isOn: $setting.showNote).labelsHidden().toggleStyle(GlassToggleStyle())
                    }
                    SettingRow("Default notes", showsDivider: false) {
                        TextField("Thank you for your business!", text: $setting.notes, axis: .vertical)
                            .lineLimit(2...8)
                            .textFieldStyle(GlassFieldMultilineStyle())
                            .frame(maxWidth: 360)
                    }
                    .padding(.bottom, 10)
                }
            }
            .padding(.top, 4)
            // Persist settings edits as they happen; autosave is unreliable here.
            .onChange(of: setting.showInvoiceId) { _, _ in modelContext.persist() }
            .onChange(of: setting.showDueDate) { _, _ in modelContext.persist() }
            .onChange(of: setting.showCurrency) { _, _ in modelContext.persist() }
            .onChange(of: setting.showDiscount) { _, _ in modelContext.persist() }
            .onChange(of: setting.showTax) { _, _ in modelContext.persist() }
            .onChange(of: setting.showNote) { _, _ in modelContext.persist() }
            .onChange(of: setting.template) { _, _ in modelContext.persist() }
            .onChange(of: setting.paperSize) { _, _ in modelContext.persist() }
            .onChange(of: setting.pdfAccentColor) { _, _ in modelContext.persist() }
            .onChange(of: setting.pdfSecondaryColor) { _, _ in modelContext.persist() }
            .onChange(of: setting.notes) { _, _ in modelContext.persist() }
        }
    }

    private var accentBinding: Binding<Color> {
        Binding(
            get: { Color(hex: setting.pdfAccentColor.replacingOccurrences(of: "#", with: "")) },
            set: { color in
                let nsColor = NSColor(color)
                let rgb = nsColor.usingColorSpace(.sRGB) ?? nsColor
                setting.pdfAccentColor = String(
                    format: "#%02X%02X%02X",
                    Int(rgb.redComponent * 255), Int(rgb.greenComponent * 255), Int(rgb.blueComponent * 255)
                )
            }
        )
    }

    private var secondaryBinding: Binding<Color> {
        Binding(
            get: { Color(hex: setting.pdfSecondaryColor.replacingOccurrences(of: "#", with: "")) },
            set: { color in
                let nsColor = NSColor(color)
                let rgb = nsColor.usingColorSpace(.sRGB) ?? nsColor
                setting.pdfSecondaryColor = String(
                    format: "#%02X%02X%02X",
                    Int(rgb.redComponent * 255), Int(rgb.greenComponent * 255), Int(rgb.blueComponent * 255)
                )
            }
        )
    }
}

// MARK: - Currency Settings

struct CurrencySettingsView: View {
    @Bindable var setting: Setting
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                SettingsCard {
                    SettingsCardHeader(title: "Currency")
                    SettingRow("Currency", description: "Used for totals and exported PDFs.") {
                        SettingsChips(
                            options: ["USD", "EUR", "GBP", "GHS", "CAD", "NGN", "ZAR"].map { ($0, $0) },
                            selection: $setting.currency
                        )
                    }
                    SettingRow("Thousands separator") {
                        SettingsChips(
                            options: [("Comma", "comma"), ("Dot", "dot"), ("Space", "space")],
                            selection: $setting.separator
                        )
                    }
                    SettingRow("Decimal places") {
                        SettingsChips(
                            options: [0, 1, 2, 3, 4].map { ("\($0)", $0) },
                            selection: $setting.decimalPlaces
                        )
                    }
                    SettingRow("Symbol placement", showsDivider: false) {
                        SettingsChips(
                            options: [("Before", "before"), ("After", "after")],
                            selection: $setting.signPlacement
                        )
                    }
                }

                SettingsCard {
                    SettingsCardHeader(title: "Preview")
                    HStack(alignment: .firstTextBaseline, spacing: 14) {
                        Text(CurrencyFormatter.shared.string(from: 4820.0))
                            .font(.system(size: 26, weight: .bold))
                            .monospacedDigit()
                            .foregroundColor(Theme.textPrimary)
                        Text("\(setting.currency) · \(setting.separator) · \(setting.decimalPlaces) dp · \(setting.signPlacement)")
                            .font(.system(size: 12))
                            .foregroundColor(Theme.textMuted)
                        Spacer()
                    }
                    .padding(.vertical, 10)
                    .padding(.bottom, 10)
                }
            }
            .padding(.top, 4)
            .onChange(of: setting.currency) { _, _ in modelContext.persist() }
            .onChange(of: setting.separator) { _, _ in modelContext.persist() }
            .onChange(of: setting.decimalPlaces) { _, _ in modelContext.persist() }
            .onChange(of: setting.signPlacement) { _, _ in modelContext.persist() }
            .onChange(of: setting.dateFormat) { _, _ in modelContext.persist() }
        }
    }
}

// MARK: - General Settings

struct GeneralSettingsView: View {
    @Bindable var setting: Setting
    @Environment(\.modelContext) private var modelContext
    @State private var exportPath: String = ""
    @State private var snapshots: [URL] = []
    @State private var pendingRestore = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                SettingsCard {
                    SettingRow("Dark Mode", description: "Switch the whole app between the dark and light appearance.") {
                        Toggle("", isOn: $setting.darkMode).labelsHidden().toggleStyle(GlassToggleStyle())
                    }
                    SettingRow("Date Format") {
                        SettingsChips(
                            options: ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD", "DD MMM YYYY"].map { ($0, $0) },
                            selection: $setting.dateFormat
                        )
                    }
                    SettingRow("Language") {
                        Picker("", selection: $setting.language) {
                            Text("English").tag("en")
                            Text("Français").tag("fr")
                            Text("Español").tag("es")
                            Text("العربية").tag("ar")
                        }
                        .labelsHidden()
                        .tint(Theme.accent)
                    }
                    SettingRow("Export Folder", description: "PDFs will be saved to this folder when exporting.", showsDivider: false) {
                        Button("Choose...") { chooseExportFolder() }
                            .buttonStyle(.plain)
                            .capsuleButton(.plain, small: true)
                        HStack(spacing: 6) {
                            Image(systemName: "folder")
                                .font(.system(size: 11))
                                .foregroundColor(Theme.textMuted)
                            Text(exportPath.isEmpty ? "~/Documents" : exportPath)
                                .font(.system(size: 11.5))
                                .foregroundColor(Theme.textSecondary)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                        .padding(.horizontal, 10)
                        .frame(height: 30)
                        .background(RoundedRectangle(cornerRadius: Theme.radiusControl, style: .continuous).fill(Theme.field))
                        .overlay {
                            RoundedRectangle(cornerRadius: Theme.radiusControl, style: .continuous)
                                .strokeBorder(Theme.hairline, lineWidth: 1)
                        }
                    }
                }

                SettingsCard {
                    SettingsCardHeader(title: "Data")
                    SettingRow(
                        "Export & import",
                        description: "Export saves every client, invoice, and settings profile as a JSON file you can re-import later."
                    ) {
                        Button("Export JSON") {
                            BackupCoordinator.exportBackup(from: modelContext)
                        }
                        .buttonStyle(.plain)
                        .capsuleButton(.plain, small: true)
                        Button("Import JSON") {
                            BackupCoordinator.importBackup(into: modelContext)
                        }
                        .buttonStyle(.plain)
                        .capsuleButton(.plain, small: true)
                    }
                    SettingRow(
                        "Rolling backups",
                        description: "A snapshot of your data is saved every time the app quits. The last \(RollingBackupService.keepCount) are kept.",
                        showsDivider: false
                    ) {
                        StatusPill(text: "\(snapshots.count) snapshot\(snapshots.count == 1 ? "" : "s")")
                    }

                    if pendingRestore {
                        HStack(spacing: 8) {
                            Image(systemName: "clock.arrow.circlepath")
                                .foregroundColor(Theme.warning)
                            Text("A restore is scheduled — it will apply the next time the app launches.")
                                .font(.system(size: 11.5))
                                .foregroundColor(Theme.textSecondary)
                            Spacer()
                            Button("Cancel Restore") {
                                RollingBackupService.clearStagedRestore()
                                refreshSnapshots()
                            }
                            .buttonStyle(.plain)
                            .capsuleButton(.plain, small: true)
                        }
                        .padding(.vertical, 10)
                    }

                    if snapshots.isEmpty {
                        Text("No snapshots yet — one will be created the next time you quit the app.")
                            .font(.system(size: 11.5))
                            .foregroundColor(Theme.textMuted)
                            .padding(.vertical, 8)
                    } else {
                        ForEach(snapshots.reversed(), id: \.absoluteString) { snapshot in
                            HStack(spacing: 10) {
                                Image(systemName: "externaldrive.badge.timemachine")
                                    .foregroundColor(Theme.textMuted)
                                Text(snapshotLabel(snapshot))
                                    .font(.system(size: 11.5))
                                    .foregroundColor(Theme.textSecondary)
                                Spacer()
                                Button("Restore") { confirmRestore(snapshot) }
                                    .buttonStyle(.plain)
                                    .capsuleButton(.plain, small: true)
                            }
                            .padding(.vertical, 8)
                            .overlay(alignment: .bottom) {
                                Rectangle().fill(Theme.rowSeparator).frame(height: 1)
                            }
                        }
                    }

                    HStack {
                        Button("Show in Finder") {
                            NSWorkspace.shared.activateFileViewerSelecting([RollingBackupService.backupsDirectory])
                        }
                        .buttonStyle(.plain)
                        .capsuleButton(.plain, small: true)
                        Spacer()
                    }
                    .padding(.vertical, 10)
                }
            }
            .padding(.top, 4)
            .onChange(of: setting.darkMode) { _, _ in modelContext.persist() }
            .onChange(of: setting.language) { _, _ in modelContext.persist() }
        }
        .onAppear {
            exportPath = setting.exportPath ?? ""
            refreshSnapshots()
        }
        .onChange(of: exportPath) { _, newValue in
            setting.exportPath = newValue
            modelContext.persist()
        }
    }

    // MARK: Automatic snapshots

    private func refreshSnapshots() {
        snapshots = RollingBackupService.snapshots()
        pendingRestore = FileManager.default.fileExists(atPath: RollingBackupService.stagedRestoreURL.path)
    }

    private func snapshotLabel(_ snapshot: URL) -> String {
        if let date = RollingBackupService.snapshotDate(snapshot) {
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            formatter.timeStyle = .short
            return formatter.string(from: date)
        }
        return snapshot.lastPathComponent
    }

    private func confirmRestore(_ snapshot: URL) {
        let alert = NSAlert()
        alert.messageText = "Restore snapshot?"
        alert.informativeText = """
            Your current clients and invoices will be replaced by the snapshot from \(snapshotLabel(snapshot)) the next time InvoiceFlow launches.

            Continue?
            """
        alert.addButton(withTitle: "Restore & Quit")
        alert.addButton(withTitle: "Cancel")
        alert.alertStyle = .warning
        guard alert.runModal() == .alertFirstButtonReturn else { return }

        do {
            try RollingBackupService.stageRestore(snapshot: snapshot)
            // Don't snapshot the doomed store over the backup set on the way out.
            AppDelegate.suppressNextSnapshot = true
            let confirm = NSAlert()
            confirm.messageText = "Restore scheduled"
            confirm.informativeText = "InvoiceFlow will now quit. Reopen it to complete the restore."
            confirm.alertStyle = .informational
            confirm.runModal()
            NSApp.terminate(nil)
        } catch {
            presentRestoreError(error)
        }
    }

    private func presentRestoreError(_ error: Error) {
        let alert = NSAlert()
        alert.messageText = "Restore failed"
        alert.informativeText = error.localizedDescription
        alert.alertStyle = .critical
        alert.runModal()
    }

    private func chooseExportFolder() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let url = panel.url {
            exportPath = url.path
            setting.exportPath = url.path
        }
    }
}

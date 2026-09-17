import SwiftUI
import SwiftData

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

    var body: some View {
        Group {
            if let setting = currentSetting {
                VStack(spacing: 0) {
                    TabView(selection: $selectedTab) {
                        ProfileSettingsView(setting: setting)
                            .tabItem { Label("Profile", systemImage: "person.circle") }
                            .tag(0)
                        InvoiceSettingsView(setting: setting)
                            .tabItem { Label("Invoice", systemImage: "doc.text") }
                            .tag(1)
                        CurrencySettingsView(setting: setting)
                            .tabItem { Label("Currency", systemImage: "dollarsign.circle") }
                            .tag(2)
                        GeneralSettingsView(setting: setting)
                            .tabItem { Label("General", systemImage: "gearshape") }
                            .tag(3)
                    }
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
        .navigationTitle("Settings")
        .navigationSubtitle("Configure your invoice preferences")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
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
                    Label(setting?.profileName ?? "Default", systemImage: "person.circle")
                }
            }
        }
        .task { await loadSetting() }
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
}

// MARK: - Profile Settings

struct ProfileSettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Bindable var setting: Setting

    @State private var companyName = ""
    @State private var companyEmail = ""
    @State private var companyPhone = ""
    @State private var companyAddress = ""
    @State private var companyWebsite = ""
    @State private var saved = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                section("Company Information") {
                    row("Company Name", text: $companyName, placeholder: "Acme Inc.", wraps: true)
                    row("Email", text: $companyEmail, placeholder: "billing@acme.com")
                    row("Phone", text: $companyPhone, placeholder: "+1 (555) 123-4567")
                    row("Address", text: $companyAddress, placeholder: "123 Main St, City, Country", wraps: true)
                    row("Website", text: $companyWebsite, placeholder: "https://acme.com")
                }

                section("Logo") {
                    VStack(spacing: 16) {
                        if let data = setting.logoData, let nsImage = NSImage(data: data) {
                            Image(nsImage: nsImage)
                                .resizable()
                                .interpolation(.high)
                                .scaledToFit()
                                .frame(maxWidth: .infinity)
                                .frame(height: 300)
                                .background(Color(nsColor: .textBackgroundColor))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                                )
                        } else {
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.gray.opacity(0.08))
                                .frame(maxWidth: .infinity)
                                .frame(height: 300)
                                .overlay(
                                    VStack(spacing: 12) {
                                        Image(systemName: "photo")
                                            .font(.system(size: 48))
                                            .foregroundColor(.secondary)
                                        Text("No logo uploaded")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                )
                        }
                        
                        HStack {
                            Button("Choose Logo") { pickLogo() }
                            if setting.logoData != nil {
                                Button("Remove Logo") {
                                    setting.logoData = nil
                                    modelContext.persist()
                                }
                                .foregroundColor(.red)
                            }
                            Spacer()
                            Text("PNG or JPG, recommended 512×512")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                HStack {
                    Spacer()
                    if saved {
                        Label("Saved", systemImage: "checkmark.circle.fill")
                            .foregroundColor(Color.brandPrimary)
                            .transition(.opacity)
                    }
                    Button("Save Profile") { saveProfile() }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.brandPrimary)
                }
            }
            .padding(20)
        }
        .onAppear { loadProfile() }
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


    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.system(.body, weight: .semibold))
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func row(_ label: String, text: Binding<String>, placeholder: String, wraps: Bool = false) -> some View {
        HStack(alignment: .top) {
            Text(label).frame(width: 120, alignment: .leading)
            if wraps {
                TextField(placeholder, text: text, axis: .vertical)
                    .lineLimit(1...3)
                    .textFieldStyle(.roundedBorder)
            } else {
                TextField(placeholder, text: text).textFieldStyle(.roundedBorder)
            }
            Spacer()
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
                section("Display Options") {
                    SettingsUI.toggle(label: "Show Invoice ID", isOn: $setting.showInvoiceId)
                    SettingsUI.toggle(label: "Show Due Date", isOn: $setting.showDueDate)
                    SettingsUI.toggle(label: "Show Currency", isOn: $setting.showCurrency)
                    SettingsUI.toggle(label: "Show Discount", isOn: $setting.showDiscount)
                    SettingsUI.toggle(label: "Show Tax", isOn: $setting.showTax)
                    SettingsUI.toggle(label: "Show Notes", isOn: $setting.showNote)
                }

                section("PDF Template") {
                    SettingsUI.pickerRow(label: "PDF Template", selection: $setting.template, options: [
                        ("dark","Dark"),("light","Light")
                    ])
                    SettingsUI.pickerRow(label: "Paper Size", selection: $setting.paperSize, options: [
                        ("A3","A3"),("A4","A4"),("Letter","Letter"),("Legal","Legal")
                    ])
                }

                section("Colors") {
                    HStack {
                        Text("Accent Color").frame(width: 120, alignment: .leading)
                        ColorPicker("", selection: accentBinding, supportsOpacity: false)
                        Spacer()
                    }
                    HStack {
                        Text("Secondary Color").frame(width: 120, alignment: .leading)
                        ColorPicker("", selection: secondaryBinding, supportsOpacity: false)
                        Spacer()
                    }
                }

                section("Default Notes") {
                    TextField("Notes", text: $setting.notes, axis: .vertical)
                        .lineLimit(2...8)
                        .textFieldStyle(.roundedBorder)
                        .font(.body)
                }
            }
            .padding(20)
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

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.system(.body, weight: .semibold))
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Currency Settings

struct CurrencySettingsView: View {
    @Bindable var setting: Setting
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                section("Currency") {
                    SettingsUI.pickerRow(label: "Currency", selection: $setting.currency, options: [
                        ("USD","US Dollar"),("EUR","Euro"),("GBP","British Pound"),
                        ("GHS","Ghanaian Cedi"),("CAD","Canadian Dollar"),
                        ("NGN","Nigerian Naira"),("ZAR","South African Rand")
                    ])
                    SettingsUI.pickerRow(label: "Separator", selection: $setting.separator, options: [
                        ("comma","Comma (1,000.00)"),("dot","Dot (1.000,00)"),
                        ("space","Space (1 000.00)")
                    ])
                    HStack {
                        Text("Decimal Places").frame(width: 120, alignment: .leading)
                        Stepper("\(setting.decimalPlaces)", value: $setting.decimalPlaces, in: 0...4)
                        Spacer()
                    }
                    SettingsUI.pickerRow(label: "Sign Placement", selection: $setting.signPlacement, options: [
                        ("before","Before ($100)"),("after","After (100$)")
                    ])
                }

                section("Date Format") {
                    SettingsUI.pickerRow(label: "Format", selection: $setting.dateFormat, options: [
                        ("MM/DD/YYYY","MM/DD/YYYY"),("DD/MM/YYYY","DD/MM/YYYY"),
                        ("YYYY-MM-DD","YYYY-MM-DD"),("DD MMM YYYY","DD MMM YYYY")
                    ])
                }
            }
            .padding(20)
            .onChange(of: setting.currency) { _, _ in modelContext.persist() }
            .onChange(of: setting.separator) { _, _ in modelContext.persist() }
            .onChange(of: setting.decimalPlaces) { _, _ in modelContext.persist() }
            .onChange(of: setting.signPlacement) { _, _ in modelContext.persist() }
            .onChange(of: setting.dateFormat) { _, _ in modelContext.persist() }
        }
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.system(.body, weight: .semibold))
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 10))
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
                section("Appearance") {
                    SettingsUI.toggle(label: "Dark Mode", isOn: $setting.darkMode)
                }
                section("PDF Export") {
                    HStack {
                        Text("Export Folder").frame(width: 120, alignment: .leading)
                        TextField(exportPath.isEmpty ? "~/Documents" : exportPath, text: $exportPath)
                            .textFieldStyle(.roundedBorder)
                        Button("Choose...") { chooseExportFolder() }
                        Spacer()
                    }
                    Text("PDFs will be saved to this folder when exporting.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                section("Language") {
                    SettingsUI.pickerRow(label: "Language", selection: $setting.language, options: [
                        ("en","English"),("fr","Français"),("es","Español"),("ar","العربية")
                    ])
                }
                section("Backup & Restore") {
                    HStack(spacing: 12) {
                        Button("Export Backup…") {
                            BackupCoordinator.exportBackup(from: modelContext)
                        }
                        Button("Import Backup…") {
                            BackupCoordinator.importBackup(into: modelContext)
                        }
                        Spacer()
                    }
                    Text("Export saves every client, invoice, and settings profile as a JSON file. Import restores from a backup — matching records are updated in place and nothing is deleted.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                section("Automatic Snapshots") {
                    Text("A snapshot of your data is saved every time the app quits. The last \(RollingBackupService.keepCount) are kept.")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    if pendingRestore {
                        HStack {
                            Image(systemName: "clock.arrow.circlepath")
                                .foregroundColor(.orange)
                            Text("A restore is scheduled — it will apply the next time the app launches.")
                                .font(.caption)
                            Spacer()
                            Button("Cancel Restore") {
                                RollingBackupService.clearStagedRestore()
                                refreshSnapshots()
                            }
                        }
                    }

                    if snapshots.isEmpty {
                        Text("No snapshots yet — one will be created the next time you quit the app.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(snapshots.reversed(), id: \.absoluteString) { snapshot in
                            HStack {
                                Image(systemName: "externaldrive.badge.timemachine")
                                    .foregroundColor(.secondary)
                                Text(snapshotLabel(snapshot))
                                Spacer()
                                Button("Restore") { confirmRestore(snapshot) }
                            }
                        }
                    }

                    HStack {
                        Button("Show in Finder") {
                            NSWorkspace.shared.activateFileViewerSelecting([RollingBackupService.backupsDirectory])
                        }
                        Spacer()
                    }
                }
            }
            .padding(20)
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

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.system(.body, weight: .semibold))
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}



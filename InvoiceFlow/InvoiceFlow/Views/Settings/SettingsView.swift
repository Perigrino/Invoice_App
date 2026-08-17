import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(filter: #Predicate<Setting> { $0.isActive }) private var activeSettings: [Setting]
    @Query(sort: \Setting.profileName) private var allSettings: [Setting]
    @State private var selectedTab = 0

    private var currentSetting: Setting? {
        activeSettings.first ?? allSettings.first
    }

    var body: some View {
        Group {
            if let setting = currentSetting {
                VStack(spacing: 0) {
                    header(setting)
                    Divider()
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
            } else {
                VStack(spacing: 12) {
                    ProgressView()
                    Text("Loading settings...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .onAppear { ensureDefaultSettings() }
            }
        }
    }

    private func header(_ setting: Setting) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Settings")
                    .font(.title2.bold())
                Text("Configure your invoice preferences")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
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
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "person.circle")
                    Text(setting.profileName)
                    Image(systemName: "chevron.down")
                        .font(.caption)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }

    private func ensureDefaultSettings() {
        guard activeSettings.isEmpty && allSettings.isEmpty else { return }
        modelContext.insert(Setting())
    }

    private func switchProfile(_ s: Setting) {
        for setting in allSettings { setting.isActive = false }
        s.isActive = true
    }

    private func createProfile() {
        let new = Setting(profileName: "New Profile", isActive: false)
        modelContext.insert(new)
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
    @State private var companyTaxId = ""
    @State private var saved = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                section("Company Information") {
                    row("Company Name", text: $companyName, placeholder: "Acme Inc.")
                    row("Email", text: $companyEmail, placeholder: "billing@acme.com")
                    row("Phone", text: $companyPhone, placeholder: "+1 (555) 123-4567")
                    row("Address", text: $companyAddress, placeholder: "123 Main St, City, Country")
                    row("Website", text: $companyWebsite, placeholder: "https://acme.com")
                    row("Tax ID", text: $companyTaxId, placeholder: "12-3456789")
                }

                section("Logo") {
                    HStack(spacing: 16) {
                        if let data = setting.logoData, let nsImage = NSImage(data: data) {
                            Image(nsImage: nsImage)
                                .resizable()
                                .frame(width: 80, height: 80)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        } else {
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.gray.opacity(0.1))
                                .frame(width: 80, height: 80)
                                .overlay(Image(systemName: "photo").foregroundColor(.secondary))
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            Button("Choose Logo") { pickLogo() }
                            Text("PNG or JPG, recommended 512x512")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
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
        companyName = setting.profileName
        companyEmail = ""
        companyPhone = ""
        companyAddress = ""
        companyWebsite = ""
        companyTaxId = ""
    }

    private func saveProfile() {
        setting.profileName = companyName.isEmpty ? "Default" : companyName
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

    private func row(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        HStack {
            Text(label).frame(width: 120, alignment: .leading)
            TextField(placeholder, text: text).textFieldStyle(.roundedBorder)
            Spacer()
        }
    }
}

// MARK: - Invoice Settings

struct InvoiceSettingsView: View {
    @Bindable var setting: Setting

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

                section("Template") {
                    SettingsUI.pickerRow(label: "Template", selection: $setting.template, options: [
                        ("modern","Modern"),("business","Business"),("minimal","Minimal"),
                        ("professional","Professional"),("elegant","Elegant")
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
                    TextEditor(text: $setting.notes)
                        .font(.body)
                        .frame(minHeight: 80)
                        .padding(4)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.gray.opacity(0.2), lineWidth: 1))
                }
            }
            .padding(20)
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

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                section("Appearance") {
                    SettingsUI.toggle(label: "Dark Mode", isOn: $setting.darkMode)
                }
                section("Language") {
                    SettingsUI.pickerRow(label: "Language", selection: $setting.language, options: [
                        ("en","English"),("fr","Français"),("es","Español"),("ar","العربية")
                    ])
                }
            }
            .padding(20)
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

import SwiftUI
import SwiftData

// MARK: - Shared Utilities (inlined for module access)

extension Color {
    init(hex: String) {
        let scanner = Scanner(string: hex)
        var rgbValue: UInt64 = 0
        scanner.scanHexInt64(&rgbValue)
        let r = Double((rgbValue & 0xFF0000) >> 16) / 255.0
        let g = Double((rgbValue & 0x00FF00) >> 8) / 255.0
        let b = Double(rgbValue & 0x0000FF) / 255.0
        self.init(red: r, green: g, blue: b)
    }
    
    static let brandPrimary = Color(hex: "059669")
    static let brandPrimaryHover = Color(hex: "047857")
    static let brandSecondary = Color(hex: "1E3A5F")
    static let brandBackground = Color(hex: "0F172A")
    static let brandSurface = Color.white.opacity(0.06)
    static let brandBorder = Color.white.opacity(0.1)
    static let brandTextPrimary = Color.white
    static let brandTextSecondary = Color.white.opacity(0.7)
    static let brandTextMuted = Color.gray
}

struct CurrencyFormatter {
    static let shared = CurrencyFormatter()
    
    private let formatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        return f
    }()
    
    func string(from value: Double, currencyCode: String = "USD") -> String {
        if formatter.currencyCode != currencyCode {
            formatter.currencyCode = currencyCode
        }
        return formatter.string(from: NSNumber(value: value)) ?? "$0.00"
    }
}

struct Currency: Identifiable, CaseIterable {
    let id = UUID()
    let code: String
    let name: String
    let symbol: String
    
    static let allCases: [Currency] = [
        Currency(code: "USD", name: "US Dollar", symbol: "$"),
        Currency(code: "EUR", name: "Euro", symbol: "€"),
        Currency(code: "GBP", name: "British Pound", symbol: "£"),
        Currency(code: "GHS", name: "Ghanaian Cedi", symbol: "₵"),
        Currency(code: "CAD", name: "Canadian Dollar", symbol: "C$"),
        Currency(code: "NGN", name: "Nigerian Naira", symbol: "₦"),
        Currency(code: "ZAR", name: "South African Rand", symbol: "R")
    ]
}

func formatCurrency(_ amount: Double, currencyCode: String = "USD") -> String {
    CurrencyFormatter.shared.string(from: amount, currencyCode: currencyCode)
}

struct SettingsUI {
    static func section<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(.body, weight: .semibold))
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
    
    static func row(label: String, value: Binding<String>, placeholder: String) -> some View {
        HStack {
            Text(label)
                .frame(width: 120, alignment: .leading)
            TextField(placeholder, text: value)
                .textFieldStyle(.roundedBorder)
            Spacer()
        }
    }
    
    static func toggle(label: String, isOn: Binding<Bool>) -> some View {
        HStack {
            Text(label)
            Spacer()
            Toggle("", isOn: isOn)
                .labelsHidden()
        }
    }
    
    static func pickerRow(label: String, selection: Binding<String>, options: [(String, String)]) -> some View {
        HStack {
            Text(label)
                .frame(width: 120, alignment: .leading)
            Picker("", selection: selection) {
                ForEach(options, id: \.0) { value, display in
                    Text(display).tag(value)
                }
            }
            .labelsHidden()
            Spacer()
        }
    }
}

// MARK: - ContentView

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @State private var selectedTab: SidebarTab = .invoices
    @State private var columnVisibility: NavigationSplitViewVisibility = .doubleColumn

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            List(selection: $selectedTab) {
                Section("Billing") {
                    Label {
                        Text(SidebarTab.invoices.rawValue)
                    } icon: {
                        Image(systemName: SidebarTab.invoices.icon)
                    }
                    .tag(SidebarTab.invoices)

                    Label {
                        Text(SidebarTab.clients.rawValue)
                    } icon: {
                        Image(systemName: SidebarTab.clients.icon)
                    }
                    .tag(SidebarTab.clients)
                }

                Section("General") {
                    Label {
                        Text(SidebarTab.settings.rawValue)
                    } icon: {
                        Image(systemName: SidebarTab.settings.icon)
                    }
                    .tag(SidebarTab.settings)
                }
            }
            .listStyle(.sidebar)
            .navigationTitle("InvoiceFlow")
            .navigationSplitViewColumnWidth(min: 180, ideal: 200, max: 260)
        } detail: {
            switch selectedTab {
            case .invoices:
                InvoiceListView()
            case .clients:
                ClientListView()
            case .settings:
                SettingsView()
            }
        }
        .navigationSplitViewStyle(.balanced)
        .preferredColorScheme(.dark)
        .task { seedDefaultSettingIfNeeded() }
    }

    private func seedDefaultSettingIfNeeded() {
        let descriptor = FetchDescriptor<Setting>()
        guard let existing = try? modelContext.fetch(descriptor), existing.isEmpty else { return }
        modelContext.insert(Setting())
        try? modelContext.save()
    }
}

enum SidebarTab: String, CaseIterable {
    case invoices = "Invoices"
    case clients = "Clients"
    case settings = "Settings"
    
    var icon: String {
        switch self {
        case .invoices: return "doc.text"
        case .clients: return "person.2"
        case .settings: return "gearshape"
        }
    }
}
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

struct InvoiceStatus: Identifiable, CaseIterable {
    let id = UUID()
    let key: String
    let label: String
    let color: Color
    
    static let allCases: [InvoiceStatus] = [
        InvoiceStatus(key: "draft", label: "Draft", color: .gray),
        InvoiceStatus(key: "pending", label: "Pending", color: .orange),
        InvoiceStatus(key: "paid", label: "Paid", color: .green),
        InvoiceStatus(key: "overdue", label: "Overdue", color: .red),
        InvoiceStatus(key: "cancelled", label: "Cancelled", color: .red.opacity(0.6))
    ]
    
    static func color(for key: String) -> Color {
        allCases.first { $0.key == key }?.color ?? .gray
    }
    
    static func label(for key: String) -> String {
        allCases.first { $0.key == key }?.label ?? key.capitalized
    }
}

func formatCurrency(_ amount: Double, currencyCode: String = "USD") -> String {
    CurrencyFormatter.shared.string(from: amount, currencyCode: currencyCode)
}

struct InvoiceStatusHelper {
    static func color(for status: String) -> Color {
        switch status {
        case "draft": return .gray
        case "pending": return .orange
        case "paid": return .green
        case "overdue": return .red
        case "cancelled": return .red.opacity(0.6)
        default: return .gray
        }
    }
    
    static func label(for status: String) -> String {
        status.capitalized
    }
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
            List(SidebarTab.allCases, id: \.self, selection: $selectedTab) { tab in
                Label {
                    Text(tab.rawValue)
                } icon: {
                    Image(systemName: tab.icon)
                        .foregroundColor(tab == selectedTab ? Color.brandPrimary : .secondary)
                }
                .tag(tab)
            }
            .listStyle(.sidebar)
            .navigationTitle("InvoiceFlow")
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
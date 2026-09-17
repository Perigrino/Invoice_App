import Foundation

enum PDFTemplate: String, CaseIterable, Identifiable {
    case dark
    case light

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .dark: return "Dark"
        case .light: return "Light"
        }
    }
}

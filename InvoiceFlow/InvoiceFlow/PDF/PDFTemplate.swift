import Foundation

enum PDFTemplate: String, CaseIterable, Identifiable {
    case modern
    case business
    case minimal
    case professional

    var id: String { rawValue }

    var displayName: String {
        rawValue.capitalized
    }
}
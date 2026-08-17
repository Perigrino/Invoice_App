import SwiftUI

struct StatusBadge: View {
    let status: String

    private var color: Color {
        switch status {
        case "draft": return .gray
        case "pending": return .orange
        case "paid": return .green
        case "overdue": return .red
        case "cancelled": return .red.opacity(0.6)
        default: return .gray
        }
    }

    private var label: String {
        status.capitalized
    }

    var body: some View {
        Text(label)
            .font(.caption.weight(.medium))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(color.opacity(0.15))
            .foregroundColor(color)
            .clipShape(Capsule())
    }
}

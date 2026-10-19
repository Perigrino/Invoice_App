import SwiftUI

/// Prototype `.empty`: faint icon, bold secondary title, muted body, and an
/// optional primary capsule action.
struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 44, weight: .light))
                .foregroundColor(Theme.textSecondary.opacity(0.4))
                .padding(.bottom, 8)
            Text(title)
                .font(.system(size: 17, weight: .bold))
                .foregroundColor(Theme.textSecondary)
            Text(message)
                .font(.system(size: 12.5))
                .foregroundColor(Theme.textMuted)
                .multilineTextAlignment(.center)
                .lineSpacing(2)
                .frame(maxWidth: 330)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(.plain)
                    .capsuleButton(.primary)
                    .padding(.top, 14)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 20)
        .padding(.vertical, 70)
        .appear()
    }
}

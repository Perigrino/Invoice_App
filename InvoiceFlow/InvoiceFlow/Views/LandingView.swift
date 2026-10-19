import SwiftUI

/// Onboarding hero — the prototype's `v-landing`: icon over a soft glow,
/// title, subtitle, a mock invoice card with staggered line items, and the
/// big gradient "Get Started" capsule.
struct LandingView: View {
    var onGetStarted: () -> Void

    @State private var iconShown = false
    @State private var lineItem1Opacity = 0.0
    @State private var lineItem2Opacity = 0.0
    @State private var lineItem3Opacity = 0.0
    @State private var totalOpacity = 0.0
    @State private var buttonOpacity = 0.0
    @State private var invoiceScale: CGFloat = 0.96
    @State private var glowOpacity = 0.0

    var body: some View {
        ZStack {
            ThemeCanvas()

            VStack(spacing: 16) {
                Spacer(minLength: 24)

                // App icon over its glow halo.
                ZStack {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [Theme.palette.glowStrong, .clear],
                                center: .center,
                                startRadius: 0,
                                endRadius: 75
                            )
                        )
                        .frame(width: 150, height: 150)
                        .opacity(glowOpacity)
                    Image(nsImage: NSApplication.shared.applicationIconImage)
                        .resizable()
                        .frame(width: 96, height: 96)
                        .clipShape(RoundedRectangle(cornerRadius: 21, style: .continuous))
                        .shadow(color: Theme.palette.glowStrong, radius: 30, x: 0, y: 14)
                }
                .opacity(iconShown ? 1 : 0)
                .scaleEffect(iconShown ? 1 : 0.94)

                Text("InvoiceFlow")
                    .font(.system(size: 34, weight: .bold))
                    .kerning(-0.85)
                    .foregroundColor(Theme.textPrimary)

                Text("Create, send, and track invoices without the busywork. Your data stays on this Mac.")
                    .font(.system(size: 13.5))
                    .foregroundColor(Theme.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
                    .frame(maxWidth: 430)

                mockCard
                    .padding(.top, 8)

                Button(action: onGetStarted) {
                    Text("Get Started")
                        .font(.system(size: 14, weight: .semibold))
                        .padding(.horizontal, 34)
                        .frame(height: 48)
                        .background(Capsule().fill(Theme.gradient))
                        .foregroundColor(Theme.onAccent)
                        .overlay { Capsule().strokeBorder(Color.white.opacity(0.12), lineWidth: 1) }
                        .shadow(color: Theme.palette.glowStrong, radius: 22, x: 0, y: 8)
                }
                .buttonStyle(.plain)
                .opacity(buttonOpacity)
                .padding(.top, 6)

                Spacer(minLength: 24)
            }
            .padding(40)
        }
        .onAppear { startAnimation() }
    }

    private var mockCard: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image(nsImage: NSApplication.shared.applicationIconImage)
                    .resizable()
                    .frame(width: 30, height: 30)
                    .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                Text("INV-001")
                    .font(.system(size: 11.5, design: .monospaced))
                    .foregroundColor(Theme.textMuted)
                Spacer()
            }
            .padding(.bottom, 12)

            mockDivider

            mockLine("Brand identity system", amount: "$3,200.00", opacity: lineItem1Opacity)
            mockLine("Motion guidelines", amount: "$1,100.00", opacity: lineItem2Opacity)
            mockLine("Print collateral", amount: "$520.00", opacity: lineItem3Opacity)

            mockDivider

            HStack {
                SectionLabel("Total")
                Spacer()
                Text("$4,820.00")
                    .font(.system(size: 20, weight: .bold, design: .default))
                    .monospacedDigit()
                    .foregroundColor(Theme.textPrimary)
            }
            .opacity(totalOpacity)
            .padding(.top, 12)
        }
        .padding(16)
        .frame(width: 360)
        .glassCard(radius: Theme.radiusLarge)
        .scaleEffect(invoiceScale)
    }

    private var mockDivider: some View {
        Rectangle().fill(Theme.hairline).frame(height: 1).padding(.vertical, 10)
    }

    private func mockLine(_ name: String, amount: String, opacity: Double) -> some View {
        HStack(spacing: 9) {
            Circle()
                .fill(Theme.gradient)
                .frame(width: 6, height: 6)
            Text(name)
                .font(.system(size: 12.5))
                .foregroundColor(Theme.textSecondary)
            Spacer()
            Text(amount)
                .font(.system(size: 12.5, design: .monospaced))
                .foregroundColor(Theme.textSecondary)
        }
        .padding(.vertical, 6)
        .opacity(opacity)
    }

    private func startAnimation() {
        withAnimation(.easeOut(duration: 0.6)) {
            glowOpacity = 1
            iconShown = true
        }
        withAnimation(.spring(response: 0.6, dampingFraction: 1.0).delay(0.15)) {
            invoiceScale = 1.0
        }
        withAnimation(.easeOut(duration: 0.4).delay(0.30)) { lineItem1Opacity = 1 }
        withAnimation(.easeOut(duration: 0.4).delay(0.45)) { lineItem2Opacity = 1 }
        withAnimation(.easeOut(duration: 0.4).delay(0.60)) { lineItem3Opacity = 1 }
        withAnimation(.easeOut(duration: 0.4).delay(0.80)) { totalOpacity = 1 }
        withAnimation(.easeOut(duration: 0.5).delay(1.05)) { buttonOpacity = 1 }
    }
}

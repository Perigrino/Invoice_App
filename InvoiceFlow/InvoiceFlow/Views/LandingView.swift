import SwiftUI

struct LandingView: View {
    var onGetStarted: () -> Void
    
    @State private var showContent = false
    @State private var lineItem1Opacity = 0.0
    @State private var lineItem2Opacity = 0.0
    @State private var lineItem3Opacity = 0.0
    @State private var lineItem4Opacity = 0.0
    @State private var totalOpacity = 0.0
    @State private var buttonOpacity = 0.0
    @State private var invoiceScale: CGFloat = 0.95
    @State private var glowOpacity = 0.0
    
    var body: some View {
        ZStack {
            Color.brandBackground
                .ignoresSafeArea()
            
            // Ambient glow
            RadialGradient(
                gradient: Gradient(colors: [
                    Color.brandSecondary.opacity(0.3),
                    Color.clear
                ]),
                center: .center,
                startRadius: 100,
                endRadius: 400
            )
            .ignoresSafeArea()
            .opacity(glowOpacity)
            
            VStack(spacing: 0) {
                Spacer()
                
                // Invoice card
                VStack(spacing: 0) {
                    // Header
                    HStack {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.brandPrimary)
                            .frame(width: 32, height: 32)
                        Spacer()
                        Text("INV-001")
                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                            .foregroundColor(.gray)
                    }
                    .padding(.bottom, 16)
                    
                    Divider()
                        .background(Color.white.opacity(0.1))
                        .padding(.bottom, 16)
                    
                    // Line items
                    lineItemRow(name: "Design Consultation", amount: "$450.00", opacity: lineItem1Opacity)
                    lineItemRow(name: "UI/UX Design", amount: "$1,200.00", opacity: lineItem2Opacity)
                    lineItemRow(name: "Development", amount: "$800.00", opacity: lineItem3Opacity)
                    lineItemRow(name: "Testing & QA", amount: "$350.00", opacity: lineItem4Opacity)
                    
                    Divider()
                        .background(Color.white.opacity(0.1))
                        .padding(.vertical, 12)
                    
                    // Total
                    HStack {
                        Text("Total")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.white.opacity(0.6))
                        Spacer()
                        Text("$2,800.00")
                            .font(.system(size: 20, weight: .bold, design: .monospaced))
                            .foregroundColor(.white)
                    }
                    .opacity(totalOpacity)
                }
                .padding(28)
                .frame(width: 360)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.brandSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.brandBorder, lineWidth: 1)
                        )
                )
                .shadow(color: Color.brandPrimary.opacity(0.15), radius: 40, x: 0, y: 10)
                .scaleEffect(invoiceScale)
                
                // CTA Button
                Button(action: onGetStarted) {
                    Text("Get Started")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(width: 200, height: 48)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.brandPrimary)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.white.opacity(0.15), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .opacity(buttonOpacity)
                .padding(.top, 32)
                
                Spacer()
            }
        }
        .onAppear {
            startAnimation()
        }
    }
    
    private func lineItemRow(name: String, amount: String, opacity: Double) -> some View {
        HStack {
            Circle()
                .fill(Color.brandPrimary)
                .frame(width: 6, height: 6)
            Text(name)
                .font(.system(size: 13))
                .foregroundColor(Color.brandTextSecondary)
            Spacer()
            Text(amount)
                .font(.system(size: 13, design: .monospaced))
                .foregroundColor(Color.brandTextPrimary.opacity(0.9))
        }
        .padding(.vertical, 6)
        .opacity(opacity)
    }
    
    private func startAnimation() {
        withAnimation(.easeOut(duration: 0.8)) {
            glowOpacity = 1
        }
        
        withAnimation(.spring(response: 0.6, dampingFraction: 0.9).delay(0.2)) {
            invoiceScale = 1.0
        }
        
        withAnimation(.easeOut(duration: 0.4).delay(0.6)) {
            lineItem1Opacity = 1
        }
        withAnimation(.easeOut(duration: 0.4).delay(0.8)) {
            lineItem2Opacity = 1
        }
        withAnimation(.easeOut(duration: 0.4).delay(1.0)) {
            lineItem3Opacity = 1
        }
        withAnimation(.easeOut(duration: 0.4).delay(1.2)) {
            lineItem4Opacity = 1
        }
        withAnimation(.easeOut(duration: 0.4).delay(1.5)) {
            totalOpacity = 1
        }
        withAnimation(.easeOut(duration: 0.5).delay(1.8)) {
            buttonOpacity = 1
        }
    }
}
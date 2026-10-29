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

    // Brand tokens. These are appearance- and palette-aware (see `Theme`), so
    // the same call sites paint both themes and every gradient palette.
    static var brandPrimary: Color { Theme.accent }
    static var brandPrimaryHover: Color { Theme.accentDeep }
    static var brandSecondary: Color { Theme.accentAlt }
    static var brandBackground: Color { Theme.canvas }
    static var brandSurface: Color { Theme.cardFill }
    static var brandBorder: Color { Theme.hairline }
    static var brandTextPrimary: Color { Theme.textPrimary }
    static var brandTextSecondary: Color { Theme.textSecondary }
    static var brandTextMuted: Color { Theme.textMuted }
}

// MARK: - Gradient Palettes

/// InvoiceFlow's own gradients, ported from the HTML prototype's switcher.
/// Each palette ships a dark pair and a light pair (the light pair is a
/// deepened version of the same hue so white-on-gradient text keeps contrast).
enum GradientPalette: String, CaseIterable, Identifiable {
    case lagoon, cobalt, citrus, ember, bloom

    static let storageKey = "gradientPalette"

    /// Restores the persisted pick at first token access.
    static var saved: GradientPalette {
        UserDefaults.standard.string(forKey: storageKey).flatMap(Self.init(rawValue:)) ?? .lagoon
    }

    /// Component glow (prototype `--glow`): the accent at 32 %, in both
    /// themes — used by the gradient surfaces (tiles, pills, primary caps).
    var glowStrong: Color { themedAlpha(light: hexes.lightA, dark: hexes.darkA, (0.32, 0.32)) }
    /// Hover glow (prototype `--glow-2`): the second hue at 30 %.
    var glowAltStrong: Color { themedAlpha(light: hexes.lightB, dark: hexes.darkB, (0.30, 0.30)) }

    func persist() { UserDefaults.standard.set(rawValue, forKey: Self.storageKey) }

    var id: String { rawValue }

    var name: String {
        switch self {
        case .lagoon: return "Lagoon"
        case .cobalt: return "Cobalt"
        case .citrus: return "Citrus"
        case .ember: return "Ember"
        case .bloom: return "Bloom"
        }
    }

    var note: String {
        switch self {
        case .lagoon: return "teal → azure"
        case .cobalt: return "azure → indigo"
        case .citrus: return "lime → teal"
        case .ember: return "coral → amber"
        case .bloom: return "rose → orange"
        }
    }

    private var hexes: (darkA: String, darkB: String, lightA: String, lightB: String) {
        switch self {
        case .lagoon: return ("#1ED9C2", "#2F7BFF", "#0E9A8B", "#1E63E0")
        case .cobalt: return ("#4C9BFF", "#5B5BFF", "#2C74E8", "#3A3AC9")
        case .citrus: return ("#B6E42E", "#12BE9E", "#6E9E0F", "#0B8F76")
        case .ember:  return ("#FF8A4C", "#FFC93C", "#C85A17", "#D89B00")
        case .bloom:  return ("#FF5E9C", "#FF9E3D", "#E03578", "#E07A1F")
        }
    }

    var accent: Color { Theme.dyn(light: hexes.lightA, dark: hexes.darkA) }
    var accentAlt: Color { Theme.dyn(light: hexes.lightB, dark: hexes.darkB) }
    /// Solid pair for swatches/dots — same value in both appearances.
    var dotTop: Color { Color(hex: hexes.darkA) }
    var dotBottom: Color { Color(hex: hexes.darkB) }
    var glow: Color { themedAlpha(light: hexes.lightA, dark: hexes.darkA, (0.15, 0.22)) }
    var glowAlt: Color { themedAlpha(light: hexes.lightB, dark: hexes.darkB, (0.11, 0.16)) }

    private func themedAlpha(light: String, dark: String, _ alpha: (CGFloat, CGFloat)) -> Color {
        Color(nsColor: NSColor(name: nil) { appearance in
            let isDark = appearance.isDark
            return NSColor(themeHex: isDark ? dark : light, alpha: isDark ? alpha.1 : alpha.0)
        })
    }
}

// MARK: - Design System

/// InvoiceFlow's own visual language, "Lagoon" (or whichever gradient palette
/// is selected): a near-black canvas with two soft accent glows, translucent
/// glass cards with a lit top edge, and critically-damped ("Silk") springs —
/// nothing overshoots.
///
/// Every token below is appearance-aware, so both themes come from one set of
/// call sites: values before the slash are the light theme, values after it
/// are the dark theme.
enum Theme {

    // MARK: - Motion (Silk: dampingFraction 1.0, so nothing bounces)
    /// User-driven layout changes: expand, filter, insert.
    static let smooth = Animation.spring(response: 0.45, dampingFraction: 1.0)
    /// Hover and press feedback.
    static let quick = Animation.spring(response: 0.28, dampingFraction: 1.0)
    /// Page-level reveals.
    static let gentle = Animation.spring(response: 0.6, dampingFraction: 1.0)

    // MARK: - Radii
    static let radiusCard: CGFloat = 14
    static let radiusLarge: CGFloat = 16
    static let radiusControl: CGFloat = 10

    // MARK: - Accent — the selected gradient palette
    static var palette: GradientPalette = GradientPalette.saved
    static var accent: Color { palette.accent }
    static var accentAlt: Color { palette.accentAlt }
    static var accentDeep: Color { palette.accent }

    /// Toolbar swatch pair (appearance-independent).
    static var dotTop: Color { palette.dotTop }
    static var dotBottom: Color { palette.dotBottom }

    static var gradient: LinearGradient {
        LinearGradient(colors: [accent, accentAlt], startPoint: .top, endPoint: .bottom)
    }

    static var gradientHorizontal: LinearGradient {
        LinearGradient(colors: [accent, accentAlt], startPoint: .leading, endPoint: .trailing)
    }

    static var gradientDiagonal: LinearGradient {
        LinearGradient(colors: [accent, accentAlt], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    // Selection fill: one solid accent-derived colour, deep enough to hold a
    // white label at a readable contrast in both appearances.
    static let selection = dyn(light: "#0B7C6F", dark: "#0E8B7C")

    /// Content drawn on the gradient stays white in both themes.
    static let onAccent = Color.white

    // MARK: - Canvas
    static let canvas = dyn(light: "#F4F5F7", dark: "#000000")
    /// Corner glows: dialled back in light so the page doesn't haze over.
    static var glowAccent: Color { palette.glow }
    static var glowAccentAlt: Color { palette.glowAlt }

    // MARK: - Surfaces
    /// Translucent scrim over the sidebar column: material + a whisper of tint
    /// so the canvas glows still read through it (prototype `--sidebar-bg`:
    /// white .022 dark / .42 light, over a blurred canvas).
    static let sidebarFill = dyn(light: "#FFFFFF", dark: "#FFFFFF", alpha: (0.42, 0.022))
    /// Translucent card wash laid over `.ultraThinMaterial`.
    static let cardFill = dyn(light: "#FFFFFF", dark: "#FFFFFF", alpha: (0.78, 0.05))
    static let cardStrokeTop = dyn(light: "#101218", dark: "#FFFFFF", alpha: (0.06, 0.14))
    static let cardStrokeBottom = dyn(light: "#101218", dark: "#FFFFFF", alpha: (0.11, 0.02))
    static let hairline = dyn(light: "#000000", dark: "#FFFFFF", alpha: (0.09, 0.08))
    static let rowSeparator = dyn(light: "#000000", dark: "#FFFFFF", alpha: (0.06, 0.05))
    static let chip = dyn(light: "#000000", dark: "#FFFFFF", alpha: (0.05, 0.08))
    static let hover = dyn(light: "#000000", dark: "#FFFFFF", alpha: (0.045, 0.06))
    static let hoverStrong = dyn(light: "#000000", dark: "#FFFFFF", alpha: (0.09, 0.14))
    static let field = dyn(light: "#FFFFFF", dark: "#FFFFFF", alpha: (1.0, 0.05))
    static let placeholder = dyn(light: "#000000", dark: "#FFFFFF", alpha: (0.04, 0.06))
    static let controlBorder = dyn(light: "#000000", dark: "#FFFFFF", alpha: (0.14, 0.18))
    static let toggleOff = dyn(light: "#000000", dark: "#FFFFFF", alpha: (0.14, 0.12))
    static let avatarBase = dyn(light: "#FFFFFF", dark: "#FFFFFF", alpha: (0.90, 0.05))

    // MARK: - Text
    static let textPrimary = dyn(light: "#0C0D10", dark: "#FFFFFF")
    static let textSecondary = dyn(light: "#0C0D10", dark: "#FFFFFF", alpha: (0.66, 0.70))
    static let textMuted = dyn(light: "#0C0D10", dark: "#FFFFFF", alpha: (0.45, 0.45))

    // MARK: - Status
    static let positive = dyn(light: "#1E9E6A", dark: "#63C79E")
    static let negative = dyn(light: "#C0433A", dark: "#E2786F")
    static let warning = dyn(light: "#A97A15", dark: "#E2B45F")
    /// Deeper end of the overdue gradient (prototype `--grad-overdue`).
    static let negativeDeep = dyn(light: "#B03E38", dark: "#C2554C")

    static var overdueGradient: LinearGradient {
        LinearGradient(colors: [negative, negativeDeep], startPoint: .top, endPoint: .bottom)
    }

    /// Glow colour behind the overdue countdown tile (prototype
    /// `--overdue-glow`, cast at ≤0.22 opacity).
    static let glowOverdueTile = dyn(light: "#B03E38", dark: "#C2554C")

    /// Overdue / due-soon row washes — "a wash, not a colour block".
    static var washOverdue: LinearGradient {
        LinearGradient(colors: [negative.opacity(0.13), .clear], startPoint: .leading, endPoint: .center)
    }
    static var washDue: LinearGradient {
        LinearGradient(colors: [warning.opacity(0.09), .clear], startPoint: .leading, endPoint: .center)
    }

    // MARK: - Tints

    /// A stable per-name hue, hashed with FNV-1a. `String.hashValue` is seeded
    /// per launch, so it would repaint a client's wash on every start.
    private static func hue(for seed: String) -> Double {
        var hash: UInt32 = 2_166_136_261
        for byte in seed.lowercased().utf8 {
            hash = (hash ^ UInt32(byte)) &* 16_777_619
        }
        return Double(hash % 360) / 360.0
    }

    /// The wash itself — deliberately understated, a tint rather than a block.
    static func tint(for seed: String) -> Color {
        let hue = hue(for: seed)
        return Color(nsColor: NSColor(name: nil) { appearance in
            let isDark = appearance.isDark
            return NSColor(hue: hue,
                           saturation: isDark ? 0.45 : 0.55,
                           brightness: isDark ? 0.60 : 0.48,
                           alpha: 1)
        })
    }

    /// Text/icon colour to pair with `tint(for:)` on the same wash.
    static func tintInk(for seed: String) -> Color {
        let hue = hue(for: seed)
        return Color(nsColor: NSColor(name: nil) { appearance in
            let isDark = appearance.isDark
            return NSColor(hue: hue,
                           saturation: isDark ? 0.38 : 0.62,
                           brightness: isDark ? 0.78 : 0.36,
                           alpha: 1)
        })
    }

    // MARK: - Appearance-aware colour construction

    static func dyn(light: String, dark: String, alpha: (CGFloat, CGFloat) = (1, 1)) -> Color {
        Color(nsColor: NSColor(name: nil) { appearance in
            let isDark = appearance.isDark
            return NSColor(themeHex: isDark ? dark : light, alpha: isDark ? alpha.1 : alpha.0)
        })
    }
}

private extension NSAppearance {
    var isDark: Bool {
        bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
    }
}

private extension NSColor {
    convenience init(themeHex hex: String, alpha: CGFloat = 1) {
        var value: UInt64 = 0
        Scanner(string: hex.replacingOccurrences(of: "#", with: "")).scanHexInt64(&value)
        self.init(srgbRed: CGFloat((value & 0xFF0000) >> 16) / 255.0,
                  green: CGFloat((value & 0x00FF00) >> 8) / 255.0,
                  blue: CGFloat(value & 0x0000FF) / 255.0,
                  alpha: alpha)
    }
}

// MARK: - Design System Components

/// The app canvas: a near-black (dark) / soft grey (light) field carrying two
/// soft accent glows in opposite corners, so the window reads as depth rather
/// than a flat void. Content scrolls over it.
struct ThemeCanvas: View {
    var body: some View {
        ZStack {
            Theme.canvas
            RadialGradient(
                colors: [Theme.glowAccent, .clear],
                center: UnitPoint(x: 0.10, y: -0.06),
                startRadius: 0,
                endRadius: 640
            )
            RadialGradient(
                colors: [Theme.glowAccentAlt, .clear],
                center: UnitPoint(x: 1.08, y: 1.12),
                startRadius: 0,
                endRadius: 720
            )
        }
        .ignoresSafeArea()
    }
}

/// Translucent card surface with a soft top highlight — a material catching
/// light. Use for every grouped block of content.
struct GlassCard: ViewModifier {
    var radius: CGFloat = Theme.radiusCard

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        content
            .background {
                shape
                    .fill(.ultraThinMaterial)
                    .overlay { shape.fill(Theme.cardFill) }
            }
            .overlay {
                shape.strokeBorder(
                    LinearGradient(
                        colors: [Theme.cardStrokeTop, Theme.cardStrokeBottom],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 1
                )
            }
            .clipShape(shape)
    }
}

/// Fade-up reveal for transient content (labels, summaries) — never for the
/// primary payload a screen exists to show.
struct AppearModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false
    /// Row entrances use the Silk "quick" curve (280ms per the prototype);
    /// larger surfaces keep the gentle settle.
    private var spring: Animation { quick ? Theme.quick : Theme.gentle }

    var quick = false

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : 12)
            .onAppear {
                withAnimation(reduceMotion ? nil : spring) { shown = true }
            }
    }
}

/// A restrained lift on hover, shared by cards and primary actions.
struct HoverLiftModifier: ViewModifier {
    @State private var hovering = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(hovering ? 1.006 : 1)
            .shadow(color: .black.opacity(0.35), radius: 14, x: 0, y: 6)
            .animation(Theme.smooth, value: hovering)
            .onHover { hovering = $0 }
    }
}

extension View {
    /// Translucent glass card with a lit top edge.
    func glassCard(radius: CGFloat = Theme.radiusCard) -> some View {
        modifier(GlassCard(radius: radius))
    }

    func appear(quick: Bool = false) -> some View {
        modifier(AppearModifier(quick: quick))
    }

    func hoverLift() -> some View {
        modifier(HoverLiftModifier())
    }

    /// Capsule button surface (prototype `.btn`): primary = gradient + glow,
    /// plain = chip fill + hairline, ghost = transparent.
    func capsuleButton(_ kind: CapsuleKind = .plain, small: Bool = false) -> some View {
        modifier(CapsuleSurface(kind: kind, small: small))
    }
}

// MARK: - Page header

/// Every screen opens with one: 26 pt bold title, secondary subtitle, and the
/// screen's actions trailing (prototype `PageHeader`).
struct PageHeader<Actions: View>: View {
    let title: String
    var subtitle: String?
    private let actions: Actions

    init(_ title: String, subtitle: String? = nil, @ViewBuilder actions: () -> Actions) {
        self.title = title
        self.subtitle = subtitle
        self.actions = actions()
    }

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 26, weight: .bold))
                    .kerning(-0.39)
                    .foregroundColor(Theme.textPrimary)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 12.5))
                        .foregroundColor(Theme.textSecondary)
                }
            }
            .appear()
            Spacer(minLength: 0)
            HStack(spacing: 8) { actions }
        }
        .padding(.top, 6)
    }
}

/// Uppercase, tracked micro-label that opens a group of rows (prototype
/// `.section-label` / `.k`).
struct SectionLabel: View {
    let title: String
    /// Uppercase rendering (prototype `.section-label`). Only pass `true` for
    /// labels whose accessibility value may differ from the real title — on
    /// macOS the rendered string becomes the a11y value and cannot be
    /// overridden, which would break tests that read e.g. "Display Options".
    var uppercased: Bool = false

    init(_ title: String, uppercased: Bool = false) {
        self.title = title
        self.uppercased = uppercased
    }

    var body: some View {
        Text(title)
            .textCase(uppercased ? .uppercase : nil)
            .font(.system(size: 11, weight: .semibold))
            .kerning(0.4)
            .foregroundColor(Theme.textMuted)
    }
}

// MARK: - Buttons

enum CapsuleKind { case primary, plain, ghost }

/// Capsule surface shared by every button in the app (prototype `.btn`).
struct CapsuleSurface: ViewModifier {
    var kind: CapsuleKind = .plain
    var small = false
    @State private var hovering = false

    func body(content: Content) -> some View {
        content
            .font(.system(size: small ? 11.5 : 12.5, weight: kind == .primary ? .semibold : .medium))
            .foregroundColor(kind == .primary ? Theme.onAccent : Theme.textPrimary)
            .padding(.horizontal, small ? 11 : 14)
            .frame(height: small ? 26 : 32)
            .background {
                let shape = Capsule()
                switch kind {
                case .primary: shape.fill(AnyShapeStyle(Theme.gradient))
                case .plain: shape.fill(hovering ? Theme.hoverStrong : Theme.chip)
                case .ghost: shape.fill(hovering ? Theme.hover : .clear)
                }
            }
            .overlay {
                if kind != .primary {
                    Capsule().strokeBorder(Theme.hairline, lineWidth: 1)
                }
            }
            .contentShape(Capsule())
            .scaleEffect(hovering ? 1.02 : 1)
            .shadow(color: kind == .primary ? Theme.palette.glowStrong : .clear, radius: kind == .primary ? 20 : 0, x: 0, y: 8)
            .animation(Theme.quick, value: hovering)
            .onHover { hovering = $0 }
    }
}


/// Small status capsule (prototype `.pill`): tinted text on a soft fill.
struct StatusPill: View {
    enum Kind { case paid, due, overdue, plain }
    let text: String
    var kind: Kind = .plain

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .medium))
            .foregroundColor(color)
            .padding(.horizontal, 10)
            .frame(height: 22)
            .background(Capsule().fill(Theme.hover))
            .fixedSize()
    }

    private var color: Color {
        switch kind {
        case .paid: return Theme.positive
        case .due: return Theme.warning
        case .overdue: return Theme.negative
        case .plain: return Theme.textSecondary
        }
    }
}

// MARK: - Status tile

/// The Airpisode countdown block, reused for days-to-due (prototype `.tile`).

// MARK: - Form field styles

/// Single-line field (prototype `.input`): 34 pt, radius 10, hairline border.
struct GlassFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .font(.system(size: 12.5))
            .foregroundColor(Theme.textPrimary)
            .padding(.horizontal, 12)
            .frame(height: 34)
            .background(RoundedRectangle(cornerRadius: Theme.radiusControl, style: .continuous).fill(Theme.field))
    }
}

/// Multiline variant — same surface, no fixed height.
struct GlassFieldMultilineStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .font(.system(size: 12.5))
            .foregroundColor(Theme.textPrimary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .frame(minHeight: 34, alignment: .top)
            .background(RoundedRectangle(cornerRadius: Theme.radiusControl, style: .continuous).fill(Theme.field))
    }
}

/// Uppercase tracked label above a field (prototype `.field label`).
struct FieldLabelStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .textCase(.uppercase)
            .font(.system(size: 11, weight: .semibold))
            .kerning(0.44)
            .foregroundColor(Theme.textMuted)
    }
}

// MARK: - Toggle

/// Capsule switch (prototype `.toggle`): 38 × 22, gradient track when on.
struct GlassToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Capsule()
            .fill(configuration.isOn ? AnyShapeStyle(Theme.gradient) : AnyShapeStyle(Theme.toggleOff))
            .frame(width: 38, height: 22)
            .overlay(alignment: .leading) {
                Circle()
                    .fill(.white)
                    .frame(width: 18, height: 18)
                    .padding(2)
                    .offset(x: configuration.isOn ? 16 : 0)
            }
            .animation(Theme.smooth, value: configuration.isOn)
            .contentShape(Capsule())
            .onTapGesture { withAnimation(Theme.smooth) { configuration.isOn.toggle() } }
            .help(configuration.isOn ? "On" : "Off")
    }
}

// MARK: - Invoice status

/// Derived, never stored: status comes from the due date and the payment
/// chain (balance due vs total), never from a stored flag.
enum InvoiceStatus: CaseIterable {
    case paid, partiallyPaid, overdue, dueSoon, upcoming
}

extension Invoice {
    var status: InvoiceStatus {
        if balanceDue <= 0 { return .paid }
        if total > 0 && balanceDue < total { return .partiallyPaid }
        guard let due = dueDate else { return .upcoming }
        switch daysTo(due) {
        case ..<0: return .overdue
        case 0...14: return .dueSoon
        default: return .upcoming
        }
    }

    /// Whole days from today: negative = late.
    func daysTo(_ date: Date) -> Int {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: Date())
        let end = calendar.startOfDay(for: date)
        return calendar.dateComponents([.day], from: start, to: end).day ?? 0
    }
}

extension Client {
    /// Sum of open balances across this client's invoices.
    var outstanding: Decimal {
        (invoices ?? []).filter { $0.status != .paid }.reduce(Decimal.zero) { $0 + $1.balanceDue }
    }
    var hasOverdue: Bool {
        (invoices ?? []).contains { $0.status == .overdue }
    }
    var invoiceCount: Int { invoices?.count ?? 0 }
    var initial: String {
        String(fullName.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased()
    }
}

struct CurrencyFormatter {
    static let shared = CurrencyFormatter()

    // Global current values, refreshed from the active Setting.
    static var activeCurrencyCode: String = "USD"
    static var separator: String = "comma"
    static var decimalPlaces: Int = 2
    static var signPlacement: String = "before"

    func string(from value: Double, currencyCode: String? = nil) -> String {
        let code = currencyCode ?? Self.activeCurrencyCode
        let number = Self.numberString(NSDecimalNumber(value: value))
        let symbol = Self.currencySymbol(for: code)
        if Self.signPlacement == "after" {
            return "\(number)\(symbol)"
        }
        return "\(symbol)\(number)"
    }

    /// decimal overload — the app stores money as `Decimal`, so this is the
    /// path invoice amounts take; exact digits survive (no Double rounding).
    func string(from value: Decimal, currencyCode: String? = nil) -> String {
        let code = currencyCode ?? Self.activeCurrencyCode
        let number = Self.numberString(NSDecimalNumber(decimal: value))
        let symbol = Self.currencySymbol(for: code)
        if Self.signPlacement == "after" {
            return "\(number)\(symbol)"
        }
        return "\(symbol)\(number)"
    }

    private static func numberString(_ value: NSDecimalNumber) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.minimumFractionDigits = decimalPlaces
        f.maximumFractionDigits = decimalPlaces
        switch separator {
        case "dot":
            f.groupingSeparator = "."
            f.decimalSeparator = ","
        case "space":
            f.groupingSeparator = " "
            f.decimalSeparator = ","
        default:
            f.groupingSeparator = ","
            f.decimalSeparator = "."
        }
        return f.string(from: value) ?? "0"
    }

    private static func currencySymbol(for code: String) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = code
        return f.currencySymbol ?? code
    }
}

enum DateFormatHelper {
    static var activeFormat = "MM/DD/YYYY"

    static func string(from date: Date, format: String = DateFormatHelper.activeFormat) -> String {
        let f = DateFormatter()
        f.dateFormat = format
            .replacingOccurrences(of: "YYYY", with: "yyyy")
            .replacingOccurrences(of: "DD", with: "dd")
        return f.string(from: date)
    }
}

/// Propagates the active profile's values to app-wide formatting helpers.
func applySettingsGlobals(_ setting: Setting) {
    CurrencyFormatter.activeCurrencyCode = setting.currency
    CurrencyFormatter.separator = setting.separator
    CurrencyFormatter.decimalPlaces = setting.decimalPlaces
    CurrencyFormatter.signPlacement = setting.signPlacement
    DateFormatHelper.activeFormat = setting.dateFormat
}

// MARK: - Persistence Helper

extension ModelContext {
    @discardableResult
    func persist(onError: ((Error) -> Void)? = nil) -> Bool {
        guard hasChanges else { return true }
        do {
            try save()
            return true
        } catch {
            onError?(error)
            #if DEBUG
            print("InvoiceFlow: failed to persist changes: \(error)")
            #endif
            return false
        }
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

func formatCurrency(_ amount: Decimal, currencyCode: String = "USD") -> String {
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
        .glassCard()
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
    @Query(filter: #Predicate<Setting> { $0.isActive }) private var activeSettings: [Setting]
    @Query private var allInvoices: [Invoice]
    @Query private var allClients: [Client]
    @State private var selectedTab: SidebarTab = .invoices
    @State private var columnVisibility: NavigationSplitViewVisibility = .doubleColumn
    @AppStorage(GradientPalette.storageKey) private var paletteID = GradientPalette.lagoon.rawValue

    private var isDarkMode: Bool { activeSettings.first?.darkMode ?? true }
    private var profileName: String { activeSettings.first?.profileName ?? "Default" }

    var body: some View {
        ZStack {
            ThemeCanvas()

            NavigationSplitView(columnVisibility: $columnVisibility) {
                sidebar
            } detail: {
                switch selectedTab {
                case .dashboard:
                    DashboardView(selectedTab: $selectedTab)
                case .invoices:
                    InvoiceListView()
                case .clients:
                    ClientListView()
                case .tokens:
                    TokensPage()
                case .settings:
                    SettingsView()
                }
            }
            .navigationSplitViewStyle(.balanced)
            .toolbarBackground(.ultraThinMaterial, for: .windowToolbar)
        }
        // Forces the whole subtree to re-evaluate when the palette changes, so
        // every token-derived colour repaints at once.
        .id(paletteID)
        .preferredColorScheme(isDarkMode ? .dark : .light)
        .toolbar {
            ToolbarItem(placement: .automatic) {
                themeToggle
            }
        }
        .task { seedDefaultSettingIfNeeded() }
    }

    // MARK: - Titlebar controls (prototype: palette dots + light/dark)

    private var themeToggle: some View {
        Button {
            guard let setting = activeSettings.first else { return }
            setting.darkMode.toggle()
            modelContext.persist()
        } label: {
            Image(systemName: isDarkMode ? "sun.max" : "moon.fill")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(Theme.textSecondary)
                .frame(width: 26, height: 26)
                .background(Circle().fill(Theme.chip))
                .overlay { Circle().strokeBorder(Theme.hairline, lineWidth: 1) }
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .help(isDarkMode ? "Switch to light" : "Switch to dark")
    }

    // MARK: - Sidebar

    private var sidebar: some View {
        VStack(spacing: 0) {
            sidebarBranding
            Rectangle().fill(Theme.hairline).frame(height: 1)

            List(selection: $selectedTab) {
                Section {
                    sidebarRow(.dashboard)
                    sidebarRow(.invoices, count: allInvoices.count)
                    sidebarRow(.clients, count: allClients.count)
                } header: {
                    sidebarHeader("Billing")
                }

                Section {
                    sidebarRow(.settings)
                    sidebarRow(.tokens)
                } header: {
                    sidebarHeader("General")
                }
            }
            .listStyle(.sidebar)
            .scrollContentBackground(.hidden)
            .background(.ultraThinMaterial)
            .background(Theme.sidebarFill)
            // The system paints its own accent-coloured source-list selection on
            // top of the row background, which showed as a blue rim around our
            // inset pill. Clear the tint and the focus ring so the row we draw is
            // the only selection chrome on screen.
            .tint(.clear)
            .focusEffectDisabled()
            .overlay(alignment: .trailing) {
                Rectangle()
                    .fill(Theme.hairline)
                    .frame(width: 1)
            }
        }
        .navigationTitle("InvoiceFlow")
        .navigationSplitViewColumnWidth(min: 180, ideal: 214, max: 260)
    }

    /// Prototype `.side-label`: uppercase micro-heading above a nav group.
    private func sidebarHeader(_ title: String) -> some View {
        Text(title)
            .textCase(.uppercase)
            .font(.system(size: 9.5, weight: .semibold))
            .kerning(0.85)
            .foregroundColor(Theme.textMuted)
            .padding(.top, 12)
            .padding(.bottom, 6)
            .padding(.leading, 10)
            .listRowInsets(EdgeInsets())
    }

    /// Branding block above the nav (prototype `.side-brand`: app icon + name
    /// + profile sub-line, outside the scrolling nav list, above a hairline).
    private var sidebarBranding: some View {
        HStack(spacing: 10) {
            Image(nsImage: NSApplication.shared.applicationIconImage)
                .resizable()
                .frame(width: 30, height: 30)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text("InvoiceFlow")
                    .font(.system(size: 13, weight: .semibold))
                    .kerning(-0.13)
                    .foregroundColor(Theme.textPrimary)
                Text(profileName)
                    .font(.system(size: 10.5))
                    .foregroundColor(Theme.textMuted)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 14)
    }

    private func sidebarRow(_ tab: SidebarTab, count: Int? = nil) -> some View {
        SidebarItem(tab: tab, isSelected: selectedTab == tab, count: count)
    }

    private func seedDefaultSettingIfNeeded() {
        let descriptor = FetchDescriptor<Setting>()
        let existing = (try? modelContext.fetch(descriptor)) ?? []
        guard existing.isEmpty else {
            if let active = existing.first(where: { $0.isActive }) ?? existing.first {
                applySettingsGlobals(active)
            }
            return
        }
        let setting = Setting()
        modelContext.insert(setting)
        modelContext.persist()
        applySettingsGlobals(setting)
    }
}

// MARK: - Sidebar Item

/// One sidebar row. The selected row is the gradient pill from the prototype
/// (`.side-item.active`): accent → accentAlt fill, white label, soft glow.
struct SidebarItem: View {
    let tab: SidebarTab
    let isSelected: Bool
    var count: Int? = nil

    @State private var hovering = false

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 9, style: .continuous)

        HStack(spacing: 9) {
            Image(systemName: tab.icon)
                .font(.system(size: 13, weight: .medium))
                .frame(width: 16)
            Text(tab.rawValue)
                .font(.system(size: 12.5, weight: isSelected ? .semibold : .medium))
                .accessibilityIdentifier(tab.rawValue)
            Spacer(minLength: 6)
            if let count {
                Text("\(count)")
                    .font(.system(size: 10.5))
                    .monospacedDigit()
                    .foregroundColor(isSelected ? Theme.onAccent.opacity(0.85) : Theme.textMuted)
            }
        }
        .foregroundColor(isSelected ? Theme.onAccent : (hovering ? Theme.textPrimary : Theme.textSecondary))
        .padding(.horizontal, 10)
        .frame(height: 32)
        .background {
            shape
                .fill(isSelected ? AnyShapeStyle(Theme.gradient) : AnyShapeStyle(hovering ? Theme.hover : .clear))
        }
        .contentShape(shape)
        .scaleEffect(hovering ? 1.012 : 1)
        .animation(Theme.smooth, value: isSelected)
        .animation(Theme.quick, value: hovering)
        .tag(tab)
        .listRowInsets(EdgeInsets()) // pill spans the full row → covers the system's gray row container
        .listRowBackground(Color.clear)
        .onHover { hovering = $0 }
    }
}

enum SidebarTab: String, CaseIterable {
    case dashboard = "Dashboard"
    case invoices = "Invoices"
    case clients = "Clients"
    case tokens = "Tokens"
    case settings = "Settings"
    
    var icon: String {
        switch self {
        case .dashboard: return "square.grid.2x2"
        case .invoices: return "doc.text"
        case .clients: return "person.2"
        case .tokens: return "paintbrush"
        case .settings: return "gearshape"
        }
    }
}
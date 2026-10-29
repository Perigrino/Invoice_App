//
//  TokensPage.swift
//  InvoiceFlow
//
//  The design-system gallery (prototype "tokens overlay"): every surface
//  token, the gradient palettes, the countdown tile, and the Silk motion
//  vocabulary on one page so drift is visible at a glance.
//

import SwiftUI

struct TokensPage: View {
    @AppStorage(GradientPalette.storageKey) private var paletteID = GradientPalette.lagoon.rawValue

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                PageHeader("Tokens", subtitle: "The design system, on one page.") { }
                    .padding(.bottom, 6)

                palettesCard

                surfacesCard

                statusCard

                tileCard

                motionCard

                typeCard
            }
            .padding(24)
            .frame(maxWidth: 860, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Palettes

    private var palettesCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("Gradient Palettes")
            VStack(spacing: 10) {
                ForEach(GradientPalette.allCases) { palette in
                    Button {
                        // Reassign the static palette BEFORE the id flips, so
                        // the freshly built subtree draws with the new tokens.
                        Theme.palette = palette
                        palette.persist()
                        paletteID = palette.rawValue
                    } label: {
                        HStack(spacing: 12) {
                            Capsule()
                                .fill(
                                    LinearGradient(
                                        colors: [palette.dotTop, palette.dotBottom],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(width: 56, height: 20)
                                .overlay {
                                    Capsule().strokeBorder(Theme.hairline, lineWidth: 1)
                                }
                                .shadow(
                                    color: palette.glowStrong,
                                    radius: isActive(palette) ? 8 : 3,
                                    x: 0, y: 2
                                )
                            Text(palette.name)
                                .font(.system(size: 13, weight: isActive(palette) ? .semibold : .medium))
                                .foregroundColor(Theme.textPrimary)
                            Text(palette.note)
                                .font(.system(size: 11.5))
                                .foregroundColor(Theme.textMuted)
                            Spacer()
                            if isActive(palette) {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundColor(Theme.accent)
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: Theme.radiusControl, style: .continuous)
                                .fill(isActive(palette) ? AnyShapeStyle(Theme.selection) : AnyShapeStyle(Color.clear))
                        )
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .help("Use the \(palette.name) palette")
                }
            }
        }
        .cardContainer()
    }

    private func isActive(_ palette: GradientPalette) -> Bool {
        palette.rawValue == paletteID
    }

    // MARK: - Surfaces

    private var surfacesCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("Surfaces & Radii")
            VStack(alignment: .leading, spacing: 12) {
                swatchRow("Card fill", Theme.cardFill, "r 14")
                swatchRow("Card stroke", Theme.cardStrokeTop, "top edge")
                swatchRow("Field", Theme.field, "r 10")
                swatchRow("Chip", Theme.chip, "capsule")
                swatchRow("Hover", Theme.hover, "row state")
                swatchRow("Hairline", Theme.hairline, "1px")
            }
            HStack(spacing: 10) {
                Button { } label: { Text("Primary").font(.system(size: 12, weight: .semibold)) }
                    .capsuleButton(.primary, small: true)
                Button { } label: { Text("Plain").font(.system(size: 12, weight: .medium)) }
                    .capsuleButton(.plain, small: true)
                Button { } label: { Text("Ghost").font(.system(size: 12, weight: .medium)) }
                    .capsuleButton(.ghost, small: true)
            }
        }
        .cardContainer()
    }

    // MARK: - Status

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("Status Colors")
            VStack(spacing: 10) {
                statusRow(.paid)
                statusRow(.due)
                statusRow(.overdue)
                statusRow(.plain)
            }
        }
        .cardContainer()
    }

    private var statusRowKind: [StatusPill.Kind: String] {
        [.paid: "Paid", .due: "Due soon", .overdue: "Overdue", .plain: "Draft"]
    }

    private func statusRow(_ kind: StatusPill.Kind) -> some View {
        HStack(spacing: 12) {
            StatusPill(
                text: statusRowKind[kind] ?? "Status",
                kind: kind
            )
            colorDot(Theme.positive, "positive")
            colorDot(Theme.warning, "warning")
            colorDot(Theme.negative, "negative")
            Spacer()
        }
    }

    private func colorDot(_ color: Color, _ name: String) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 10, height: 10)
            Text(name).font(.system(size: 10.5)).foregroundColor(Theme.textMuted)
        }
    }

    // MARK: - Tile

    private var tileCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("Countdown Tile")
            HStack(spacing: 16) {
                sampleTile(number: "3", label: "Days", gradient: Theme.gradient, glow: Theme.glowAccent)
                sampleTile(number: "2", label: "Late", gradient: Theme.overdueGradient, glow: Theme.glowOverdueTile)
                VStack(spacing: 3) {
                    Image(systemName: "checkmark")
                        .font(.system(size: 13, weight: .semibold))
                    Text("PAID")
                        .font(.system(size: 8.5, weight: .semibold))
                        .tracking(0.6)
                }
                .foregroundColor(Theme.textSecondary)
                .frame(width: 56, height: 62)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Theme.hover)
                )
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(Theme.hairline, lineWidth: 1)
                }
                Spacer()
            }
        }
        .cardContainer()
    }

    private func sampleTile(number: String, label: String, gradient: LinearGradient, glow: Color) -> some View {
        VStack(spacing: 3) {
            Text(number)
                .font(.system(size: 17, weight: .bold, design: .rounded))
                .monospacedDigit()
            Text(label)
                .font(.system(size: 8.5, weight: .semibold))
                .tracking(0.6)
                .textCase(.uppercase)
                .opacity(0.9)
        }
        .foregroundColor(Theme.onAccent)
        .frame(width: 56, height: 62)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(gradient))
        .shadow(color: glow.opacity(0.22), radius: 9, x: 0, y: 8)
    }

    // MARK: - Motion

    private var motionCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("Silk Motion")
            VStack(alignment: .leading, spacing: 8) {
                motionRow("quick", "0.28s", "hover, press, tile swap")
                motionRow("smooth", "0.45s", "expand, filter, selection")
                motionRow("gentle", "0.60s", "page reveals, appear()")
                Text("Damping fraction 1.0 throughout — nothing overshoots.")
                    .font(.system(size: 11.5))
                    .foregroundColor(Theme.textMuted)
            }
        }
        .cardContainer()
    }

    private func motionRow(_ name: String, _ timing: String, _ use: String) -> some View {
        HStack(spacing: 10) {
            Text(name).font(.system(size: 12.5, weight: .semibold)).foregroundColor(Theme.accent)
            Text(timing).font(.system(size: 12, weight: .medium)).monospacedDigit().foregroundColor(Theme.textSecondary)
            Text("· \(use)").font(.system(size: 12)).foregroundColor(Theme.textMuted)
        }
    }

    // MARK: - Type

    private var typeCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("Type")
            VStack(alignment: .leading, spacing: 8) {
                Text("Page Title").font(.system(size: 26, weight: .bold)).kerning(-0.39)
                Text("Row title 13.5 · semibold").font(.system(size: 13.5, weight: .semibold))
                Text("Body 12.5 · heading for field values").font(.system(size: 12.5))
                Text("Micro heading 9.5 · SEMIBOLD TRACKED").font(.system(size: 9.5, weight: .semibold)).kerning(0.85)
                    .textCase(.uppercase)
            }
            .foregroundColor(Theme.textPrimary)
        }
        .cardContainer()
    }

    // MARK: - Helpers

    private func swatchRow(_ name: String, _ color: Color, _ note: String) -> some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .fill(color)
                .frame(width: 44, height: 22)
                .overlay {
                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                        .strokeBorder(Theme.hairline, lineWidth: 1)
                }
            Text(name).font(.system(size: 12.5, weight: .medium)).foregroundColor(Theme.textSecondary)
            Text(note).font(.system(size: 10.5)).foregroundColor(Theme.textMuted)
            Spacer()
        }
    }
}

/// Shared card wrapper for gallery sections.
private extension View {
    func cardContainer() -> some View {
        VStack(alignment: .leading, spacing: 0) { self }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .glassCard(radius: Theme.radiusLarge)
    }
}

import SwiftUI
import AppKit

/// Pins the row height of the `NSTableView` that backs a SwiftUI `List`.
///
/// `List` self-sizes rows by measuring them the first time they are laid out.
/// A row that is *inserted* while the list cannot lay it out — for example
/// while the Create sheet covers the window, or during the row-insertion
/// animation — keeps the table's default 24pt height forever after. Its
/// content then spills over the next row, which reads as "the previous record
/// overlaps the new one".
///
/// Every row in this app's lists has a fixed content height, so pinning the
/// table's row height and asking it to re-measure whenever the row count
/// changes makes layout deterministic. Attach with a `dataCount` that changes
/// whenever rows are added or removed.
struct TableRowHeightFix: NSViewRepresentable {
    var height: CGFloat
    /// Change this whenever rows are added/removed so the table re-measures.
    var dataCount: Int

    func makeNSView(context: Context) -> NSView {
        let probe = ProbeView()
        DispatchQueue.main.async { Self.apply(to: probe, height: height) }
        return probe
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async { Self.apply(to: nsView, height: height) }
    }

    /// Finds the nearest enclosing `NSTableView` (the one that owns this list,
    /// not the sidebar's) and pins its row height.
    private static func apply(to view: NSView, height: CGFloat) {
        guard let table = nearestTable(from: view) else { return }
        if table.rowHeight != height {
            table.rowHeight = height
        }
        guard table.numberOfRows > 0 else { return }
        table.noteHeightOfRows(withIndexesChanged: IndexSet(integersIn: 0..<table.numberOfRows))
    }

    /// Walk up the hierarchy; the first ancestor whose subtree contains an
    /// `NSTableView` owns this list.
    private static func nearestTable(from view: NSView) -> NSTableView? {
        var ancestor = view.superview
        while let level = ancestor {
            if let table = firstTable(in: level) { return table }
            ancestor = level.superview
        }
        return nil
    }

    private static func firstTable(in root: NSView) -> NSTableView? {
        for sub in root.subviews {
            if let table = sub as? NSTableView { return table }
            if let found = firstTable(in: sub) { return found }
        }
        return nil
    }

    /// Invisible, non-interactive probe dropped into the list's layout.
    private final class ProbeView: NSView {
        override func hitTest(_ point: NSPoint) -> NSView? { nil }
    }
}

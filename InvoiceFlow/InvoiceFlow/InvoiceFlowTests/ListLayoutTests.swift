import XCTest
import SwiftUI
import Combine
import SwiftData
@testable import InvoiceFlow

/// Reproduces the "new row is overlapped by the previous row" rendering bug
/// reported on the Invoices and Clients list views.
///
/// The list is hosted in a real window, rows are inserted over time (the way
/// the Create sheet inserts them), and every visible text frame is measured.
/// Two texts whose frames intersect means rows are drawn on top of each other.
final class ListLayoutTests: XCTestCase {

    private var window: NSWindow?

    override func tearDown() {
        window?.close()
        window = nil
        super.tearDown()
    }

    @MainActor
    func testInvoiceRowsDoNotOverlapWhenInvoiceIsCreated() throws {
        let container = try makeContainer()
        let context = container.mainContext

        let afd = Client(fullName: "AFD")
        let ppl = Client(fullName: "PPL NET GHANA")
        context.insert(afd)
        context.insert(ppl)

        let first = Invoice(invoiceNumber: "AFD-26-546532",
                            createdAt: Date().addingTimeInterval(-7200))
        first.client = afd
        context.insert(first)
        try context.save()

        let window = try host(InvoiceListView(), context: context)
        settle(0.6)

        // Simulate the user creating two more invoices from the Create sheet.
        let second = Invoice(invoiceNumber: "PPL-26-753287", createdAt: Date())
        second.client = ppl
        context.insert(second)
        try context.save()
        settle(0.6)

        let third = Invoice(invoiceNumber: "AFD-26-546543",
                            createdAt: Date().addingTimeInterval(60))
        third.client = afd
        context.insert(third)
        try context.save()
        settle(1.0)

        let overlaps = overlappingTextPairs(in: window)
        let overflows = rowOverflowIssues(in: window)
        saveSnapshot(of: window, named: "invoice-list")
        print("ListLayoutTests: INVOICE TREE\n" + dumpTree(in: window))

        XCTAssertTrue(
            overflows.isEmpty,
            "Invoice row content overflows its row (clipped / painted over the next row):\n"
                + overflows.joined(separator: "\n")
        )
        XCTAssertTrue(
            overlaps.isEmpty,
            "Invoice rows overlap:\n" + describe(overlaps)
        )
    }

    @MainActor
    func testClientRowsDoNotOverlapWhenClientIsCreated() throws {
        let container = try makeContainer()
        let context = container.mainContext

        let first = Client(fullName: "AFD", company: "AFD")
        context.insert(first)
        try context.save()

        let window = try host(ClientListView(), context: context)
        settle(0.6)

        for (index, name) in ["PPL NET GHANA", "Acme Corp"].enumerated() {
            let client = Client(fullName: name,
                                createdAt: Date().addingTimeInterval(Double(index)))
            context.insert(client)
            try context.save()
            settle(0.6)
        }

        let overlaps = overlappingTextPairs(in: window)
        let overflows = rowOverflowIssues(in: window)
        saveSnapshot(of: window, named: "client-list")
        print("ListLayoutTests: CLIENT TREE\n" + dumpTree(in: window))

        XCTAssertTrue(
            overflows.isEmpty,
            "Client row content overflows its row (clipped / painted over the next row):\n"
                + overflows.joined(separator: "\n")
        )
        XCTAssertTrue(
            overlaps.isEmpty,
            "Client rows overlap:\n" + describe(overlaps)
        )
    }

    @MainActor
    func testInvoiceCreatedBehindCreateSheetDoesNotOverlap() throws {
        let container = try makeContainer()
        let context = container.mainContext

        let afd = Client(fullName: "AFD")
        let ppl = Client(fullName: "PPL NET GHANA")
        context.insert(afd)
        context.insert(ppl)

        let first = Invoice(invoiceNumber: "AFD-26-546532",
                            createdAt: Date().addingTimeInterval(-7200))
        first.client = afd
        context.insert(first)
        try context.save()

        let control = SheetControl()
        let window = try host(HarnessView(control: control), context: context)
        settle(1.0)

        // Create two more invoices the way the app does it: the form sheet is
        // on screen, the record is inserted behind it, then the sheet dismisses.
        let creations: [(Invoice, Client)] = {
            let second = Invoice(invoiceNumber: "PPL-26-753287", createdAt: Date())
            second.client = ppl
            let third = Invoice(invoiceNumber: "AFD-26-546543",
                                createdAt: Date().addingTimeInterval(60))
            third.client = afd
            return [(second, ppl), (third, afd)]
        }()

        for (invoice, _) in creations {
            control.show = true
            settle(0.6)
            context.insert(invoice)
            try context.save()
            settle(0.6)
            control.show = false
            settle(1.0)
        }

        let overlaps = overlappingTextPairs(in: window)
        let overflows = rowOverflowIssues(in: window)
        saveSnapshot(of: window, named: "invoice-list-sheet")
        print("ListLayoutTests: SHEET TREE\n" + dumpTree(in: window))

        XCTAssertTrue(
            overflows.isEmpty,
            "Invoice row content overflows its row after creating behind the sheet:\n"
                + overflows.joined(separator: "\n")
        )
        XCTAssertTrue(
            overlaps.isEmpty,
            "Invoice rows overlap after creating behind the sheet:\n" + describe(overlaps)
        )
    }

    // MARK: - Helpers

    private func makeContainer() throws -> ModelContainer {
        try ModelContainer(
            for: Invoice.self, InvoiceLineItem.self, Client.self, Company.self, Setting.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
    }

    private func host<Content: View>(_ view: Content, context: ModelContext) throws -> NSWindow {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1000, height: 500),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.isReleasedWhenClosed = false
        window.contentView = NSHostingView(
            rootView: view
                .environment(\.modelContext, context)
                .frame(minWidth: 900, minHeight: 400)
        )
        window.center()
        window.orderFrontRegardless()
        self.window = window
        return window
    }

    private func settle(_ seconds: TimeInterval) {
        RunLoop.current.run(until: Date().addingTimeInterval(seconds))
    }

    /// Collects every visible text label in the window, keyed by its string,
    /// and returns pairs whose frames intersect.
    /// Rows whose content is taller than the row itself: the extra lines are
    /// clipped or painted over the neighbouring row (the reported overlap).
    private func rowOverflowIssues(in window: NSWindow?) -> [String] {
        guard let window, let content = window.contentView else { return [] }
        var issues: [String] = []

        for row in content.descendants where String(describing: type(of: row)).contains("TableRowView") {
            let rowBounds = row.bounds
            for field in row.descendants.compactMap({ $0 as? NSTextField }) {
                guard !field.isHidden, !field.stringValue.isEmpty else { continue }
                let frame = row.convert(field.convert(field.bounds, to: nil), from: nil)
                if frame.maxY > rowBounds.maxY + 1 || frame.minY < rowBounds.minY - 1 {
                    issues.append(
                        "row \(rowBounds) cannot hold \"\(field.stringValue)\" at \(frame)"
                    )
                }
            }
            for cell in row.descendants where cell is NSTableCellView {
                if cell.frame.height > rowBounds.height + 1 {
                    issues.append(
                        "row height \(rowBounds.height) < cell content height \(cell.frame.height)"
                    )
                }
            }
        }
        return issues
    }

    private func overlappingTextPairs(in window: NSWindow?) -> [(String, CGRect, String, CGRect)] {
        guard let window, let content = window.contentView else { return [] }
        let texts = content.descendants.compactMap { view -> (String, CGRect)? in
            guard let field = view as? NSTextField, !field.isHidden, !field.stringValue.isEmpty else { return nil }
            guard let windowFrame = view.window?.frame else { return nil }
            let frame = view.convert(view.bounds, to: nil)
            // `convert(_:to: nil)` is in window-base coordinates; convert to screen.
            let screen = CGRect(
                x: windowFrame.origin.x + frame.origin.x,
                y: windowFrame.origin.y + frame.origin.y,
                width: frame.width,
                height: frame.height
            )
            return (field.stringValue, screen)
        }

        var pairs: [(String, CGRect, String, CGRect)] = []
        for i in texts.indices {
            for j in (i + 1)..<texts.count {
                let a = texts[i], b = texts[j]
                if a.1.intersects(b.1) {
                    pairs.append((a.0, a.1, b.0, b.1))
                }
            }
        }
        return pairs
    }

    private func describe(_ pairs: [(String, CGRect, String, CGRect)]) -> String {
        pairs.map { pair in
            let (aText, aFrame, bText, bFrame) = pair
            return "\"\(aText)\" @\(aFrame.origin.y)x\(aFrame.origin.x) (\(aFrame.width)x\(aFrame.height))\n" +
                "  overlaps \"\(bText)\" @\(bFrame.origin.y)x\(bFrame.origin.x) (\(bFrame.width)x\(bFrame.height))"
        }.joined(separator: "\n")
    }

    private func dumpTree(in window: NSWindow?) -> String {
        guard let window, let content = window.contentView else { return "<no window>" }
        var lines: [String] = []

        func walk(_ view: NSView, depth: Int) {
            let indent = String(repeating: "  ", count: depth)
            var extra = ""
            if let table = view as? NSTableView {
                extra = " numberOfRows=\(table.numberOfRows)"
                for row in 0..<table.numberOfRows {
                    let rect = table.rect(ofRow: row)
                    extra += "\n\(indent)    row[\(row)] y=\(rect.origin.y) h=\(rect.height)"
                }
            }
            if let field = view as? NSTextField, !field.stringValue.isEmpty {
                extra = " \"\(field.stringValue)\""
            }
            if let cell = view as? NSTableCellView {
                extra += " cellText=\(cell.textField?.stringValue ?? "-")"
            }
            lines.append("\(indent)\(type(of: view)) frame=\(view.frame)\(extra)")
            for sub in view.subviews { walk(sub, depth: depth + 1) }
        }

        walk(content, depth: 0)
        return lines.joined(separator: "\n")
    }

    private func saveSnapshot(of window: NSWindow, named name: String) {
        guard let content = window.contentView else { return }
        let bounds = content.bounds
        let scale = window.backingScaleFactor
        guard let rep = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: max(Int(bounds.width * scale), 1),
            pixelsHigh: max(Int(bounds.height * scale), 1),
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        ) else { return }
        rep.size = bounds.size
        guard let ctx = NSGraphicsContext(bitmapImageRep: rep) else { return }
        let cg = ctx.cgContext
        cg.saveGState()
        cg.translateBy(x: 0, y: bounds.height * scale)
        cg.scaleBy(x: scale, y: -scale)
        if let layer = content.layer {
            layer.render(in: cg)
        } else {
            content.cacheDisplay(in: bounds, to: rep)
        }
        cg.restoreGState()
        guard let png = rep.representation(using: .png, properties: [:]) else { return }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("list-layout-\(name)-\(UUID().uuidString.prefix(8)).png")
        try? png.write(to: url)
        print("ListLayoutTests: snapshot written to \(url.path)")
    }
}

private extension NSView {
    var descendants: [NSView] {
        subviews.flatMap { [$0] + $0.descendants }
    }
}

private final class SheetControl: ObservableObject {
    @Published var show = false
}

/// Mirrors the app shell: the list lives inside `ContentView`, and records are
/// inserted while the Create sheet is presented (then the sheet dismisses).
private struct HarnessView: View {
    @ObservedObject var control: SheetControl

    var body: some View {
        ContentView()
            .sheet(isPresented: $control.show) {
                InvoiceFormView()
            }
    }
}

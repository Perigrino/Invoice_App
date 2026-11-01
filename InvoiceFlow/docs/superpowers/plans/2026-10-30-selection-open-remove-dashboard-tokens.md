# Selection UI, Open Invoice, Remove Draft Tile / Dashboard / Tokens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the mixed-color selection chrome on sidebar and list rows, make an invoice row click open its detail, drop the "Draft" tile, and remove the Dashboard and Tokens pages the user never asked for.

**Architecture:** The broken selection UI comes from native `List(selection:)` — AppKit's `NSTableView` paints its own blue/gray selection behind our custom cards, which `.tint(.clear)` cannot fully suppress on macOS 26/27. The fix removes `List(selection:)` everywhere and turns rows/sidebar items into plain `Button`s, so our card/pill is the only chrome. Single-click on an invoice row now opens the detail sheet (matching the clients list). Dashboard and Tokens are deleted from the view switch, sidebar, `SidebarTab`, and the Xcode project; `statusFilter` collapses back to local `@State` on `InvoiceListView`.

**Tech Stack:** Swift 6, SwiftUI, SwiftData, XCTest (hosted NSWindow tests). No new dependencies.

## Global Constraints

- Money stays `Decimal`; `Double` only for percent fields and quantity (never changes in this plan).
- No new files may be created without registering them in `project.pbxproj` in all four places (PBXBuildFile, PBXFileReference, group children, Sources phase) — prefer editing existing files; deletion also requires all four places.
- Build must stay green: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow build` from `/Users/perigrino/Projects/Invoice_App/InvoiceFlow`.
- All tests must stay green: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow test -only-testing:InvoiceFlowTests`.
- Follow existing patterns: `.buttonStyle(.plain)` on rows, `Theme.*` tokens, `glassCard()`, capsule buttons, two-parameter `onChange(of:) { _, new in }`.
- Design language: one accent, status color always with a word/icon, 13pt body, no hardcoded white/black in chrome (mac-design skill).
- Version bump for release: MARKETING_VERSION 2.3.0 → 2.4.0, CURRENT_PROJECT_VERSION 4 → 5.

---

### Task 1: Sidebar rows become buttons (kill the blue selection rim)

**Files:**
- Modify: `InvoiceFlow/Views/ContentView.swift` (sidebar var ~line 901-941, `sidebarRow` ~line 981, `SidebarItem` ~line 1005)

**Interfaces:**
- Consumes: `SidebarTab`, `SidebarItem(tab:isSelected:count:)`, `selectedTab` state.
- Produces: `sidebarRow(_:count:)` signature unchanged (now returns a `Button`); `SidebarTab` unchanged (dashboard/tokens cases removed later in Task 5/6).

- [ ] **Step 1: Replace the sidebar `List(selection:)` with a plain `List` and button rows**

In `ContentView.sidebar`, replace:

```swift
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
```

with:

```swift
            List {
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
            // No List(selection:) on purpose: the system's source-list selection
            // painted a blue rim around our gradient pill (the selection bug the
            // user reported). Rows are Buttons; the pill is the only chrome.
            .focusEffectDisabled()
```

- [ ] **Step 2: Make `sidebarRow` a Button**

Replace:

```swift
    private func sidebarRow(_ tab: SidebarTab, count: Int? = nil) -> some View {
        SidebarItem(tab: tab, isSelected: selectedTab == tab, count: count)
    }
```

with:

```swift
    private func sidebarRow(_ tab: SidebarTab, count: Int? = nil) -> some View {
        Button {
            selectedTab = tab
        } label: {
            SidebarItem(tab: tab, isSelected: selectedTab == tab, count: count)
        }
        .buttonStyle(.plain)
    }
```

- [ ] **Step 3: Move list-row modifiers from `SidebarItem` onto the button, drop `.tag`**

In `SidebarItem.body`, delete these three modifiers from the end of the body (they only work on direct `List` row content, and the body is now nested inside a `Button`):

```swift
        .tag(tab)
        .listRowInsets(EdgeInsets()) // pill spans the full row → covers the system's gray row container
        .listRowBackground(Color.clear)
```

Re-add them in `sidebarRow` after `.buttonStyle(.plain)`:

```swift
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets()) // pill spans the full row → covers the system's gray row container
        .listRowBackground(Color.clear)
```

- [ ] **Step 4: Build**

Run: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow build`
Expected: BUILD SUCCEEDED.

- [ ] **Step 5: Commit**

```bash
git add InvoiceFlow/Views/ContentView.swift
git commit -m "Fix: sidebar rows as buttons — no system blue selection rim"
```

---

### Task 2: Invoice list — button rows, single click opens the detail

**Files:**
- Modify: `InvoiceFlow/Views/Invoices/InvoiceListView.swift` (state lines 7-16, header Export button lines 33-53, onChange line 121, `invoiceList` ~line 216, `invoiceRow` ~line 257, `InvoiceRow` body ~line 405-458, `InvoiceRow.isSelected` line 346)

**Interfaces:**
- Consumes: `InvoiceRow(invoice:isSelected:)` (signature changes), `viewingInvoice` sheet (already exists), `statusFilter` binding (unchanged until Task 5).
- Produces: `InvoiceRow(invoice:)` — no `isSelected` parameter; row Button exposes `accessibilityIdentifier("invoiceRow-<invoiceNumber>")` which Task 2's test uses; `ListLayoutTests` still compiles (its `InvoiceListView(statusFilter:)` call unchanged until Task 5).

- [ ] **Step 1: Drop multi-select state, the selection-driven Export button, and the statusFilter onChange**

Delete from `InvoiceListView`:

```swift
    @State private var selectedInvoices = Set<Invoice>()
```

Delete the `onChange` modifier block:

```swift
        // A changed filter can leave selection pointing at rows that are no longer
        // visible, so drop it whenever the filter moves (S-022).
        .onChange(of: statusFilter) { _, _ in
            selectedInvoices.removeAll()
        }
```

Delete the header Export PDF button (its only job was exporting the selection; per-invoice Export PDF remains in the row context menu):

```swift
                Button {
                    exportingInvoice = selectedInvoices.sorted { $0.createdAt > $1.createdAt }.first
                } label: {
                    Label("Export PDF", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.plain)
                .capsuleButton(.ghost)
                .opacity(selectedInvoices.isEmpty ? 0.45 : 1)
                .disabled(selectedInvoices.isEmpty)
                .accessibilityIdentifier("exportSelectedPDF")
```

- [ ] **Step 2: Replace `List(selection:)` with a plain List of Button rows**

Replace `invoiceList`:

```swift
    private var invoiceList: some View {
        List(selection: $selectedInvoices) {
            ForEach(filteredInvoices) { invoice in
                invoiceRow(invoice)
                    .tag(invoice)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        // Our card is the only selection chrome on screen (see ContentView).
        .tint(.clear)
        .focusEffectDisabled()
        // Keep the table's row height in sync with the fixed row content —
        // rows inserted while a sheet covers the window are otherwise stuck at
        // the table's 24pt default (overlapping the next row).
        // See TableRowHeightFix.
        .overlay {
            TableRowHeightFix(
                height: InvoiceRow.tableRowHeight,
                dataCount: filteredInvoices.count
            )
        }
    }
```

with:

```swift
    private var invoiceList: some View {
        List {
            ForEach(filteredInvoices) { invoice in
                invoiceRow(invoice)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        // No List(selection:): the system selection painted a blue band behind
        // the translucent card. Rows are Buttons — one click opens the invoice.
        .focusEffectDisabled()
        // Keep the table's row height in sync with the fixed row content —
        // rows inserted while a sheet covers the window are otherwise stuck at
        // the table's 24pt default (overlapping the next row).
        // See TableRowHeightFix.
        .overlay {
            TableRowHeightFix(
                height: InvoiceRow.tableRowHeight,
                dataCount: filteredInvoices.count
            )
        }
    }
```

- [ ] **Step 3: Make the row a Button that opens the detail sheet**

Replace `invoiceRow(_:)`:

```swift
    private func invoiceRow(_ invoice: Invoice) -> some View {
        InvoiceRow(
            invoice: invoice,
            isSelected: selectedInvoices.contains(invoice)
        )
        .contextMenu {
```

with:

```swift
    private func invoiceRow(_ invoice: Invoice) -> some View {
        Button {
            viewingInvoice = invoice
        } label: {
            InvoiceRow(invoice: invoice)
        }
        .buttonStyle(.plain)
        // The press test in ListLayoutTests finds this row.
        .accessibilityIdentifier("invoiceRow-\(invoice.invoiceNumber)")
        .listRowInsets(EdgeInsets(top: 5, leading: 28, bottom: 5, trailing: 28))
        .listRowSeparator(.hidden)
        .listRowBackground(Color.clear)
        .contextMenu {
```

(the `contextMenu` body — View Details, Edit, Duplicate, Add Payment…, Export PDF, Delete — stays exactly as is, just now attached to the Button).

- [ ] **Step 4: Remove `isSelected` from `InvoiceRow`**

In `InvoiceRow`, delete the property:

```swift
    var isSelected: Bool = false
```

In the row body, replace the selected stroke with the plain stroke and the hover shadow constant:

```swift
        .overlay {
            shape.strokeBorder(
                LinearGradient(
                    colors: isSelected
                        ? [Theme.accent, Theme.accent]
                        : [Theme.cardStrokeTop, Theme.cardStrokeBottom],
                    startPoint: .top,
                    endPoint: .bottom
                ),
                lineWidth: isSelected ? 1.5 : 1
            )
        }
        .clipShape(shape)
        .shadow(color: hovering ? .black.opacity(isSelected ? 0.4 : 0.35) : .clear, radius: 14, x: 0, y: 6)
        .scaleEffect(hovering ? 1.006 : 1)
        .listRowInsets(EdgeInsets(top: 5, leading: 28, bottom: 5, trailing: 28))
        .listRowSeparator(.hidden)
        .listRowBackground(Color.clear)
        .animation(Theme.smooth, value: isSelected)
        .animation(Theme.quick, value: hovering)
```

with:

```swift
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
        .shadow(color: hovering ? .black.opacity(0.35) : .clear, radius: 14, x: 0, y: 6)
        .scaleEffect(hovering ? 1.006 : 1)
        .animation(Theme.quick, value: hovering)
```

(The `.listRowInsets/.listRowSeparator/.listRowBackground` moved to the Button in Step 3 because they only apply to direct row content.)

- [ ] **Step 5: Write the failing click-opens-detail test**

Add to `InvoiceFlow/InvoiceFlowTests/ListLayoutTests.swift` (after `testInvoiceCreatedBehindCreateSheetDoesNotOverlap`):

```swift
    /// S-bugfix: one click on an invoice row opens its detail sheet
    /// (it used to only select the row, which did nothing visible).
    @MainActor
    func testClickingInvoiceRowOpensDetailSheet() throws {
        let container = try makeContainer()
        let context = container.mainContext

        let invoice = Invoice(invoiceNumber: "AFD-26-546532", createdAt: Date())
        context.insert(invoice)
        try context.save()

        let window = try host(InvoiceListView(statusFilter: .constant(nil)), context: context)
        settle(0.6)
        XCTAssertNil(window.attachedSheet, "detail sheet should start closed")

        let row = findAccessibilityElement(
            in: window.contentView,
            identifier: "invoiceRow-AFD-26-546532"
        )
        guard let row else {
            return XCTFail("no accessibility element with identifier invoiceRow-AFD-26-546532")
        }
        XCTAssertTrue(row.accessibilityPerformPress(), "row should accept the press action")

        settle(1.0)
        XCTAssertNotNil(window.attachedSheet, "clicking the row must open the detail sheet")
    }

    private func findAccessibilityElement(
        in view: NSView?,
        identifier: String
    ) -> NSAccessibilityElement? {
        guard let view else { return nil }
        if view.accessibilityIdentifier() == identifier { return view }
        for child in view.accessibilityChildren() ?? [] {
            if let element = child as? NSView, element.accessibilityIdentifier() == identifier {
                return element
            }
            if child is NSAccessibilityElement,
               (child as? NSAccessibilityElement)?.accessibilityIdentifier() == identifier {
                return child as? NSAccessibilityElement
            }
            if let nested = child as? NSView,
               let found = findAccessibilityElement(in: nested, identifier: identifier) {
                return found
            }
        }
        return nil
    }
```

- [ ] **Step 6: Run the test to verify it fails for the right reason (before Step 2-4 fixes are exercised)**

Run: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow test -only-testing:InvoiceFlowTests/ListLayoutTests/testClickingInvoiceRowOpensDetailSheet`
Expected: after Step 1-4 the test compiles; if the sheet does not open, FAIL with "clicking the row must open the detail sheet". (If the row identifier cannot be found, first confirm `.accessibilityIdentifier` is applied to the Button in Step 3, then re-run.)

- [ ] **Step 7: Build and run the full suite**

Run: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow test -only-testing:InvoiceFlowTests`
Expected: TEST SUCCEEDED (51 tests, 0 failures).

- [ ] **Step 8: Commit**

```bash
git add InvoiceFlow/Views/Invoices/InvoiceListView.swift InvoiceFlow/InvoiceFlowTests/ListLayoutTests.swift
git commit -m "Fix: invoice row click opens detail; drop selection chrome"
```

---

### Task 3: Client list — same button treatment (identical mixed-selection chrome)

**Files:**
- Modify: `InvoiceFlow/Views/Clients/ClientListView.swift` (state lines 9-13, onChange lines 80-85, `clientList` ~line 127, `ClientRow` lines 171-249)

**Interfaces:**
- Consumes: `ClientRow(client:isSelected:)`, `editingClient` sheet (exists).
- Produces: `ClientRow(client:)` — no `isSelected`; `ListLayoutTests.testClientRowsDoNotOverlapWhenClientIsCreated` keeps hosting `ClientListView()` unchanged.

- [ ] **Step 1: Delete selection state and the selection-driven onChange**

Delete from `ClientListView`:

```swift
    @State private var selectedClient: Client? = nil
    @State private var selectedClients = Set<Client>()
```

and delete:

```swift
        .onChange(of: selectedClients) { _, newSelection in
            if let first = newSelection.first {
                editingClient = first
                selectedClients.removeAll()
            }
        }
```

- [ ] **Step 2: Replace `List(selection:)` with Button rows**

Replace:

```swift
    private var clientList: some View {
        List(selection: $selectedClients) {
            ForEach(filteredClients) { client in
                ClientRow(client: client, isSelected: selectedClients.contains(client))
                    .tag(client)
                    .contextMenu {
                        Button {
                            editingClient = client
                        } label: {
                            Label("Edit", systemImage: "pencil")
                        }
                        Divider()
                        Button(role: .destructive) {
                            clientToDelete = client
                            showDeleteConfirmation = true
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .tint(.clear)
        .focusEffectDisabled()
        // See TableRowHeightFix — guards against rows inserted behind the
        // Create sheet keeping the table's 24pt default height.
        .overlay {
            TableRowHeightFix(
                height: ClientRow.tableRowHeight,
                dataCount: filteredClients.count
            )
        }
    }
```

with:

```swift
    private var clientList: some View {
        List {
            ForEach(filteredClients) { client in
                clientRow(client)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        // No List(selection:): same mixed selection chrome fix as the invoice
        // list. One click opens the client editor (as before).
        .focusEffectDisabled()
        // See TableRowHeightFix — guards against rows inserted behind the
        // Create sheet keeping the table's 24pt default height.
        .overlay {
            TableRowHeightFix(
                height: ClientRow.tableRowHeight,
                dataCount: filteredClients.count
            )
        }
    }

    private func clientRow(_ client: Client) -> some View {
        Button {
            editingClient = client
        } label: {
            ClientRow(client: client)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("clientRow-\(client.fullName)")
        .listRowInsets(EdgeInsets(top: 5, leading: 28, bottom: 5, trailing: 28))
        .listRowSeparator(.hidden)
        .listRowBackground(Color.clear)
        .contextMenu {
            Button {
                editingClient = client
            } label: {
                Label("Edit", systemImage: "pencil")
            }
            Divider()
            Button(role: .destructive) {
                clientToDelete = client
                showDeleteConfirmation = true
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }
```

- [ ] **Step 3: Remove `isSelected` from `ClientRow`**

Delete from `ClientRow`:

```swift
    var isSelected: Bool = false
```

Replace in the body:

```swift
        .overlay {
            shape.strokeBorder(
                LinearGradient(
                    colors: isSelected
                        ? [Theme.accent, Theme.accent]
                        : [Theme.cardStrokeTop, Theme.cardStrokeBottom],
                    startPoint: .top,
                    endPoint: .bottom
                ),
                lineWidth: isSelected ? 1.5 : 1
            )
        }
        .clipShape(shape)
        .shadow(color: hovering ? .black.opacity(0.35) : .clear, radius: 14, x: 0, y: 6)
        .scaleEffect(hovering ? 1.006 : 1)
        .listRowInsets(EdgeInsets(top: 5, leading: 28, bottom: 5, trailing: 28))
        .listRowSeparator(.hidden)
        .listRowBackground(Color.clear)
        .animation(Theme.smooth, value: isSelected)
        .animation(Theme.quick, value: hovering)
```

with:

```swift
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
        .shadow(color: hovering ? .black.opacity(0.35) : .clear, radius: 14, x: 0, y: 6)
        .scaleEffect(hovering ? 1.006 : 1)
        .animation(Theme.quick, value: hovering)
```

- [ ] **Step 4: Build and run tests**

Run: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow test -only-testing:InvoiceFlowTests`
Expected: TEST SUCCEEDED (51 tests, 0 failures — client list behavior unchanged, chrome fixed).

- [ ] **Step 5: Commit**

```bash
git add InvoiceFlow/Views/Clients/ClientListView.swift
git commit -m "Fix: client list rows as buttons — drop system selection chrome"
```

---

### Task 4: Remove the "Draft" tile from invoices without a due date

**Files:**
- Modify: `InvoiceFlow/Views/Invoices/InvoiceListView.swift` (`tileKind` ~line 519-534)
- Test: `InvoiceFlow/InvoiceFlowTests/ListLayoutTests.swift` (extend `testInvoiceRowsDoNotOverlapWhenInvoiceIsCreated`)

**Interfaces:**
- Consumes: `InvoiceRow.tileKind` (private), `Invoice.dueDate`.
- Produces: no-due-date rows show a neutral muted "No due" calendar tile instead of "Draft"; the string "Draft" no longer renders anywhere in the invoice list.

- [ ] **Step 1: Write the failing test — no "Draft" text in the list**

Add at the end of `testInvoiceRowsDoNotOverlapWhenInvoiceIsCreated`, after `saveSnapshot` / before the final asserts (or as its own assert after them):

```swift
        // The "Draft" tile the user asked to remove must not render.
        XCTAssertFalse(
            dumpTree(in: window).contains("\"Draft\""),
            "invoice list still shows the Draft tile"
        )
```

Note: the existing fixture invoice (`AFD-26-546532`) has no due date, so it currently renders the Draft tile and this assert fails.

- [ ] **Step 2: Run the test to verify it fails**

Run: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow test -only-testing:InvoiceFlowTests/ListLayoutTests/testInvoiceRowsDoNotOverlapWhenInvoiceIsCreated`
Expected: FAIL with "invoice list still shows the Draft tile".

- [ ] **Step 3: Replace the Draft tile with a neutral "No due" tile**

In `InvoiceRow.tileKind`, replace:

```swift
            guard let due = invoice.dueDate else {
                return .muted("Draft", "calendar")
            }
```

with:

```swift
            guard let due = invoice.dueDate else {
                return .muted("No due", "calendar")
            }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow test -only-testing:InvoiceFlowTests/ListLayoutTests/testInvoiceRowsDoNotOverlapWhenInvoiceIsCreated`
Expected: PASS.

- [ ] **Step 5: Build and commit**

```bash
xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow build
git add InvoiceFlow/Views/Invoices/InvoiceListView.swift InvoiceFlow/InvoiceFlowTests/ListLayoutTests.swift
git commit -m "Fix: replace Draft tile with neutral No-due tile"
```

---

### Task 5: Remove the Dashboard

**Files:**
- Delete: `InvoiceFlow/Views/Design/DashboardView.swift`
- Modify: `InvoiceFlow/Views/ContentView.swift` (state `invoiceStatusFilter` line 813, switch case lines 828-829, `sidebarRow(.dashboard)` line 884, `SidebarTab.dashboard` line 1024, icon line 1032)
- Modify: `InvoiceFlow/Views/Invoices/InvoiceListView.swift` (`@Binding var statusFilter` line 8)
- Modify: `InvoiceFlow/InvoiceFlowTests/ListLayoutTests.swift` (line 39)
- Modify: `InvoiceFlow/InvoiceFlow.xcodeproj/project.pbxproj` (lines 18, 72, 159, 431)
- Modify: `docs/STORIES.md` (S-014 line ~127, S-040 line ~191, S-022 acceptance line 156, roadmap line 13)

**Interfaces:**
- Consumes: `SidebarTab`, `ContentView.detail` switch, `InvoiceListView(statusFilter:)`.
- Produces: `InvoiceListView()` with `@State private var statusFilter: InvoiceStatus? = nil`; `SidebarTab.allCases == [.invoices, .clients, .settings]`; `DashboardView` gone.

- [ ] **Step 1: Write the failing test — sidebar tab set**

Add to `ListLayoutTests`:

```swift
    /// Dashboard and Tokens are removed by user request; only the three
    /// working tabs remain.
    func testSidebarOnlyContainsLiveTabs() {
        XCTAssertEqual(SidebarTab.allCases, [.invoices, .clients, .settings])
    }
```

- [ ] **Step 2: Run it to verify it fails**

Run: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow test -only-testing:InvoiceFlowTests/ListLayoutTests/testSidebarOnlyContainsLiveTabs`
Expected: FAIL (allCases still contains `.dashboard` and `.tokens`).

- [ ] **Step 3: Edit `ContentView` — remove dashboard references**

1. Delete state line:

```swift
    @State private var invoiceStatusFilter: InvoiceStatus? = nil
```

2. Replace the detail switch cases:

```swift
                case .dashboard:
                    DashboardView(selectedTab: $selectedTab, invoiceStatusFilter: $invoiceStatusFilter)
                case .invoices:
                    InvoiceListView(statusFilter: $invoiceStatusFilter)
```

with:

```swift
                case .invoices:
                    InvoiceListView()
```

3. Delete the sidebar row line `sidebarRow(.dashboard)`.
4. Delete from `SidebarTab`: `case dashboard = "Dashboard"` and `case .dashboard: return "square.grid.2x2"`.

- [ ] **Step 4: Collapse `statusFilter` back to local state**

In `InvoiceListView`, replace:

```swift
    @Binding var statusFilter: InvoiceStatus?
```

with:

```swift
    @State private var statusFilter: InvoiceStatus? = nil
```

(placed with the other `@State` properties, after `@State private var searchText = ""`).

Update `ListLayoutTests` line 39:

```swift
        let window = try host(InvoiceListView(statusFilter: .constant(nil)), context: context)
```

to:

```swift
        let window = try host(InvoiceListView(), context: context)
```

and the same host call inside `testClickingInvoiceRowOpensDetailSheet` from Task 2.

- [ ] **Step 5: Delete the file and its project references**

```bash
git rm InvoiceFlow/Views/Design/DashboardView.swift
```

In `InvoiceFlow/InvoiceFlow.xcodeproj/project.pbxproj` delete all four entries:

- line 18: `DB01 /* DashboardView.swift in Sources */ = {isa = PBXBuildFile; fileRef = DB_FR01 /* DashboardView.swift */; };`
- line 72: `DB_FR01 /* DashboardView.swift */ = {isa = PBXFileReference; ... };`
- line 159: `DB_FR01,` (inside `DB_GRP01 /* Design */` children)
- line 431: `DB01 /* DashboardView.swift in Sources */,` (Sources build phase)

- [ ] **Step 6: Update `docs/STORIES.md`**

- Roadmap line 13: change `dashboard widgets, list-as-hub quick actions` → `list-as-hub quick actions`.
- S-014 (line ~127): change `Status: ...` → `Status: removed 2026-10-30 (user request: dashboard not needed; Invoices is the landing tab)`.
- S-040 (line ~191): set `Status: removed 2026-10-30 (dashboard removed by user request)`.
- S-022 acceptance (line 156): replace with `- [unit] Filter predicate covers all statuses.`

- [ ] **Step 7: Build and run all tests**

Run: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow test -only-testing:InvoiceFlowTests`
Expected: TEST SUCCEEDED (52 tests, 0 failures) — includes `testSidebarOnlyContainsLiveTabs` PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Remove Dashboard page per user request; status filter back to local state"
```

---

### Task 6: Remove the Tokens page

**Files:**
- Delete: `InvoiceFlow/Views/Design/TokensPage.swift` (this empties `Views/Design/`)
- Modify: `InvoiceFlow/Views/ContentView.swift` (switch case lines 834-835, `sidebarRow(.tokens)` line 893, `SidebarTab.tokens` line 1027, icon line 1035)
- Modify: `InvoiceFlow/InvoiceFlow.xcodeproj/project.pbxproj` (lines 19, 73, 160, 432, group lines 151, 156-164)
- Modify: `docs/STORIES.md` (S-010 line 96)

**Interfaces:**
- Consumes: `SidebarTab`, `ContentView.detail` switch, `GradientPalette` (stays — Theme uses it).
- Produces: palette frozen at the persisted value (default Lagoon); no in-app switcher. `@AppStorage paletteID` + `.id(paletteID)` in ContentView stay (harmless; Theme reads the same UserDefaults key).

- [ ] **Step 1: Edit `ContentView`**

1. Delete the detail switch case:

```swift
                case .tokens:
                    TokensPage()
```

2. Delete sidebar row line `sidebarRow(.tokens)`.
3. Delete from `SidebarTab`: `case tokens = "Tokens"` and `case .tokens: return "paintbrush"`.

- [ ] **Step 2: Delete the file and its project references**

```bash
git rm InvoiceFlow/Views/Design/TokensPage.swift
```

In `project.pbxproj` delete:

- line 19: `DB02 /* TokensPage.swift in Sources */ = {isa = PBXBuildFile; fileRef = DB_FR02 /* TokensPage.swift */; };`
- line 73: `DB_FR02 /* TokensPage.swift */ = {isa = PBXFileReference; ... };`
- line 160: `DB_FR02,` (Design group children — group becomes empty)
- line 432: `DB02 /* TokensPage.swift in Sources */,` (Sources build phase)
- lines 156-164: the whole `DB_GRP01 /* Design */ = { ... };` group definition (now empty)
- line 151: `DB_GRP01,` (Views group children)

Remove the now-empty directory if git did not: `rmdir InvoiceFlow/Views/Design`.

- [ ] **Step 3: Update `docs/STORIES.md` S-010**

Line 96: change to `Status: removed 2026-10-30 (Tokens page removed by user request; palette stays at saved/default Lagoon)`. Line 94 `- [self] Light/dark both render; switch in Settings.` → `- [self] Light/dark both render (palette fixed, no switcher).`

- [ ] **Step 4: Build and run all tests**

Run: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow test -only-testing:InvoiceFlowTests`
Expected: TEST SUCCEEDED (52 tests, 0 failures). `testSidebarOnlyContainsLiveTabs` still passes with `[.invoices, .clients, .settings]`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Remove Tokens page per user request"
```

---

### Task 7: Full verification pass

**Files:** none modified (verification only).

- [ ] **Step 1: Confirm nothing still references the removed types**

Run: `grep -rn "DashboardView\|TokensPage" InvoiceFlow/ --include="*.swift" --include="*.pbxproj"`
Expected: no output.

Run: `grep -rn "selectedInvoices\|selectedClients\|isSelected" InvoiceFlow/InvoiceFlow/Views/ --include="*.swift"`
Expected: no output (all selection machinery gone).

- [ ] **Step 2: Build + full test suite**

Run: `xcodebuild -project InvoiceFlow.xcodeproj -scheme InvoiceFlow test -only-testing:InvoiceFlowTests`
Expected: TEST SUCCEEDED, 52 tests, 0 failures.

- [ ] **Step 3: Light/dark visual check of every remaining surface**

Run the app (`open InvoiceFlow.xcodeproj` or build and run), screenshot: sidebar (selected pill has no blue rim), Invoices list (click a row → detail opens; no blue band behind rows; no Draft tile; status chips work), Clients list (click opens editor), Settings. Repeat in light mode (toggle via the sidebar footer button). Fix anything that regressed before proceeding.

- [ ] **Step 4: Note results in the session (no commit needed if nothing changed; commit fixes if any).**

---

### Task 8: Version bump, DMG rebuild, reinstall

**Files:**
- Modify: `InvoiceFlow/InvoiceFlow.xcodeproj/project.pbxproj` (MARKETING_VERSION 2.3.0 → 2.4.0, CURRENT_PROJECT_VERSION 4 → 5, all four occurrences)

**Interfaces:**
- Consumes: `/Users/perigrino/Projects/Invoice_App/scripts/build-dmg.sh` (Release universal, ad-hoc sign, UDZO DMG, verify).
- Produces: `dist/InvoiceFlow-2.4.0.dmg` installed at `/Applications/InvoiceFlow.app`.

- [ ] **Step 1: Bump the version**

In `project.pbxproj`, replace every `MARKETING_VERSION = 2.3.0;` with `MARKETING_VERSION = 2.4.0;` and every `CURRENT_PROJECT_VERSION = 4;` with `CURRENT_PROJECT_VERSION = 5;` (use replaceAll).

- [ ] **Step 2: Build the DMG**

Run: `/Users/perigrino/Projects/Invoice_App/scripts/build-dmg.sh`
Expected: script completes; `dist/InvoiceFlow-2.4.0.dmg` exists and its verification block passes (arch x86_64 arm64, version 2.4.0, bundle com.invoiceflow.app).

- [ ] **Step 3: Install to /Applications**

```bash
hdiutil attach /Users/perigrino/Projects/Invoice_App/dist/InvoiceFlow-2.4.0.dmg -nobrowse -readonly -mountpoint /tmp/invoiceflow-dmg
osascript -e 'quit app "InvoiceFlow"' || true
rm -rf /Applications/InvoiceFlow.app
ditto "/tmp/invoiceflow-dmg/InvoiceFlow.app" /Applications/InvoiceFlow.app
hdiutil detach /tmp/invoiceflow-dmg
```

Verify: `defaults read /Applications/InvoiceFlow.app/Contents/Info.plist CFBundleShortVersionString` → `2.4.0`.

- [ ] **Step 4: Launch and commit**

```bash
open /Applications/InvoiceFlow.app
git add -A
git commit -m "Release 2.4.0: selection/open fixes, Dashboard and Tokens removed"
```

---

## Self-Review notes (resolved during writing)

- Spec coverage: selection UI → Tasks 1-3; open invoice → Task 2; draft icon → Task 4; dashboard → Task 5; tokens → Task 6; release → Task 8.
- `exportingInvoice` state and `PDFExportView` sheet stay (per-row Export PDF context menu still uses them).
- `StatusPill.Kind`, `InvoiceStatus.filterLabel/pillKind` stay (status chips are kept).
- Task 5 must update BOTH `InvoiceListView(statusFilter:)` host calls in ListLayoutTests (original test + Task 2's click test).

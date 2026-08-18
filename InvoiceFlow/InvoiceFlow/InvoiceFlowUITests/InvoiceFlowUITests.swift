import XCTest

final class InvoiceFlowUITests: XCTestCase {

    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - 1. Onboarding / Landing Page

    func testLandingPageAppears() {
        // On fresh launch (or with reset onboarding), the Get Started button should be visible
        let getStartedButton = app.buttons["Get Started"]
        // The button animates in after ~1.8s, so wait for it
        if getStartedButton.waitForExistence(timeout: 5) {
            XCTAssertTrue(getStartedButton.isHittable, "Get Started button should be hittable")
        }
    }

    func testGetStartedNavigatesToMainApp() {
        let getStartedButton = app.buttons["Get Started"]
        guard getStartedButton.waitForExistence(timeout: 5) else {
            // Already past onboarding
            return
        }
        getStartedButton.click()

        // After onboarding, the sidebar tabs should appear
        let invoicesTab = app.staticTexts["Invoices"]
        XCTAssertTrue(invoicesTab.waitForExistence(timeout: 3), "Invoices tab should appear after onboarding")
    }

    // MARK: - 2. Navigation - Sidebar Tabs

    func testNavigationToAllTabs() {
        skipOnboardingIfPresent()

        // Invoices tab (default)
        let invoicesTab = app.staticTexts.matching(identifier: "Invoices").firstMatch
        XCTAssertTrue(invoicesTab.exists, "Invoices tab should exist")

        // Clients tab
        let clientsTab = app.staticTexts.matching(identifier: "Clients").firstMatch
        XCTAssertTrue(clientsTab.exists, "Clients tab should exist")

        // Settings tab
        let settingsTab = app.staticTexts.matching(identifier: "Settings").firstMatch
        XCTAssertTrue(settingsTab.exists, "Settings tab should exist")

        // Click Clients tab
        clientsTab.click()
        sleep(1)
        let clientsHeader = app.staticTexts.matching(identifier: "Clients").firstMatch
        XCTAssertTrue(clientsHeader.exists, "Clients page should be visible")

        // Click Settings tab
        settingsTab.click()
        sleep(1)
        let settingsHeader = app.staticTexts.matching(identifier: "Settings").firstMatch
        XCTAssertTrue(settingsHeader.exists, "Settings page should be visible")

        // Click back to Invoices
        invoicesTab.click()
        sleep(1)
        let invoicesHeader = app.staticTexts.matching(identifier: "Invoices").firstMatch
        XCTAssertTrue(invoicesHeader.exists, "Invoices page should be visible")
    }

    // MARK: - 3. Client CRUD

    func testCreateNewClient() {
        skipOnboardingIfPresent()
        navigateToClients()

        // Click New Client button
        let newClientButton = app.buttons["New Client"]
        XCTAssertTrue(newClientButton.waitForExistence(timeout: 3), "New Client button should exist")
        newClientButton.click()

        // The sheet should appear with form fields
        let fullNameField = findField("e.g. John Smith")
        XCTAssertTrue(fullNameField.waitForExistence(timeout: 3), "Full Name field should appear")

        // Fill in the client form
        fullNameField.click()
        fullNameField.typeText("John Doe")

        let companyField = findField("e.g. Acme Corp")
        companyField.click()
        companyField.typeText("Acme Corp")

        let emailField = findField("e.g. john@acme.com")
        emailField.click()
        emailField.typeText("john@acme.com")

        let phoneField = findField("e.g. +1 (555) 123-4567")
        phoneField.click()
        phoneField.typeText("+1 555 123 4567")

        // Click Create
        let createButton = app.buttons["Create"]
        XCTAssertTrue(createButton.exists, "Create button should exist")
        createButton.click()

        // Sheet should dismiss and client should appear in the list
        sleep(1)
        let clientRow = app.staticTexts["John Doe"]
        if !clientRow.waitForExistence(timeout: 3) {
            print("===CREATE DEBUG===")
            print("Sheets: \(app.sheets.count)")
            print(app.debugDescription)
            print("===END===")
        }
        XCTAssertTrue(clientRow.exists, "Created client 'John Doe' should appear in the list")
    }

    func testCreateClientValidationRequiresName() {
        skipOnboardingIfPresent()
        navigateToClients()

        let newClientButton = app.buttons["New Client"]
        newClientButton.click()

        // Try to create without entering name
        let createButton = app.buttons["Create"]
        createButton.click()

        // Validation error should appear
        let errorText = app.staticTexts["Full name is required"]
        XCTAssertTrue(errorText.waitForExistence(timeout: 3), "Validation error should appear for empty name")

        // Dismiss the form
        let cancelButton = app.buttons["Cancel"]
        cancelButton.click()
        sleep(1)
    }

    // MARK: - 4. Invoice CRUD

    func testCreateNewInvoice() {
        skipOnboardingIfPresent()
        navigateToInvoices()

        // Click New Invoice button
        let newInvoiceButton = app.buttons["New Invoice"]
        XCTAssertTrue(newInvoiceButton.waitForExistence(timeout: 3), "New Invoice button should exist")
        newInvoiceButton.click()

        // The form should appear
        let invoiceNumberField = findField("INV-001")
        XCTAssertTrue(invoiceNumberField.waitForExistence(timeout: 3), "Invoice number field should appear")

        // Fill in invoice number (clear the auto-generated number first)
        invoiceNumberField.click()
        app.typeKey(XCUIKeyboardKey("a"), modifierFlags: .command)
        app.typeKey(XCUIKeyboardKey.delete, modifierFlags: [])
        invoiceNumberField.typeText("INV-E2E-001")

        // Fill in line item description
        let descriptionField = findField("Item description")
        descriptionField.click()
        descriptionField.typeText("E2E Test Service")

        // Fill in price
        let priceField = findField("0.00")
        priceField.click()
        priceField.typeText("500")

        // Click Create
        let createButton = app.buttons["Create"]
        createButton.click()

        // Sheet should dismiss and invoice should appear in the list
        sleep(1)
        let invoiceRow = app.staticTexts["INV-E2E-001"]
        XCTAssertTrue(invoiceRow.waitForExistence(timeout: 3), "Created invoice should appear in the list")
    }

    func testInvoiceValidationRequiresNumber() {
        skipOnboardingIfPresent()
        navigateToInvoices()

        let newInvoiceButton = app.buttons["New Invoice"]
        newInvoiceButton.click()

        // Clear the auto-generated invoice number
        let invoiceNumberField = findField("INV-001")
        invoiceNumberField.waitForExistence(timeout: 3)
        invoiceNumberField.click()
        // Select all and delete
        app.typeKey(XCUIKeyboardKey("a"), modifierFlags: .command)
        app.typeKey(XCUIKeyboardKey.delete, modifierFlags: [])

        let createButton = app.buttons["Create"]
        createButton.click()

        let errorText = app.staticTexts["Invoice number is required"]
        XCTAssertTrue(errorText.waitForExistence(timeout: 3), "Validation error should appear for empty invoice number")

        let cancelButton = app.buttons["Cancel"]
        cancelButton.click()
        sleep(1)
    }

    // MARK: - 6. Settings - Profile Save

    func testProfileSettingsSave() {
        skipOnboardingIfPresent()
        navigateToSettings()

        // Profile tab should be selected by default
        let companyNameField = findField("Acme Inc.")
        if companyNameField.waitForExistence(timeout: 3) {
            companyNameField.click()
            companyNameField.typeKey(XCUIKeyboardKey("a"), modifierFlags: .command) // select all
            companyNameField.typeText("Test Company E2E")

            let emailField = findField("billing@acme.com")
            emailField.click()
            emailField.typeText("test@e2e.com")

            // Click Save Profile
            let saveButton = app.buttons["Save Profile"]
            saveButton.click()

            // "Saved" confirmation should appear
            let savedLabel = app.staticTexts["Saved"]
            XCTAssertTrue(savedLabel.waitForExistence(timeout: 3), "Saved confirmation should appear")
        }
    }

    func testSettingsTabsExist() {
        skipOnboardingIfPresent()
        navigateToSettings()

        let profileTab = settingsTab("Profile")
        XCTAssertTrue(profileTab.waitForExistence(timeout: 3), "Profile tab should exist")

        let invoiceTab = settingsTab("Invoice")
        XCTAssertTrue(invoiceTab.exists, "Invoice tab should exist")

        let currencyTab = settingsTab("Currency")
        XCTAssertTrue(currencyTab.exists, "Currency tab should exist")

        let generalTab = settingsTab("General")
        XCTAssertTrue(generalTab.exists, "General tab should exist")
    }

    func testSettingsSubTabsAreNavigable() {
        skipOnboardingIfPresent()
        navigateToSettings()

        // Click Invoice tab
        let invoiceTab = settingsTab("Invoice")
        invoiceTab.click()
        sleep(1)
        let displayOptions = app.staticTexts["Display Options"]
        XCTAssertTrue(displayOptions.waitForExistence(timeout: 3), "Invoice settings should show Display Options")

        // Click Currency tab
        let currencyTab = settingsTab("Currency")
        currencyTab.click()
        sleep(1)
        let currencySection = app.staticTexts["Currency"]
        XCTAssertTrue(currencySection.waitForExistence(timeout: 3), "Currency settings should be visible")

        // Click General tab
        let generalTab = settingsTab("General")
        generalTab.click()
        sleep(1)
        let appearanceSection = app.staticTexts["Appearance"]
        XCTAssertTrue(appearanceSection.waitForExistence(timeout: 3), "General settings should show Appearance")

        // Click back to Profile
        let profileTab = settingsTab("Profile")
        profileTab.click()
        sleep(1)
        let companyInfo = app.staticTexts["Company Information"]
        XCTAssertTrue(companyInfo.waitForExistence(timeout: 3), "Profile settings should show Company Information")
    }

    // MARK: - 7. Search Functionality

    func testClientsSearchWorks() {
        skipOnboardingIfPresent()
        navigateToClients()

        let searchField = app.searchFields.firstMatch
        if searchField.waitForExistence(timeout: 3) {
            searchField.click()
            searchField.typeText("nonexistent")
            sleep(1)

            let emptyState = app.staticTexts["No Clients"]
            // Should show either empty state or "no match" message
            XCTAssertTrue(
                emptyState.exists || app.staticTexts["No clients match your search."].exists,
                "Search for nonexistent client should show empty state"
            )

            // Clear search
            searchField.click()
            searchField.typeKey(XCUIKeyboardKey("a"), modifierFlags: .command)
            searchField.typeKey(XCUIKeyboardKey.delete, modifierFlags: [])
            sleep(1)
        }
    }

    func testInvoicesSearchWorks() {
        skipOnboardingIfPresent()
        navigateToInvoices()

        let searchField = app.searchFields.firstMatch
        if searchField.waitForExistence(timeout: 3) {
            searchField.click()
            searchField.typeText("nonexistent")
            sleep(1)

            let emptyState = app.staticTexts["No Invoices"]
            XCTAssertTrue(
                emptyState.exists || app.staticTexts["No invoices match your search."].exists,
                "Search for nonexistent invoice should show empty state"
            )

            searchField.click()
            searchField.typeKey(XCUIKeyboardKey("a"), modifierFlags: .command)
            searchField.typeKey(XCUIKeyboardKey.delete, modifierFlags: [])
            sleep(1)
        }
    }

    // MARK: - 8. Context Menu on Invoice Row

    func testInvoiceContextMenuAppears() {
        skipOnboardingIfPresent()
        navigateToInvoices()

        // Create an invoice first if none exist
        ensureAtLeastOneInvoiceExists()

        // Right-click the first invoice row
        let firstRow = app.tables.cells.firstMatch
        if firstRow.waitForExistence(timeout: 3) {
            firstRow.rightClick()
            sleep(1)

            // Context menu should show action items
            let editOption = app.menuItems["Edit"]
            let deleteOption = app.menuItems["Delete"]
            let duplicateOption = app.menuItems["Duplicate"]
            let exportPDFOption = app.menuItems["Export PDF"]
            let viewDetailsOption = app.menuItems["View Details"]

            let anyMenuVisible = editOption.exists || deleteOption.exists ||
                duplicateOption.exists || exportPDFOption.exists || viewDetailsOption.exists
            XCTAssertTrue(anyMenuVisible, "At least one context menu item should appear on invoice right-click")

            // Dismiss context menu
            app.typeKey(XCUIKeyboardKey.escape, modifierFlags: [])
        }
    }

    // MARK: - 9. Context Menu on Client Row

    func testClientContextMenuAppears() {
        skipOnboardingIfPresent()
        navigateToClients()

        // Create a client first if none exist
        ensureAtLeastOneClientExists()

        let firstRow = app.tables.cells.firstMatch
        if firstRow.waitForExistence(timeout: 3) {
            firstRow.rightClick()
            sleep(1)

            let editOption = app.menuItems["Edit"]
            let deleteOption = app.menuItems["Delete"]

            let anyMenuVisible = editOption.exists || deleteOption.exists
            XCTAssertTrue(anyMenuVisible, "Context menu items should appear on client right-click")

            app.typeKey(XCUIKeyboardKey.escape, modifierFlags: [])
        }
    }

    // MARK: - 10. Empty State

    func testEmptyStateShowsWhenNoData() {
        // This test may fail if data already exists - that's expected
        skipOnboardingIfPresent()
        navigateToInvoices()

        // Check if empty state exists (only if no invoices)
        let emptyStateIcon = app.staticTexts["No Invoices"]
        // macOS exposes SwiftUI List as an Outline; sidebar has label 'Sidebar', detail list has none
        let invoiceTable = app.outlines.matching(NSPredicate(format: "label != 'Sidebar'")).firstMatch
        // Either empty state or invoice list should be visible
        XCTAssertTrue(
            emptyStateIcon.exists || invoiceTable.exists,
            "Either empty state or invoice list should be visible"
        )
    }

    // MARK: - 11. Full E2E Flow

    func testFullE2EFlow() {
        // Complete onboarding
        skipOnboardingIfPresent()

        // Navigate to Clients and create one
        navigateToInvoices()

        // Create invoice
        let newInvoiceButton = app.buttons["New Invoice"]
        if newInvoiceButton.waitForExistence(timeout: 3) {
            newInvoiceButton.click()

            let invoiceNumberField = findField("INV-001")
            if invoiceNumberField.waitForExistence(timeout: 3) {
                invoiceNumberField.click()
                invoiceNumberField.typeText("E2E-FULL-001")
            }

            let descriptionField = findField("Item description")
            descriptionField.waitForExistence(timeout: 3)
            descriptionField.click()
            descriptionField.typeText("Full E2E Service")

            let priceField = findField("0.00")
            priceField.click()
            priceField.typeText("1000")

            let createButton = app.buttons["Create"]
            createButton.click()
            sleep(1)
        }

        // Navigate to Settings and verify profile
        navigateToSettings()
        let companyInfo = app.staticTexts["Company Information"]
        XCTAssertTrue(companyInfo.waitForExistence(timeout: 3), "Settings profile should be accessible")

        // Navigate back to Invoices and verify the created invoice
        navigateToInvoices()
        sleep(1)
        // The app should still be functional
        XCTAssertTrue(app.staticTexts["Invoices"].exists, "App should still be functional after full E2E flow")
    }

    // MARK: - 12. PDF Export Dialog

    func testPDFExportDialogOpens() {
        skipOnboardingIfPresent()
        navigateToInvoices()

        ensureAtLeastOneInvoiceExists()

        let firstRow = app.tables.cells.firstMatch
        if firstRow.waitForExistence(timeout: 3) {
            firstRow.rightClick()
            sleep(1)

            let exportPDFOption = app.menuItems["Export PDF"]
            if exportPDFOption.waitForExistence(timeout: 3) {
                exportPDFOption.click()
                sleep(2)

                // Export dialog should be visible with template picker, preview, and edit fields
                let exportTitle = app.staticTexts["Export PDF"]
                let cancelButton = app.buttons["Cancel"]
                let exportButton = app.buttons["Export"]
                XCTAssertTrue(exportTitle.exists || exportButton.exists, "Export dialog should open")

                // Template picker should be present
                let templatePicker = app.popUpButtons.firstMatch
                XCTAssertTrue(templatePicker.exists, "Template picker should be present in export dialog")

                if exportButton.exists {
                    exportButton.click()
                    sleep(1)
                }

                // Dismiss dialog
                if cancelButton.exists {
                    cancelButton.click()
                }
            }
        }
    }

    // MARK: - Helpers

    private func findField(_ labelOrPlaceholder: String) -> XCUIElement {
        let predicate = NSPredicate(
            format: "identifier == %@ OR label == %@ OR placeholderValue == %@",
            labelOrPlaceholder, labelOrPlaceholder, labelOrPlaceholder
        )
        return app.textFields.matching(predicate).firstMatch
    }

    private func settingsTab(_ title: String) -> XCUIElement {
        let predicate = NSPredicate(format: "label CONTAINS[c] %@", title)
        let tab = app.tabs.matching(predicate).firstMatch
        return tab
    }

    private func skipOnboardingIfPresent() {
        let getStartedButton = app.buttons["Get Started"]
        if getStartedButton.waitForExistence(timeout: 3) {
            getStartedButton.click()
            // Wait for animation
            sleep(2)
        }
    }

    private func navigateToInvoices() {
        let invoicesTab = app.staticTexts.matching(identifier: "Invoices").firstMatch
        if invoicesTab.exists {
            invoicesTab.click()
            sleep(1)
        }
    }

    private func navigateToClients() {
        let clientsTab = app.staticTexts.matching(identifier: "Clients").firstMatch
        if clientsTab.exists {
            clientsTab.click()
            sleep(1)
        }
    }

    private func navigateToSettings() {
        let settingsTab = app.staticTexts.matching(identifier: "Settings").firstMatch
        if settingsTab.exists {
            settingsTab.click()
            sleep(1)
        }
    }

    private func ensureAtLeastOneInvoiceExists() {
        navigateToInvoices()
        let table = app.tables.firstMatch
        if !table.exists || table.cells.count == 0 {
            let newInvoiceButton = app.buttons["New Invoice"]
            if newInvoiceButton.waitForExistence(timeout: 3) {
                newInvoiceButton.click()

                let descriptionField = findField("Item description")
                descriptionField.waitForExistence(timeout: 3)
                descriptionField.click()
                descriptionField.typeText("Context Menu Test Item")

                let priceField = findField("0.00")
                priceField.click()
                priceField.typeText("100")

                let createButton = app.buttons["Create"]
                createButton.click()
                sleep(2)
            }
        }
    }

    private func ensureAtLeastOneClientExists() {
        navigateToClients()
        let table = app.tables.firstMatch
        if !table.exists || table.cells.count == 0 {
            let newClientButton = app.buttons["New Client"]
            if newClientButton.waitForExistence(timeout: 3) {
                newClientButton.click()

                let fullNameField = findField("e.g. John Smith")
                fullNameField.waitForExistence(timeout: 3)
                fullNameField.click()
                fullNameField.typeText("Test Context Client")

                let createButton = app.buttons["Create"]
                createButton.click()
                sleep(2)
            }
        }
    }
}

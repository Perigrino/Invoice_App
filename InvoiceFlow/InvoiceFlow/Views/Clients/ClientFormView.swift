import SwiftUI
import SwiftData

struct ClientFormView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    var client: Client?

    @State private var fullName = ""
    @State private var company = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var address = ""
    @State private var showValidationError = false
    @State private var validationError = ""
    @State private var pendingClient: Client?
    @State private var saveError: String?
    @State private var hasLoaded = false
    @State private var cancelAction: ((Client?) -> Void)?

    private var isEditing: Bool { client != nil }

    var body: some View {
        VStack(spacing: 0) {
            // MARK: - Header
            PageHeader(
                isEditing ? "Edit Client" : "New Client",
                subtitle: isEditing ? "Update the details for this client." : "Add a client you can bill straight away."
            ) {
                if showValidationError {
                    Text(validationError)
                        .font(.system(size: 11.5))
                        .foregroundColor(Theme.negative)
                        .transition(.opacity)
                }
                Button("Cancel") {
                    cancelAction?(pendingClient)
                    cancelAction = nil
                    dismiss()
                }
                .buttonStyle(.plain)
                .capsuleButton(.ghost)
                .keyboardShortcut(.cancelAction)
                Button(isEditing ? "Update" : "Create") {
                    if validateForm() {
                        saveClient()
                    }
                }
                .buttonStyle(.plain)
                .capsuleButton(.primary)
                .keyboardShortcut(.defaultAction)
            }
            .padding(.horizontal, 28)
            .padding(.top, 22)

            Divider().overlay(Theme.hairline)

            // MARK: - Form Content
            ScrollView {
                VStack(spacing: 24) {
                    // Prototype form-grid: 2 columns, address wide.
                    formSection {
                        VStack(alignment: .leading, spacing: 14) {
                            HStack(alignment: .top, spacing: 18) {
                                field(label: "Full Name *", placeholder: "e.g. John Smith", text: $fullName)
                                field(label: "Company", placeholder: "e.g. Acme Corp", text: $company)
                            }
                            HStack(alignment: .top, spacing: 18) {
                                field(label: "Email", placeholder: "e.g. john@acme.com", text: $email)
                                field(label: "Phone", placeholder: "e.g. +1 (555) 123-4567", text: $phone)
                            }
                            field(label: "Address", placeholder: "e.g. 123 Main St, City, Country", text: $address)
                        }
                    }

                    // Billing history — the prototype's client-form footer card.
                    formSection {
                        SettingRow(
                            "Billing history",
                            description: billingDescription,
                            showsDivider: false
                        ) {
                            StatusPill(
                                text: "\(clientInvoiceCount) invoice\(clientInvoiceCount == 1 ? "" : "s")",
                                kind: clientOutstanding > 0 ? .due : .plain
                            )
                        }
                    }
                }
                .padding(.horizontal, 28)
                .padding(.top, 22)
                .padding(.bottom, 28)
            }
        }
        .frame(minWidth: 560, minHeight: 480)
        .background { ThemeCanvas().ignoresSafeArea() }
        .onAppear { loadClient() }
        .animation(.default, value: showValidationError)
        .alert("Could Not Save Client", isPresented: Binding(
            get: { saveError != nil },
            set: { if !$0 { saveError = nil } }
        )) {
            Button("OK", role: .cancel) { saveError = nil }
        } message: {
            Text(saveError ?? "")
        }
    }

    /// Prototype `.field`: uppercase label over a capsule-ish glass input.
    private func field(label: String, placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).modifier(FieldLabelStyle())
            TextField(placeholder, text: text, axis: .vertical)
                .lineLimit(1...4)
                .textFieldStyle(GlassFieldMultilineStyle())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var clientInvoiceCount: Int { client?.invoiceCount ?? 0 }
    private var clientOutstanding: Decimal { client?.outstanding ?? .zero }

    /// Prototype sr-desc for the billing-history row.
    private var billingDescription: String {
        guard clientInvoiceCount > 0 else { return "No invoices yet for this client." }
        return clientOutstanding > 0
            ? "\(CurrencyFormatter.shared.string(from: clientOutstanding)) still outstanding."
            : "Everything is settled."
    }

    private func formSection<Content: View>(title: String? = nil, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: title == nil ? 0 : 14) {
            if let title { SectionLabel(title) }
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .glassCard(radius: Theme.radiusLarge)
    }

    private func loadClient() {
        guard !hasLoaded else { return }
        hasLoaded = true
        pendingClient = client
        guard let client = client else { return }
        fullName = client.fullName
        company = client.company ?? ""
        email = client.email ?? ""
        phone = client.phone ?? ""
        address = client.address ?? ""
    }

    private func validateForm() -> Bool {
        guard !fullName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            showError("Full name is required")
            return false
        }
        if !email.isEmpty {
            let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}"
            if !NSPredicate(format: "SELF MATCHES %@", emailRegex).evaluate(with: email) {
                showError("Invalid email address")
                return false
            }
        }
        showValidationError = false
        return true
    }

    private func showError(_ message: String) {
        validationError = message
        withAnimation { showValidationError = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            withAnimation { showValidationError = false }
        }
    }

    private func saveClient() {
        if cancelAction == nil {
            cancelAction = Self.makeCancelAction(for: pendingClient, in: modelContext)
        }
        if Self.saveClient(
            in: modelContext, pending: &pendingClient, fullName: fullName,
            company: company, email: email, phone: phone, address: address,
            onError: { saveError = "Your changes have not been saved. Keep this form open and try again.\n\n\($0.localizedDescription)" }
        ) {
            cancelAction = nil
            dismiss()
        }
    }

    static func makeCancelAction(for client: Client?, in context: ModelContext) -> (Client?) -> Void {
        guard let client else {
            return { pending in
                if let pending { context.delete(pending) }
            }
        }
        let original = (client.fullName, client.company, client.email, client.phone, client.address, client.updatedAt)
        return { _ in
            client.fullName = original.0
            client.company = original.1
            client.email = original.2
            client.phone = original.3
            client.address = original.4
            client.updatedAt = original.5
        }
    }

    static func saveClient(
        in context: ModelContext, pending: inout Client?, fullName: String,
        company: String, email: String, phone: String, address: String,
        onError: ((Error) -> Void)? = nil
    ) -> Bool {
        let record = pending ?? Client()
        if pending == nil {
            context.insert(record)
            pending = record
        }
        record.fullName = fullName
        record.company = company.isEmpty ? nil : company
        record.email = email.isEmpty ? nil : email
        record.phone = phone.isEmpty ? nil : phone
        record.address = address.isEmpty ? nil : address
        record.updatedAt = Date()
        return context.persist(onError: onError)
    }
}
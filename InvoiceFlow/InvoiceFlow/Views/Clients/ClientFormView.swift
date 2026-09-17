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
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(isEditing ? "Edit Client" : "New Client")
                        .font(.title2.bold())
                    Text(isEditing ? "Update client details" : "Add a new client to your directory")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                if showValidationError {
                    Text(validationError)
                        .font(.caption)
                        .foregroundColor(.red)
                        .transition(.opacity)
                }
                Button("Cancel") {
                    cancelAction?(pendingClient)
                    cancelAction = nil
                    dismiss()
                }
                    .keyboardShortcut(.cancelAction)
                Button(isEditing ? "Update" : "Create") {
                    if validateForm() {
                        saveClient()
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.brandPrimary)
                .keyboardShortcut(.defaultAction)
            }
            .padding()

            Divider()

            // MARK: - Form Content
            ScrollView {
                VStack(spacing: 24) {
                    formSection(title: "Personal Info") {
                        HStack(spacing: 16) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Full Name *")
                                    .font(.caption.bold())
                                    .foregroundColor(.secondary)
                                TextField("e.g. John Smith", text: $fullName, axis: .vertical)
                                    .lineLimit(1...3)
                                    .textFieldStyle(.roundedBorder)
                            }
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Company")
                                    .font(.caption.bold())
                                    .foregroundColor(.secondary)
                                TextField("e.g. Acme Corp", text: $company, axis: .vertical)
                                    .lineLimit(1...3)
                                    .textFieldStyle(.roundedBorder)
                            }
                        }
                    }

                    formSection(title: "Contact") {
                        HStack(spacing: 16) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Email")
                                    .font(.caption.bold())
                                    .foregroundColor(.secondary)
                                TextField("e.g. john@acme.com", text: $email)
                                    .textFieldStyle(.roundedBorder)
                            }
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Phone")
                                    .font(.caption.bold())
                                    .foregroundColor(.secondary)
                                TextField("e.g. +1 (555) 123-4567", text: $phone)
                                    .textFieldStyle(.roundedBorder)
                            }
                        }
                    }

                    formSection(title: "Details") {
                        VStack(alignment: .leading, spacing: 16) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Address")
                                    .font(.caption.bold())
                                    .foregroundColor(.secondary)
                                TextField("e.g. 123 Main St, City, Country", text: $address, axis: .vertical)
                                    .lineLimit(1...4)
                                    .textFieldStyle(.roundedBorder)
                            }
                        }
                    }
                }
                .padding(20)
            }
        }
        .frame(minWidth: 560, minHeight: 480)
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

    private func formSection<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(.body, weight: .semibold))
                .foregroundColor(.primary)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 10))
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
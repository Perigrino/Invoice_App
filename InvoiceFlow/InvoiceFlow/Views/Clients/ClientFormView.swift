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
                Button("Cancel") { dismiss() }
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
                                TextField("e.g. John Smith", text: $fullName)
                                    .textFieldStyle(.roundedBorder)
                            }
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Company")
                                    .font(.caption.bold())
                                    .foregroundColor(.secondary)
                                TextField("e.g. Acme Corp", text: $company)
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
                                TextField("e.g. 123 Main St, City, Country", text: $address)
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
        if let existing = client {
            existing.fullName = fullName
            existing.company = company.isEmpty ? nil : company
            existing.email = email.isEmpty ? nil : email
            existing.phone = phone.isEmpty ? nil : phone
            existing.address = address.isEmpty ? nil : address
            existing.updatedAt = Date()
        } else {
            let newClient = Client(
                fullName: fullName,
                company: company.isEmpty ? nil : company,
                email: email.isEmpty ? nil : email,
                phone: phone.isEmpty ? nil : phone,
                address: address.isEmpty ? nil : address
            )
            modelContext.insert(newClient)
        }
        dismiss()
    }
}
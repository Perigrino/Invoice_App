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
    @State private var taxId = ""
    @State private var showValidationError = false
    @State private var validationError = ""

    private var isEditing: Bool { client != nil }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(isEditing ? "Edit Client" : "New Client")
                    .font(.title2.bold())
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

            Form {
                Section("Personal Info") {
                    TextField("Full Name *", text: $fullName)
                    TextField("Company", text: $company)
                }
                Section("Contact") {
                    TextField("Email", text: $email)
                    TextField("Phone", text: $phone)
                }
                Section("Details") {
                    TextField("Address", text: $address)
                    TextField("Tax ID", text: $taxId)
                }
            }
        }
        .frame(minWidth: 500, minHeight: 450)
        .onAppear { loadClient() }
        .animation(.default, value: showValidationError)
    }

    private func loadClient() {
        guard let client = client else { return }
        fullName = client.fullName
        company = client.company ?? ""
        email = client.email ?? ""
        phone = client.phone ?? ""
        address = client.address ?? ""
        taxId = client.taxId ?? ""
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
            existing.taxId = taxId.isEmpty ? nil : taxId
            existing.updatedAt = Date()
        } else {
            let newClient = Client(
                fullName: fullName,
                company: company.isEmpty ? nil : company,
                email: email.isEmpty ? nil : email,
                phone: phone.isEmpty ? nil : phone,
                address: address.isEmpty ? nil : address,
                taxId: taxId.isEmpty ? nil : taxId
            )
            modelContext.insert(newClient)
        }
        dismiss()
    }
}

import SwiftUI
import SwiftData

struct ClientListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Client.fullName) private var clients: [Client]
    @State private var searchText = ""
    @State private var showNewClient = false
    @State private var editingClient: Client? = nil
    @State private var clientToDelete: Client? = nil
    @State private var showDeleteConfirmation = false

    private var searchedClients: [Client] {
        clients.filter { client in
            searchText.isEmpty ||
                client.fullName.localizedCaseInsensitiveContains(searchText) ||
                (client.company?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    private var filteredClients: [Client] {
        searchedClients
    }

    var body: some View {
        VStack(spacing: 0) {
            PageHeader("Clients", subtitle: "Everyone you bill, in one place.") {
                Button {
                    showNewClient = true
                } label: {
                    Label("New Client", systemImage: "plus")
                }
                .buttonStyle(.plain)
                .capsuleButton(.primary)
            }
            .padding(.horizontal, 28)

            HStack {
                Spacer(minLength: 0)
                inlineSearch
            }
            .padding(.horizontal, 28)
            .padding(.top, 12)

            // Hoisted above the list (instead of a section header) so the
            // list opens on a data row — see InvoiceListView for why.
            if !filteredClients.isEmpty {
                SectionLabel("\(filteredClients.count) Client\(filteredClients.count == 1 ? "" : "s")", uppercased: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 28)
                    .padding(.top, 14)
                    .padding(.bottom, 2)
                    .appear()
            }

            if filteredClients.isEmpty {
                Spacer(minLength: 0)
                EmptyStateView(
                    icon: "person.2",
                    title: "No Clients",
                    message: searchText.isEmpty ? "Add your first client to get started." : "No clients match your search.",
                    actionTitle: searchText.isEmpty ? "Add Client" : nil,
                    action: searchText.isEmpty ? { showNewClient = true } : nil
                )
                Spacer(minLength: 0)
            } else {
                clientList
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .navigationTitle("Clients")
        .sheet(isPresented: $showNewClient) {
            ClientFormView()
        }
        .sheet(item: $editingClient) { client in
            ClientFormView(client: client)
        }
        .alert("Delete Client", isPresented: $showDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                if let client = clientToDelete {
                    deleteClient(client)
                }
            }
        } message: {
            Text("Are you sure you want to delete this client? This will also affect any associated invoices.")
        }
    }

    // MARK: - Search

    @FocusState private var searchFocused: Bool

    /// Prototype `.search`: capsule field at the right end of the chips row.
    private var inlineSearch: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 11))
                .foregroundColor(Theme.textMuted)
            TextField("Search clients...", text: $searchText)
                .textFieldStyle(.plain)
                .font(.system(size: 12.5))
                .foregroundColor(Theme.textPrimary)
                .focused($searchFocused)
        }
        .padding(.horizontal, 12)
        .frame(height: 32)
        .frame(minWidth: 210)
        .background(Capsule().fill(Theme.field))
        .overlay {
            Capsule().strokeBorder(
                searchFocused ? Theme.accent.opacity(0.55) : Theme.hairline,
                lineWidth: 1
            )
        }
        .accessibilityAddTraits(.isSearchField)
    }

    private var clientList: some View {
        // No List(selection:) — same as InvoiceListView: the system's
        // selection highlight bled through the translucent cards (the mixed
        // blues/grays the user reported). Rows are Buttons; a click opens
        // the client's edit sheet.
        List {
            ForEach(filteredClients) { client in
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
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
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

    private func deleteClient(_ client: Client) {
        modelContext.delete(client)
        modelContext.persist()
    }
}

// MARK: - Client Row

/// One glass card: tinted avatar, name + contact, balance pill, invoice count.
struct ClientRow: View {
    /// Fixed height — see `InvoiceRow.rowHeight` for why rows need one.
    static let rowHeight: CGFloat = 64
    /// Full row pitch inside the table — see `InvoiceRow.tableRowHeight`.
    static let tableRowHeight: CGFloat = rowHeight + 10

    let client: Client

    @State private var hovering = false

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Theme.radiusCard, style: .continuous)

        HStack(spacing: 14) {
            avatar

            VStack(alignment: .leading, spacing: 3) {
                Text(client.fullName)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundColor(Theme.textPrimary)
                    .lineLimit(1)
                HStack(spacing: 5) {
                    Image(systemName: "dollarsign.circle")
                        .font(.system(size: 10))
                        .foregroundColor(Theme.textMuted)
                    Text(secondaryLine)
                        .font(.system(size: 11.5))
                        .foregroundColor(Theme.textSecondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Text("\(client.invoiceCount) invoice\(client.invoiceCount == 1 ? "" : "s")")
                .font(.system(size: 11.5))
                .foregroundColor(Theme.textSecondary)
                .frame(minWidth: 74, alignment: .trailing)
        }
        .padding(.horizontal, 14)
        .frame(height: Self.rowHeight)
        .background {
            ZStack {
                shape.fill(.ultraThinMaterial)
                shape.fill(Theme.cardFill)
                if hovering {
                    // Tint on hover; a dark shadow smudges on the light canvas.
                    shape.fill(Theme.hover)
                }
                // PosterTint port: deterministic per-client wash.
                LinearGradient(
                    colors: [Theme.tint(for: client.fullName).opacity(0.18), .clear],
                    startPoint: .topLeading,
                    endPoint: .center
                )
                .clipShape(shape)
            }
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
        .scaleEffect(hovering ? 1.006 : 1)
        .animation(Theme.quick, value: hovering)
        .onHover { hovering = $0 }
    }

    /// Tinted initial circle — `color-mix(tint 22%, avatar-base)` in the
    /// prototype, with the ink pulled from the same hue.
    private var avatar: some View {
        let tint = Theme.tint(for: client.fullName)
        return ZStack {
            Circle().fill(Theme.avatarBase)
            Circle().fill(tint.opacity(0.22))
            Text(client.initial)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(Theme.tintInk(for: client.fullName))
        }
        .frame(width: 36, height: 36)
        .overlay {
            Circle().strokeBorder(tint.opacity(0.30), lineWidth: 1)
        }
    }

    /// Prototype sub-line: `company · email`, falling back to phone.
    private var secondaryLine: String {
        let company = (client.company?.isEmpty == false) ? client.company : nil
        let email = (client.email?.isEmpty == false) ? client.email : nil
        let parts = [company, email].compactMap { $0 }
        if !parts.isEmpty { return parts.joined(separator: " · ") }
        if let phone = client.phone, !phone.isEmpty { return phone }
        return "No contact details yet"
    }
}

import SwiftUI
import SwiftData

struct ClientListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Client.fullName) private var clients: [Client]
    @State private var searchText = ""
    @State private var showNewClient = false
    @State private var editingClient: Client? = nil
    @State private var selectedClient: Client? = nil
    @State private var selectedClients = Set<Client>()
    @State private var clientToDelete: Client? = nil
    @State private var showDeleteConfirmation = false
    
    private var filteredClients: [Client] {
        clients.filter { client in
            searchText.isEmpty ||
                client.fullName.localizedCaseInsensitiveContains(searchText) ||
                (client.company?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }
    
    var body: some View {
        Group {
            if filteredClients.isEmpty {
                EmptyStateView(
                    icon: "person.2",
                    title: "No Clients",
                    message: searchText.isEmpty ? "Add your first client to get started." : "No clients match your search."
                )
            } else {
                List(selection: $selectedClients) {
                    ForEach(filteredClients) { client in
                        ClientRow(client: client)
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
                .listStyle(.inset(alternatesRowBackgrounds: true))
                .onChange(of: selectedClients) { _, newSelection in
                    if let first = newSelection.first {
                        editingClient = first
                        selectedClients.removeAll()
                    }
                }
            }
        }
        .navigationTitle("Clients")
        .navigationSubtitle("\(filteredClients.count) client\(filteredClients.count == 1 ? "" : "s")")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showNewClient = true
                } label: {
                    Label("New Client", systemImage: "plus")
                }
            }
        }
        .searchable(text: $searchText, prompt: "Search clients...")
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
    
    private func deleteClient(_ client: Client) {
        modelContext.delete(client)
    }
}

// MARK: - Client Row

struct ClientRow: View {
    let client: Client
    
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color.brandPrimary.opacity(0.15))
                .frame(width: 36, height: 36)
                .overlay(
                    Text(String(client.fullName.prefix(1)).uppercased())
                        .font(.system(.body, weight: .semibold))
                        .foregroundColor(Color.brandPrimary)
                )
            VStack(alignment: .leading, spacing: 2) {
                Text(client.fullName)
                    .font(.system(.body, weight: .medium))
                if let company = client.company, !company.isEmpty {
                    Text(company)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            Spacer()
            if let email = client.email {
                Text(email)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}
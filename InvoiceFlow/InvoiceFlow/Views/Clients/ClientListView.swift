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
    
    private var filteredClients: [Client] {
        clients.filter { client in
            searchText.isEmpty ||
                client.fullName.localizedCaseInsensitiveContains(searchText) ||
                (client.company?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // MARK: - Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Clients")
                        .font(.title2.bold())
                    Text("\(filteredClients.count) client\(filteredClients.count == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Button(action: { showNewClient = true }) {
                    Label("New Client", systemImage: "plus")
                        .font(.system(.body, weight: .medium))
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.brandPrimary)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            
            Divider()
            
            // MARK: - Client List
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
        .searchable(text: $searchText, prompt: "Search clients...")
        .sheet(isPresented: $showNewClient) {
            ClientFormView()
        }
        .sheet(item: $editingClient) { client in
            ClientFormView(client: client)
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
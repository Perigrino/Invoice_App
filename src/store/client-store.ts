import { create } from "zustand";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import {
  fetchClients,
  createClient as apiCreateClient,
  updateClient as apiUpdateClient,
  deleteClient as apiDeleteClient,
} from "@/lib/api";

export interface SavedClient {
  id: string;
  fullName: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
}

interface ClientState {
  clients: SavedClient[];
  _hydrated: boolean;
  hydrate: () => Promise<void>;
  addClient: (data: Omit<SavedClient, "id" | "createdAt">) => SavedClient;
  updateClient: (id: string, data: Partial<SavedClient>) => void;
  deleteClient: (id: string) => void;
}

function persist(clients: SavedClient[]) {
  saveToStorage("clients", clients);
}

function uid() {
  return Math.random().toString(36).substring(2, 9);
}

export const useClientStore = create<ClientState>((set, get) => ({
  clients: [],
  _hydrated: false,

  hydrate: async () => {
    const local = loadFromStorage<SavedClient[]>("clients", []);
    const remote = await fetchClients();
    const data = remote && remote.length > 0 ? remote : local;
    set({ clients: data, _hydrated: true });
  },

  addClient: (data) => {
    const client: SavedClient = {
      ...data,
      id: uid(),
      createdAt: new Date().toISOString(),
    };
    const updated = [client, ...get().clients];
    persist(updated);
    set({ clients: updated });
    apiCreateClient(client);
    return client;
  },

  updateClient: (id, data) => {
    const updated = get().clients.map((c) =>
      c.id === id ? { ...c, ...data } : c
    );
    persist(updated);
    set({ clients: updated });
    const target = updated.find((c) => c.id === id);
    if (target) apiUpdateClient(id, target);
  },

  deleteClient: (id) => {
    const updated = get().clients.filter((c) => c.id !== id);
    persist(updated);
    set({ clients: updated });
    apiDeleteClient(id);
  },
}));

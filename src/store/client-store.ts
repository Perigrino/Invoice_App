import { create } from "zustand";
import { loadFromStorage, saveToStorage } from "@/lib/storage";

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
  hydrate: () => void;
  addClient: (data: Omit<SavedClient, "id" | "createdAt">) => SavedClient;
  updateClient: (id: string, data: Partial<SavedClient>) => void;
  deleteClient: (id: string) => void;
}

function persist(clients: SavedClient[]) {
  saveToStorage("clients", clients);
}

export const useClientStore = create<ClientState>((set, get) => ({
  clients: [],
  _hydrated: false,

  hydrate: () => {
    const data = loadFromStorage<SavedClient[]>("clients", []);
    set({ clients: data, _hydrated: true });
  },

  addClient: (data) => {
    const client: SavedClient = {
      ...data,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };
    const updated = [client, ...get().clients];
    persist(updated);
    set({ clients: updated });
    return client;
  },

  updateClient: (id, data) => {
    const updated = get().clients.map((c) =>
      c.id === id ? { ...c, ...data } : c
    );
    persist(updated);
    set({ clients: updated });
  },

  deleteClient: (id) => {
    const updated = get().clients.filter((c) => c.id !== id);
    persist(updated);
    set({ clients: updated });
  },
}));

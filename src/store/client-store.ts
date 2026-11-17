import { create } from "zustand";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import { beginWrite, isLatestWrite } from "@/lib/latest-write";
import { notifyWriteFailure } from "@/store/toast-store";
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
    apiCreateClient(client).catch((error) => {
      // Nothing was saved, so the row must not stay on screen. Removing it by
      // id leaves any client added while this was in flight untouched.
      const reverted = get().clients.filter((c) => c.id !== client.id);
      persist(reverted);
      set({ clients: reverted });
      notifyWriteFailure("This client was not saved.", error);
    });
    return client;
  },

  updateClient: (id, data) => {
    const before = get().clients.find((c) => c.id === id);
    if (!before) return;
    const token = beginWrite(id);
    const after = { ...before, ...data };
    const updated = get().clients.map((c) => (c.id === id ? after : c));
    persist(updated);
    set({ clients: updated });
    apiUpdateClient(id, after).catch((error) => {
      // Restore this one client, not a snapshot of the whole list, and only if
      // this write is still the newest one for it.
      if (isLatestWrite(id, token)) {
        const reverted = get().clients.map((c) => (c.id === id ? before : c));
        persist(reverted);
        set({ clients: reverted });
      }
      notifyWriteFailure("Those client changes were not saved.", error);
    });
  },

  deleteClient: (id) => {
    const previous = get().clients;
    const index = previous.findIndex((c) => c.id === id);
    if (index === -1) return;
    const removed = previous[index];
    const token = beginWrite(id);
    const updated = previous.filter((c) => c.id !== id);
    persist(updated);
    set({ clients: updated });
    apiDeleteClient(id).catch((error) => {
      if (isLatestWrite(id, token)) {
        const current = get().clients;
        if (!current.some((c) => c.id === id)) {
          const restored = [...current];
          restored.splice(Math.min(index, restored.length), 0, removed);
          persist(restored);
          set({ clients: restored });
        }
      }
      notifyWriteFailure("This client was not deleted.", error);
    });
  },
}));

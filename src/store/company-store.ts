import { create } from "zustand";
import type { CompanySettings } from "@/types";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import { fetchCompany, saveCompany as apiSaveCompany } from "@/lib/api";
import { useProfileStore } from "./profile-store";

interface CompanyState {
  company: CompanySettings;
  _hydrated: boolean;
  hydrate: () => Promise<void>;
  updateCompany: (data: Partial<CompanySettings>) => void;
  reset: () => void;
}

const defaultCompany: CompanySettings = {
  fullName: "",
  name: "",
  logo: "",
  address: "",
  email: "",
  phone: "",
  website: "",
};

export const useCompanyStore = create<CompanyState>((set, get) => ({
  company: defaultCompany,
  _hydrated: false,

  hydrate: async () => {
    const local = loadFromStorage<CompanySettings>("company", defaultCompany);
    if (useProfileStore.getState().isNewProfile) {
      set({ company: { ...defaultCompany }, _hydrated: true });
      return;
    }
    const remote = await fetchCompany();
    set({ company: remote && remote.name ? remote : local, _hydrated: true });
  },

  updateCompany: (data) => {
    const updated = { ...get().company, ...data };
    saveToStorage("company", updated);
    set({ company: updated });
    apiSaveCompany(updated);
  },

  reset: () => {
    saveToStorage("company", defaultCompany);
    set({ company: { ...defaultCompany } });
  },
}));

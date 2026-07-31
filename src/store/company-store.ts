import { create } from "zustand";
import type { CompanySettings } from "@/types";
import { loadFromStorage, saveToStorage } from "@/lib/storage";

interface CompanyState {
  company: CompanySettings;
  _hydrated: boolean;
  hydrate: () => void;
  updateCompany: (data: Partial<CompanySettings>) => void;
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

  hydrate: () => {
    const data = loadFromStorage<CompanySettings>("company", defaultCompany);
    set({ company: data, _hydrated: true });
  },

  updateCompany: (data) => {
    const updated = { ...get().company, ...data };
    saveToStorage("company", updated);
    set({ company: updated });
  },
}));

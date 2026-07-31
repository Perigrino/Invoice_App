import { create } from "zustand";
import type { AppSettings } from "@/types";
import { loadFromStorage, saveToStorage } from "@/lib/storage";

interface SettingsState {
  settings: AppSettings;
  _hydrated: boolean;
  hydrate: () => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  reset: () => void;
}

const defaultSettings: AppSettings = {
  logo: "",
  notes: "",
  currency: "GHS",
  separator: "comma",
  decimalPlaces: 2,
  signPlacement: "before",
  dateFormat: "MM/DD/YYYY",
  pdfDirectory: "/exports",
  template: "modern",
  paperSize: "A4",
  showInvoiceId: true,
  showDueDate: true,
  showCurrency: true,
  showDiscount: true,
  showNote: true,
  language: "en",
  sound: "default",
  openPdfAfterExport: true,
  autoSave: true,
  darkMode: false,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  _hydrated: false,

  hydrate: () => {
    const data = loadFromStorage<AppSettings>("settings", defaultSettings);
    set({ settings: data, _hydrated: true });
  },

  updateSettings: (newSettings) => {
    const updated = { ...get().settings, ...newSettings };
    saveToStorage("settings", updated);
    set({ settings: updated });
  },

  reset: () => {
    saveToStorage("settings", defaultSettings);
    set({ settings: defaultSettings });
  },
}));

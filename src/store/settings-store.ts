import { create } from "zustand";
import type { AppSettings } from "@/types";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import { fetchSettings, saveSettings as apiSaveSettings } from "@/lib/api";
import { useProfileStore } from "./profile-store";

interface SettingsState {
  settings: AppSettings;
  _hydrated: boolean;
  hydrate: () => Promise<void>;
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
  paperSize: "A3",
  pdfAccentColor: "#00BCD4",
  pdfSecondaryColor: "#059669",
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

  hydrate: async () => {
    const local = loadFromStorage<AppSettings>("settings", defaultSettings);
    if (useProfileStore.getState().isNewProfile) {
      set({ settings: { ...defaultSettings }, _hydrated: true });
      return;
    }
    const remote = await fetchSettings();
    set({
      settings: { ...defaultSettings, ...local, ...remote },
      _hydrated: true,
    });
  },

  updateSettings: (newSettings) => {
    const updated = { ...get().settings, ...newSettings };
    saveToStorage("settings", updated);
    set({ settings: updated });
    apiSaveSettings(updated);
  },

  reset: () => {
    saveToStorage("settings", defaultSettings);
    set({ settings: defaultSettings });
  },
}));

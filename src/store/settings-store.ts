import { create } from "zustand";
import type { AppSettings } from "@/types";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import { normalizeTemplate } from "@/lib/templates/presets";
import { fetchSettings, saveSettings as apiSaveSettings } from "@/lib/api";
import { useProfileStore } from "./profile-store";
import { notifyWriteFailure } from "@/store/toast-store";

interface SettingsState {
  settings: AppSettings;
  _hydrated: boolean;
  hydrate: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => void;
  reset: () => void;
}

const defaultSettings: AppSettings = DEFAULT_SETTINGS;

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
      settings: {
        ...defaultSettings,
        ...local,
        ...remote,
        template: normalizeTemplate(remote?.template ?? local?.template ?? defaultSettings.template),
      },
      _hydrated: true,
    });
  },

  updateSettings: (newSettings) => {
    const updated = { ...get().settings, ...newSettings };
    saveToStorage("settings", updated);
    set({ settings: updated });
    apiSaveSettings(updated).catch((error) =>
      notifyWriteFailure("Your settings were not saved.", error)
    );
  },

  reset: () => {
    saveToStorage("settings", defaultSettings);
    set({ settings: defaultSettings });
  },
}));

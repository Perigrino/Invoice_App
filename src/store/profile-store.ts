import { create } from "zustand";
import { loadRaw, saveRaw, setProfileNamespace } from "@/lib/storage";

const PROFILES_KEY = "invoiceflow_profiles";
const ACTIVE_KEY = "invoiceflow_active_profile";

export interface Profile {
  id: string;
  name: string;
  createdAt: string;
}

interface ProfileState {
  profiles: Profile[];
  activeProfileId: string;
  isNewProfile: boolean;
  hydrate: () => void;
  addProfile: (name: string) => Profile;
  deleteProfile: (id: string) => void;
  renameProfile: (id: string, name: string) => void;
  switchProfile: (id: string) => void;
  clearNewProfileFlag: () => void;
}

function uid() {
  return Math.random().toString(36).substring(2, 9);
}

const defaultProfile: Profile = {
  id: "default",
  name: "Default",
  createdAt: new Date().toISOString(),
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [defaultProfile],
  activeProfileId: "default",
  isNewProfile: false,

  hydrate: () => {
    const raw = loadRaw<Profile[]>(PROFILES_KEY, [defaultProfile]);
    const profiles = (Array.isArray(raw) ? raw : [])
      .filter((p) => p && typeof p.name === "string" && p.name.trim() !== "")
      .map((p) => ({ ...p, name: p.name.trim() }));
    const safeProfiles = profiles.length > 0 ? profiles : [defaultProfile];
    const activeProfileId = loadRaw<string>(ACTIVE_KEY, "default");
    const safeActive =
      safeProfiles.find((p) => p.id === activeProfileId)?.id ||
      safeProfiles[0].id;
    setProfileNamespace(safeActive);
    if (profiles.length > 0 && safeActive !== activeProfileId) {
      saveRaw(ACTIVE_KEY, safeActive);
    }
    set({ profiles: safeProfiles, activeProfileId: safeActive });
  },

  addProfile: (name) => {
    const profile: Profile = {
      id: uid(),
      name,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().profiles, profile];
    saveRaw(PROFILES_KEY, updated);
    set({ profiles: updated, isNewProfile: true });
    return profile;
  },

  deleteProfile: (id) => {
    if (get().profiles.length <= 1) return;
    const updated = get().profiles.filter((p) => p.id !== id);
    saveRaw(PROFILES_KEY, updated);
    if (get().activeProfileId === id) {
      const next = updated[0].id;
      setProfileNamespace(next);
      saveRaw(ACTIVE_KEY, next);
      set({ profiles: updated, activeProfileId: next });
    } else {
      set({ profiles: updated });
    }
  },

  renameProfile: (id, name) => {
    const updated = get().profiles.map((p) =>
      p.id === id ? { ...p, name } : p
    );
    saveRaw(PROFILES_KEY, updated);
    set({ profiles: updated });
  },

  switchProfile: (id) => {
    if (id === get().activeProfileId) return;
    setProfileNamespace(id);
    saveRaw(ACTIVE_KEY, id);
    set({ activeProfileId: id });
  },

  clearNewProfileFlag: () => {
    set({ isNewProfile: false });
  },
}));

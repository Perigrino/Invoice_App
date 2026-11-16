let _workspaceId = "";
let _profileId = "default";

export function setWorkspaceNamespace(workspaceId: string) {
  _workspaceId = workspaceId;
}

export function getWorkspaceNamespace() {
  return _workspaceId;
}

export function setProfileNamespace(id: string) {
  _profileId = id;
}

export function getProfileNamespace() {
  return _profileId;
}

function workspacePrefix() {
  return _workspaceId ? `w_${_workspaceId}_` : "";
}

export function profileKey(base: string) {
  return `invoiceflow_${workspacePrefix()}p_${_profileId}_${base}`;
}

export function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(profileKey(key));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function saveToStorage<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(profileKey(key), JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
}

export function loadRaw<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(`${workspacePrefix()}${key}`);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveRaw<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${workspacePrefix()}${key}`, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
}

let _userId = "";
let _profileId = "default";

export function setUserNamespace(userId: string) {
  _userId = userId;
}

export function getUserNamespace() {
  return _userId;
}

export function setProfileNamespace(id: string) {
  _profileId = id;
}

export function getProfileNamespace() {
  return _profileId;
}

function userPrefix() {
  return _userId ? `u_${_userId}_` : "";
}

export function profileKey(base: string) {
  return `invoiceflow_${userPrefix()}p_${_profileId}_${base}`;
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
    const raw = localStorage.getItem(`${userPrefix()}${key}`);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveRaw<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${userPrefix()}${key}`, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
}

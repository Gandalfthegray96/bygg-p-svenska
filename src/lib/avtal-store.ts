import { type Avtal, normalizeAvtal } from "./kalkyl";

export type Status = "utkast" | "skickat" | "signerat";
export type Version = { version: number; savedAt: string; data: Avtal; status?: Status };
export type CustomerFolder = { name: string; versions: Version[] };

const STORE_KEY = "uc-avtal-store";
const DRAFT_KEY = "uc-avtal-draft";

export function loadStore(): Record<string, CustomerFolder> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveStore(s: Record<string, CustomerFolder>) {
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
}

export function saveVersion(a: Avtal): number {
  const name = a.customer.bestallare.trim() || "Namnlös kund";
  const store = loadStore();
  const folder = store[name] ?? { name, versions: [] };
  const version = (folder.versions.at(-1)?.version ?? 0) + 1;
  folder.versions.push({ version, savedAt: new Date().toISOString(), data: structuredClone(a) });
  store[name] = folder;
  saveStore(store);
  return version;
}

export function deleteVersion(name: string, version: number) {
  const store = loadStore();
  const f = store[name];
  if (!f) return;
  f.versions = f.versions.filter((v) => v.version !== version);
  if (f.versions.length === 0) delete store[name];
  saveStore(store);
}

export function loadDraft(): Avtal | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? normalizeAvtal(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveDraft(a: Avtal) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(a));
}

export function setVersionStatus(name: string, version: number, status: Status) {
  const store = loadStore();
  const v = store[name]?.versions.find((x) => x.version === version);
  if (!v) return;
  v.status = status;
  saveStore(store);
}

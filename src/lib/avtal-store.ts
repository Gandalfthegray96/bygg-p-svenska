import { pushKey, pushShared } from "./cloud-sync";
import { type Avtal, normalizeAvtal } from "./kalkyl";

export type Status = "utkast" | "skickat" | "signerat";
export type Version = { version: number; savedAt: string; data: Avtal; status?: Status };
/** Ett avtal = en egen post. Särskiljs av id; samma kund kan ha flera avtal. Äldre poster får kundnamnet som id. */
export type CustomerFolder = { id: string; name: string; versions: Version[] };

const STORE_KEY = "uc-avtal-store";
const DRAFT_KEY = "uc-avtal-draft";

/** Säkerställer id och namn på en sparad post (äldre filer saknar id och nycklas med kundnamnet). */
export function normalizeFolder(key: string, f: Partial<CustomerFolder> & { versions?: Version[] }): CustomerFolder {
  const id = typeof f.id === "string" && f.id.trim() ? f.id : key;
  const name = (f.name ?? key).trim() || key;
  return { id, name, versions: Array.isArray(f.versions) ? f.versions : [] };
}

export function loadStore(): Record<string, CustomerFolder> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") as Record<string, unknown>;
    const out: Record<string, CustomerFolder> = {};
    for (const [key, f] of Object.entries(raw)) {
      if (!f || typeof f !== "object") continue;
      const folder = normalizeFolder(key, f as Partial<CustomerFolder>);
      out[folder.id] = folder;
    }
    return out;
  } catch {
    return {};
  }
}

function saveStore(s: Record<string, CustomerFolder>) {
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
  void pushShared(s);
}

/** Sparar en ny version. existingId = posten som uppdateras; annars skapas en ny avtalspost. */
export function saveVersion(a: Avtal, existingId?: string): { id: string; version: number } {
  const name = a.customer.bestallare.trim() || "Namnlös kund";
  const store = loadStore();
  const folder = (existingId && store[existingId]) ?? { id: existingId || crypto.randomUUID(), name, versions: [] };
  const version = (folder.versions.at(-1)?.version ?? 0) + 1;
  folder.name = name;
  folder.versions.push({ version, savedAt: new Date().toISOString(), data: structuredClone(a) });
  store[folder.id] = folder;
  saveStore(store);
  return { id: folder.id, version };
}

export function deleteVersion(id: string, version: number) {
  const store = loadStore();
  const f = store[id];
  if (!f) return;
  f.versions = f.versions.filter((v) => v.version !== version);
  if (f.versions.length === 0) delete store[id];
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
  const raw = JSON.stringify(a);
  localStorage.setItem(DRAFT_KEY, raw);
  pushKey(DRAFT_KEY, raw);
}

export function setVersionStatus(id: string, version: number, status: Status) {
  const store = loadStore();
  const v = store[id]?.versions.find((x) => x.version === version);
  if (!v) return;
  v.status = status;
  saveStore(store);
}

/** Hittar vilken annan avtalspost som redan använder avtalsnumret (senaste versionen räknas). */
export function avtalNrOwner(store: Record<string, CustomerFolder>, nr: string, excludeId?: string): string | null {
  const t = nr.trim().toLowerCase();
  if (!t) return null;
  for (const f of Object.values(store)) {
    if (excludeId && f.id === excludeId) continue;
    const last = f.versions.at(-1);
    const v = (last?.data?.customer?.avtalNr ?? "").trim().toLowerCase();
    if (v && v === t) return f.name;
  }
  return null;
}

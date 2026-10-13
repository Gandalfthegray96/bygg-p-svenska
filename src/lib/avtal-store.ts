import { supabase } from "@/integrations/supabase/client";
import { pushKey, pushShared } from "./cloud-sync";
import { type Avtal, normalizeAvtal } from "./kalkyl";

export type Status = "utkast" | "skickat" | "forhandling" | "signerat" | "forlorat";
export type Version = { version: number; savedAt: string; data: Avtal; status?: Status };
export type ActivityKind = "skapat" | "version" | "skickat" | "signerat" | "utkast" | "notering" | "forhandling" | "forlorat";
export type Activity = { id: string; at: string; by: string; kind: ActivityKind; text: string };
export type Contact = { id: string; name: string; roll: string; tel: string; epost: string };
/** Ett avtal = en egen post. Särskiljs av id; samma kund kan ha flera avtal. Äldre poster får kundnamnet som id. */
export type CustomerFolder = { id: string; name: string; versions: Version[]; log?: Activity[]; contacts?: Contact[] };

const STORE_KEY = "uc-avtal-store";
const DRAFT_KEY = "uc-avtal-draft";

let actor = "";
if (typeof window !== "undefined") {
  void supabase.auth.getSession().then(({ data }) => { actor = data.session?.user.email ?? ""; });
  supabase.auth.onAuthStateChange((_e, s) => { actor = s?.user.email ?? ""; });
}
const actorName = () => actor.split("@")[0] || "Okänd";

function logTo(f: CustomerFolder, kind: ActivityKind, text: string) {
  (f.log ??= []).push({ id: crypto.randomUUID(), at: new Date().toISOString(), by: actorName(), kind, text });
}

/** Säkerställer id och namn på en sparad post (äldre filer saknar id och nycklas med kundnamnet). */
export function normalizeFolder(key: string, f: Partial<CustomerFolder> & { versions?: Version[] }): CustomerFolder {
  const id = typeof f.id === "string" && f.id.trim() ? f.id : key;
  const name = (f.name ?? key).trim() || key;
  const out: CustomerFolder = { id, name, versions: Array.isArray(f.versions) ? f.versions : [] };
  if (Array.isArray(f.log)) out.log = f.log;
  if (Array.isArray(f.contacts)) out.contacts = f.contacts;
  return out;
}

/** Kundnyckel: samma kundnamn (skiftlägesokänsligt) = samma kund. */
export const customerKey = (name: string) => name.trim().toLowerCase();

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
  const folder: CustomerFolder = (existingId ? store[existingId] : undefined) ?? { id: existingId || crypto.randomUUID(), name, versions: [] };
  const version = (folder.versions.at(-1)?.version ?? 0) + 1;
  const shared = Object.values(store).find((f) => f.contacts?.length && customerKey(f.name) === customerKey(name))?.contacts;
  if (!folder.contacts && shared) folder.contacts = shared;
  folder.name = name;
  folder.versions.push({ version, savedAt: new Date().toISOString(), data: structuredClone(a) });
  logTo(folder, version === 1 ? "skapat" : "version", version === 1 ? "Avtal skapat (v1)" : `Ny version sparad (v${version})`);
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

const STATUS_TEXT: Record<Status, string> = { skickat: "Avtal skickat", signerat: "Avtal signerat", utkast: "Återställt till utkast", forhandling: "Uppföljning / förhandling", forlorat: "Avtal förlorat / avböjt" };

export function setVersionStatus(id: string, version: number, status: Status) {
  const store = loadStore();
  const f = store[id];
  const v = f?.versions.find((x) => x.version === version);
  if (!f || !v) return;
  if ((v.status ?? "utkast") === status) return;
  v.status = status;
  logTo(f, status, `${STATUS_TEXT[status]} (v${version})`);
  saveStore(store);
}

/** Batch-indexering: ny version per avtal med uppräknade priser, status behålls, loggas. */
export function indexeraBatch(ids: string[], pct: number, scale: (a: Avtal) => Avtal): number {
  const store = loadStore();
  let n = 0;
  for (const id of ids) {
    const f = store[id];
    const last = f?.versions.at(-1);
    if (!f || !last) continue;
    const version = last.version + 1;
    f.versions.push({ version, savedAt: new Date().toISOString(), data: structuredClone(scale(normalizeAvtal(last.data))), status: last.status });
    logTo(f, "version", `Indexreglering +${String(pct).replace(".", ",")} % (v${version})`);
    n++;
  }
  saveStore(store);
  return n;
}

/** Manuell anteckning på ett avtal. */
export function addNote(id: string, text: string) {
  const t = text.trim();
  const store = loadStore();
  const f = store[id];
  if (!f || !t) return;
  logTo(f, "notering", t);
  saveStore(store);
}

export function deleteNote(id: string, noteId: string) {
  const store = loadStore();
  const f = store[id];
  if (!f?.log) return;
  f.log = f.log.filter((x) => !(x.id === noteId && x.kind === "notering"));
  saveStore(store);
}

/** Kontaktpersoner sparas på alla avtalsposter för samma kund så kundkortet blir komplett. */
export function setCustomerContacts(name: string, contacts: Contact[]) {
  const key = customerKey(name);
  const store = loadStore();
  for (const f of Object.values(store)) if (customerKey(f.name) === key) f.contacts = contacts;
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

import { supabase } from "@/integrations/supabase/client";
import { pushKey, pushShared } from "./cloud-sync";
import { cachedAttachments } from "./bilagor";
import { type Avtal, calculate, clampVisits, emptyAvtal, fmtKr, newRow, normalizeAvtal } from "./kalkyl";

export type Status = "offert" | "utkast" | "skickat" | "forhandling" | "signerat" | "forlorat";
export type Version = { version: number; savedAt: string; data: Avtal; status?: Status; downloadedAt?: string };
export type ActivityKind = "skapat" | "version" | "skickat" | "signerat" | "utkast" | "notering" | "forhandling" | "forlorat" | "nedladdat" | "offert";
export type Activity = { id: string; at: string; by: string; kind: ActivityKind; text: string };
export type Contact = { id: string; name: string; roll: string; tel: string; epost: string };
export type Uppsagd = { datum: string; orsak: string; notering: string; by: string; at: string };
export const UPPSAGD_ORSAKER = ["Pris", "Bytt leverantör", "Verksamheten flyttad/nedlagd", "Portar utbytta/borttagna", "Missnöjd med service", "Egen regi", "Annat"];
/** Ett avtal = en egen post. Särskiljs av id; samma kund kan ha flera avtal. Äldre poster får kundnamnet som id. */
export type Forfragan = { beskrivning: string; kontakt: string; telefon: string; epost: string; kalla: string; at: string; by: string; tilldelad?: string };
export type Filial = "GBG" | "BORAS";
export type PlanBesok = { vecka: number | null; klar?: boolean };
export type Planering = { filial?: Filial | undefined; besok: PlanBesok[] };
export type CustomerFolder = { id: string; name: string; versions: Version[]; log?: Activity[]; contacts?: Contact[]; uppsagd?: Uppsagd; forfragan?: Forfragan; planering?: Planering };

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
  if (f.uppsagd && typeof f.uppsagd === "object") out.uppsagd = f.uppsagd;
  if (f.forfragan && typeof f.forfragan === "object") out.forfragan = f.forfragan;
  if (f.planering && typeof f.planering === "object" && Array.isArray(f.planering.besok)) out.planering = f.planering;
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
  const data = { ...a, attachments: a.attachments ?? (version === 1 ? cachedAttachments() : {}) };
  folder.versions.push({ version, savedAt: new Date().toISOString(), data: structuredClone(data) });
  logTo(folder, version === 1 ? "skapat" : "version", version === 1 ? "Avtal skapat (v1)" : `Ny version sparad (v${version})`);
  store[folder.id] = folder;
  saveStore(store);
  return { id: folder.id, version };
}

/** Raderar hela avtalsposten (t.ex. importdubbletter); synken tar även bort raden i registret. */
export function deleteAgreement(id: string) {
  const store = loadStore();
  if (!store[id]) return;
  delete store[id];
  saveStore(store);
}

export function deleteVersion(id: string, version: number) {
  const store = loadStore();
  const f = store[id];
  if (!f) return;
  f.versions = f.versions.filter((v) => v.version !== version);
  if (f.versions.length === 0) delete store[id];
  saveStore(store);
}

/** Säger upp ett avtal: datum, orsak och notering sparas och loggas. Avtalet flyttas till "Uppsagda avtal". */
export function sagUpp(id: string, u: { datum: string; orsak: string; notering: string }) {
  const store = loadStore();
  const f = store[id];
  if (!f) return;
  f.uppsagd = { ...u, by: actorName(), at: new Date().toISOString() };
  logTo(f, "notering", `Avtal uppsagt ${u.datum} – ${u.orsak}${u.notering ? `: ${u.notering}` : ""}`);
  saveStore(store);
}

export function angraUppsagning(id: string) {
  const store = loadStore();
  const f = store[id];
  if (!f?.uppsagd) return;
  delete f.uppsagd;
  logTo(f, "notering", "Uppsägning ångrad");
  saveStore(store);
}

/** Tar bort avtalsposten helt från appen (finns kvar i SharePoint). */
export function deleteAvtal(id: string) {
  const store = loadStore();
  delete store[id];
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

const STATUS_TEXT: Record<Status, string> = { offert: "Flyttad till Att skapa offert", skickat: "Avtal skickat", signerat: "Avtal signerat", utkast: "Återställt till utkast", forhandling: "Uppföljning / förhandling", forlorat: "Avtal förlorat / avböjt" };

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

/** Markerar att versionen laddats ner (PDF/signering) – syns på alla enheter och i loggen. */
export function markDownloaded(id: string, version: number, what: string) {
  const store = loadStore();
  const f = store[id];
  const v = f?.versions.find((x) => x.version === version);
  if (!f || !v) return;
  v.downloadedAt = new Date().toISOString();
  logTo(f, "nedladdat", `${what} nedladdad (v${version})`);
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
    f.versions.push({ version, savedAt: new Date().toISOString(), data: structuredClone(scale(normalizeAvtal(last.data))), status: last.status ?? "utkast" });
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

/** Mapp-import: varje godkänd PDF blir en egen avtalspost. Priset från PDF:en noteras i loggen. */
export function importAvtal(items: { kund: string; avtalNr: string; datum: string; adress: string; perYear: number | null; path: string; status: Status; objekt?: { name: string; qty: number }[]; besokPerAr?: number }[]): number {
  const store = loadStore();
  let n = 0;
  for (const it of items) {
    if (avtalNrOwner(store, it.avtalNr)) continue;
    const a = emptyAvtal();
    const besok = clampVisits(it.besokPerAr ?? 2);
    const objekt = it.objekt?.length ? it.objekt : it.perYear !== null ? [{ name: "Importerat objekt (se PDF)", qty: 1 }] : [];
    a.rows = objekt.map((o) => ({ ...newRow(), name: o.name, qty: Math.max(1, o.qty), visits: besok }));
    // Justera per besök så att årspriset blir exakt som i PDF:en.
    if (it.perYear !== null && a.rows.length) {
      const diff = it.perYear - calculate(a).perYear;
      const n = calculate(a).visits.length || 1;
      a.adjust = String(Math.round((diff / n) * 100) / 100).replace(".", ",");
    }
    Object.assign(a.customer, { bestallare: it.kund.trim() || "Namnlös kund", avtalNr: it.avtalNr, anlAdress: it.adress, ...(it.datum ? { datum: it.datum } : {}) });
    const f: CustomerFolder = { id: crypto.randomUUID(), name: a.customer.bestallare, versions: [{ version: 1, savedAt: new Date().toISOString(), data: a, status: it.status }] };
    logTo(f, "skapat", `Importerat från PDF: ${it.path}`);
    if (it.perYear !== null) logTo(f, "notering", `Pris enligt importerad PDF: ${fmtKr(it.perYear)} / år`);
    else logTo(f, "notering", "Pris kunde inte läsas ur filen – fyll i pris manuellt");
    store[f.id] = f;
    n++;
  }
  saveStore(store);
  return n;
}

/** Hela förfrågan som loggtext, så inget försvinner när kortet blir kompakt. */
export function forfraganText(ff: Forfragan): string {
  return [
    `Förfrågan registrerad${ff.kalla ? ` (${ff.kalla})` : ""}`,
    ff.beskrivning,
    ff.kontakt && `Kontakt: ${ff.kontakt}`,
    ff.telefon && `Telefon: ${ff.telefon}`,
    ff.epost && `E-post: ${ff.epost}`,
    ff.tilldelad && `Tilldelad: ${ff.tilldelad}`,
  ].filter(Boolean).join("\n");
}

/** Ny förfrågan (t.ex. från mejl): skapas som avtalspost v1 med status "offert" så den syns i Pipeline. */
export function createForfragan(f: { kund: string; adress: string; beskrivning: string; kontakt: string; telefon: string; epost: string; kalla: string; tilldelad?: string }): string {
  const store = loadStore();
  const a = emptyAvtal();
  a.customer.bestallare = f.kund.trim();
  a.customer.adress = f.adress.trim();
  a.customer.kontaktperson = f.kontakt.trim();
  a.customer.erRef = f.kontakt.trim();
  a.customer.telefon = f.telefon.trim();
  a.customer.epost = f.epost.trim();
  const id = crypto.randomUUID();
  const folder: CustomerFolder = { id, name: f.kund.trim() || "Namnlös kund", versions: [{ version: 1, savedAt: new Date().toISOString(), data: a, status: "offert" }],
    forfragan: { beskrivning: f.beskrivning.trim(), kontakt: f.kontakt.trim(), telefon: f.telefon.trim(), epost: f.epost.trim(), kalla: f.kalla.trim(), at: new Date().toISOString(), by: actorName(), ...(f.tilldelad ? { tilldelad: f.tilldelad } : {}) } };
  logTo(folder, "offert", forfraganText(folder.forfragan!));
  store[id] = folder;
  saveStore(store);
  return id;
}

/** Sparar filial och planerade veckor för ett avtal (synkas till det delade registret). */
export function setPlanering(id: string, p: Planering) {
  const store = loadStore();
  const f = store[id];
  if (!f) return;
  f.planering = p;
  saveStore(store);
}

/** Mapp-import mot befintliga poster: ny version där avtalsnr, ansvarig och kunduppgifter fylls i (bara tomma fält),
 *  objekt/pris tas från PDF:ens kalkyl om den finns. Status, planering och logg behålls. */
export function fyllImport(items: { postId: string; avtalNr: string; datum: string; adress: string; perYear: number | null; path: string; objekt?: { name: string; qty: number }[]; besokPerAr?: number; info?: Partial<Record<string, string>> }[]): number {
  const store = loadStore();
  let n = 0;
  for (const it of items) {
    const f = store[it.postId];
    const last = f?.versions.at(-1);
    if (!f || !last) continue;
    if (it.avtalNr && avtalNrOwner(store, it.avtalNr, f.id)) continue;
    const a = normalizeAvtal(structuredClone(last.data));
    const c = a.customer as unknown as Record<string, string>;
    const fill: Record<string, string> = { ...(it.info ?? {}), avtalNr: it.avtalNr, datum: it.datum, anlAdress: it.adress };
    const filled: string[] = [];
    for (const [k, v] of Object.entries(fill)) if (v?.trim() && !(c[k] ?? "").trim()) { c[k] = v.trim(); filled.push(k); }
    // Utan avtalspris skrivs inga objekt över – annars blir priset appens standardkalkyl i stället för avtalets.
    if (it.objekt?.length && it.perYear !== null) {
      const besok = clampVisits(it.besokPerAr ?? 2);
      a.rows = it.objekt.map((o) => ({ ...newRow(), name: o.name, qty: Math.max(1, o.qty), visits: besok }));
      a.adjust = "";
    }
    if (it.perYear !== null && a.rows.length) {
      const diff = it.perYear - calculate(a).perYear;
      const nv = calculate(a).visits.length || 1;
      a.adjust = String(Math.round((diff / nv) * 100) / 100).replace(".", ",");
    }
    const version = last.version + 1;
    f.versions.push({ version, savedAt: new Date().toISOString(), data: a, status: last.status ?? "signerat" });
    logTo(f, "version", `Uppgifter importerade från PDF (v${version}): ${it.path}${filled.length ? ` – ifyllt: ${filled.join(", ")}` : ""}`);
    if (it.perYear !== null) logTo(f, "notering", `Pris enligt importerad PDF: ${fmtKr(it.perYear)} / år`);
    else logTo(f, "notering", "Pris kunde inte läsas ur filen – fyll i pris manuellt");
    n++;
  }
  saveStore(store);
  return n;
}

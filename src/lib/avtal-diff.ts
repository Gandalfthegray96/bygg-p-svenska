import type { Avtal, ObjRow } from "./kalkyl";
import { calculate, fmtKr } from "./kalkyl";

type Contact = { id: string; name: string; roll: string; tel: string; epost: string };
type PlanBesok = { vecka: number | null; klar?: boolean };
type Planering = { filial?: string | undefined; besok: PlanBesok[] };

const FORM: Record<string, string> = { fast: "Löpande FU-avtal", garanti: "5-års garantiservice", lopande: "Löpande räkning" };
const CUSTOMER: Record<string, string> = {
  avtalNr: "avtalsnummer", datum: "avtalsdatum", rev: "revision", bestallare: "kundnamn", orgNr: "org.nr", varRef: "vår referens",
  erRef: "er referens", telefon: "telefon", epost: "e-post", befattning: "befattning", adress: "adress", postort: "postort",
  markning: "märkning", epostFaktura: "e-post för faktura", mejlText: "mejltext", anlObjekt: "anläggningsobjekt",
  anlAdress: "serviceadress", kontaktperson: "kontaktperson", coverTitle: "försättsbladets rubrik",
};
const ROW: [keyof ObjRow, string, string][] = [
  ["qty", "antal", " st"], ["minutes", "tidsåtgång", " min"], ["visits", "besök/år", ""], ["mfgNo", "tillverkningsnr", ""],
  ["make", "fabrikat", ""], ["inspNo", "besiktningsnr", ""], ["note", "intern notering", ""], ["facilityId", "serviceadress", ""],
];
const v = (x: unknown) => (x === undefined || x === null || x === "" ? "tomt" : String(x));
const num = (x: number) => String(x).replace(".", ",");

/** Beskriver på svenska varje skillnad mellan två avtalsversioner. */
export function diffAvtal(prev: Avtal, next: Avtal): string[] {
  const out: string[] = [];
  const pc = prev.customer as unknown as Record<string, unknown>, nc = next.customer as unknown as Record<string, unknown>;
  for (const [k, label] of Object.entries(CUSTOMER)) if (v(pc[k]) !== v(nc[k])) out.push(`ändrade ${label} från "${v(pc[k])}" till "${v(nc[k])}"`);
  const before = new Map(prev.rows.map((r) => [r.id, r]));
  const after = new Map(next.rows.map((r) => [r.id, r]));
  for (const r of next.rows) {
    const o = before.get(r.id);
    if (!o) { out.push(`lade till ${r.qty} st ${r.name || "objekt"} (${r.visits} besök/år)`); continue; }
    if (o.name !== r.name) out.push(`bytte namn på objekt "${o.name}" till "${r.name}"`);
    for (const [k, label, unit] of ROW) if (v(o[k]) !== v(r[k])) out.push(`ändrade ${label} på ${r.name || "objekt"} från ${v(o[k])}${o[k] ? unit : ""} till ${v(r[k])}${r[k] ? unit : ""}`);
  }
  for (const o of prev.rows) if (!after.has(o.id)) out.push(`tog bort ${o.qty} st ${o.name || "objekt"}`);
  const nums: [keyof Avtal, string, string][] = [["hourRate", "timpris", " kr"], ["tripFee", "framkörning", " kr"], ["discount", "rabatt på arbete", " %"], ["rabattTim", "timrabatt i prislistan", " %"], ["rabattMaterial", "materialrabatt", " %"]];
  for (const [k, label, unit] of nums) if (prev[k] !== next[k]) out.push(`ändrade ${label} från ${num(Number(prev[k] ?? 0))}${unit} till ${num(Number(next[k] ?? 0))}${unit}`);
  if ((prev.adjust ?? "") !== (next.adjust ?? "")) out.push(`ändrade utjämning från ${v(prev.adjust)} till ${v(next.adjust)}`);
  if ((prev.avtalsform ?? "fast") !== (next.avtalsform ?? "fast")) out.push(`ändrade avtalsform från ${FORM[prev.avtalsform ?? "fast"]} till ${FORM[next.avtalsform ?? "fast"]}`);
  if (JSON.stringify(prev.show) !== JSON.stringify(next.show)) out.push("ändrade prisvisningen i avtalet");
  if ((prev.sarskildaVillkor ?? "") !== (next.sarskildaVillkor ?? "")) out.push("ändrade särskilda villkor");
  const pk = prev.klausuler ?? {}, nk = next.klausuler ?? {};
  for (const k of new Set([...Object.keys(pk), ...Object.keys(nk)])) if ((pk[k] ?? "") !== (nk[k] ?? "")) out.push(`ändrade avtalstexten under rubrik "${k}"`);
  const pf = new Map((prev.facilities ?? []).map((f) => [f.id, f])), nf = new Map((next.facilities ?? []).map((f) => [f.id, f]));
  for (const [id, f] of nf) { const o = pf.get(id); if (!o) out.push(`lade till serviceadress ${f.name || f.address}`); else if (JSON.stringify(o) !== JSON.stringify(f)) out.push(`ändrade serviceadress ${f.name || f.address}`); }
  for (const [id, f] of pf) if (!nf.has(id)) out.push(`tog bort serviceadress ${f.name || f.address}`);
  if (JSON.stringify(prev.attachments ?? {}) !== JSON.stringify(next.attachments ?? {})) out.push("ändrade bilagor");
  try {
    const a = calculate(prev).perYear, b = calculate(next).perYear;
    if (Math.round(a) !== Math.round(b)) out.push(`nytt pris ${fmtKr(b)}/år (tidigare ${fmtKr(a)}/år)`);
  } catch { /* pris kan inte räknas */ }
  return out;
}

export function diffPlanering(prev: Planering | undefined, next: Planering): string[] {
  const out: string[] = [];
  if ((prev?.filial ?? "") !== (next.filial ?? "")) out.push(`ändrade filial från ${v(prev?.filial)} till ${v(next.filial)}`);
  const n = Math.max(prev?.besok.length ?? 0, next.besok.length);
  for (let i = 0; i < n; i++) {
    const a = prev?.besok[i], b = next.besok[i];
    if (!b) { out.push(`tog bort planerat besök ${i + 1}`); continue; }
    if ((a?.vecka ?? null) !== b.vecka) out.push(`ändrade besök ${i + 1} från ${a?.vecka ? `v ${a.vecka}` : "ej planerat"} till ${b.vecka ? `v ${b.vecka}` : "ej planerat"}`);
    if (!!a?.klar !== !!b.klar) out.push(b.klar ? `markerade besök ${i + 1}${b.vecka ? ` (v ${b.vecka})` : ""} som utfört` : `ångrade utfört på besök ${i + 1}`);
  }
  return out;
}

export function diffContacts(prev: Contact[] | undefined, next: Contact[]): string[] {
  const out: string[] = [];
  const p = new Map((prev ?? []).map((c) => [c.id, c]));
  const fmt = (c: Contact) => [c.name, c.roll, c.tel, c.epost].filter(Boolean).join(", ");
  for (const c of next) { const o = p.get(c.id); if (!o) out.push(`lade till kontaktperson ${fmt(c)}`); else if (fmt(o) !== fmt(c)) out.push(`ändrade kontaktperson ${o.name || "namnlös"} till ${fmt(c)}`); }
  const n = new Set(next.map((c) => c.id));
  for (const c of prev ?? []) if (!n.has(c.id)) out.push(`tog bort kontaktperson ${c.name || "namnlös"}`);
  return out;
}

/** "Alexsander Östrand lade till …, ändrade …" */
export function sentence(who: string, changes: string[]): string {
  return `${who} ${changes.join(", ")}`;
}

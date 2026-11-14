// Mapp-import av gamla avtals-PDF:er: sållar bort icke-avtal och plockar ut kund, avtalsnr, datum och kalkyler.
import { parseLegacyText } from "./kalkyl-import";
import { importNumber, priceLabel, verifyKalkyl, type KalkylEvidence, type ReadPrice } from "./import-evidence";
export type ImportKind = "ok" | "granska" | "ej";
export type ImportObj = { name: string; qty: number };
/** En kalkyl (Bilaga 1-sida) — en PDF kan innehålla flera anläggningar. */
export type Kalkyl = { namn: string; objekt: ImportObj[]; besokPerAr: number; perYear: number | null; adress?: string; evidence?: KalkylEvidence };
export type ImportHit = {
  file: string; path: string; kind: ImportKind; reason: string;
  kund: string; avtalNr: string; datum: string; adress: string; perYear: number | null;
  objekt: ImportObj[]; besokPerAr: number; kalkyler: Kalkyl[];
  /** Kunduppgifter ur avtalet (ansvarig säljare = Vår referens) — fyller tomma fält på befintlig post. */
  info: Partial<Record<InfoKey, string>>;
  evidence?: KalkylEvidence;
};
export type InfoKey = "varRef" | "erRef" | "kontaktperson" | "telefon" | "epost" | "epostFaktura" | "orgNr";
const INFO: [InfoKey, RegExp][] = [
  ["varRef", /Vår\s+ref(?:erens)?\s*:?[ \t]*([^\n]{2,50})/i],
  ["erRef", /Er\s+ref(?:erens)?\s*:?[ \t]*([^\n]{2,50})/i],
  ["kontaktperson", /Kontaktperson\s*:?[ \t]*([^\n]{2,50})/i],
  ["telefon", /Tel(?:efon)?\.?\s*:?[ \t]*(\+?[\d][\d\s\-]{5,18}\d)/i],
  ["epostFaktura", /E-?post\s+faktura\s*:?[ \t]*([\w.+-]+@[\w.-]+\.\w+)/i],
  ["epost", /E-?post\s*:?[ \t]*([\w.+-]+@[\w.-]+\.\w+)/i],
  ["orgNr", /Org\.?\s*(?:nr|nummer)\.?\s*:?[ \t]*(\d{6}-?\d{4})/i],
];
/** Plockar kunduppgifter; tomma eller etikett-lika värden hoppas över. UK Portservices egna nummer räknas inte som kundens. */
export function parseInfo(t: string): Partial<Record<InfoKey, string>> {
  const out: Partial<Record<InfoKey, string>> = {};
  for (const [k, re] of INFO) {
    const v = pick(t, re).replace(/\s+(Er|Vår)\s+ref.*$/i, "").trim();
    if (v && !/:$/.test(v) && !/^(Er|Vår|Telefon|E-?post|Kontakt)/i.test(v)) out[k] = v;
  }
  return out;
}

const AVTAL_ORD = [/förebyggande\s+underhåll/i, /underhållsavtal/i, /serviceavtal/i, /\bFU[\s_\-.]?(avtal|\d)/i, /garantiservice/i, /servicetillfällen/i, /avtal\s+mellan\s+parter/i, /servicebesök\s*\/\s*år/i];
// "Faktura" räknas bara som riktig faktura — inte kontaktfält som "E-post Faktura" / "Märkning Faktura".
const EJ_AVTAL = [/faktura\s*(nr|nummer)|att\s+betala|\bOCR\b|förfallodatum/i, /följesedel/i, /offert\s*nr/i, /besiktningsprotokoll/i, /bruksanvisning|manual|datablad|monteringsanvisning/i, /arbetsorder/i];

const pick = (t: string, re: RegExp) => (t.match(re)?.[1] ?? "").replace(/\s+/g, " ").trim();
const field = (t: string, name: string) => pick(t, new RegExp(`\\[\\[Fält ${name}: ([^\\]]*)\\]\\]`));
const perYearOf = (t: string) => textPrices(t).find((p) => p.type === "ar")?.value ?? null;
const kr = (s: string) => { const n = importNumber(s); return n !== null && n > 0 ? n : null; };

/** Explicit money labels only; all read amounts retain their page/line, including conflicts. */
export function textPrices(text: string, file = "PDF", firstPage = 1): ReadPrice[] {
  let page = firstPage, line = 0;
  const out: ReadPrice[] = [];
  for (const raw of text.split(/(\f)|\n/)) {
    if (raw === undefined) continue;
    if (raw === "\f") { page++; line = 0; continue; }
    line++;
    const normalized = raw.replace(/\s*:\s*-/g, ":-");
    const kind = priceLabel(normalized);
    const match = normalized.match(/(\d[\d\s\u00a0.,]*?)\s*(?:kr|sek|:-)?\s*$/i);
    const value = match?.[1] ? kr(match[1]) : null;
    // A bare 'Totalsumma 5 år' is a heading, never an amount.
    if (kind && value !== null && !/\d\s*[-–]?\s*år\s*$/i.test(normalized)) out.push({ ...kind, value, source: { file, location: `Sida ${page}, rad ${line}` } });
  }
  return out;
}
/** Pris per servicebesök: "Summa per servicetillfälle 1 865:-", "Pris per besök: 1865 kr", "1 865 kr/besök". */
export const perVisitOf = (t: string): number | null => {
  const m = t.match(/(?:Summa|Kostnad|Pris|Avgift|Totalt)[^\n\d]{0,12}(?:per|\/)\s*(?:service)?(?:tillfälle|besök|servicebesök)[^\d\n]{0,40}(\d[\d\s\u00a0.,]*\d|\d)/i)
    ?? t.match(/(\d[\d\s\u00a0.,]*\d)\s*(?:kr|:-|sek)\s*(?:\/|per)\s*(?:service)?(?:tillfälle|besök)/i);
  return m?.[1] ? kr(m[1]) : null;
};
const besokOf = (t: string) => { const m = t.match(/(?:servicetillfällen?|service|besök)\s+per\s+år\s*:?\s*(\d{1,2})\b/i) ?? t.match(/(\d{1,2})\s*(?:besök|servicetillfällen|ggr)\s*(?:\/|per)\s*år/i); const n = Number(m?.[1]); return n >= 1 && n <= 12 ? n : null; };

/** Avtalsnr ur filnamn, t.ex. "OF LIH_C0157-1.pdf" → "LIH_C0157". */
export const avtalNrFromFile = (file: string) => file.match(/([A-Za-z]{2,5}_[A-Za-z]?\d{3,6})/)?.[1] ?? file.match(/(?:avt(?:al)?|FU)[\s._\-]*(?:nr)?[\s._\-]*(\d{3,6})\b/i)?.[1] ?? "";

/** Klassar en PDF utifrån dess text. folder = mappen filen ligger i (används som kundnamn om inget hittas). */
export function classify(text: string, file: string, path: string, folder: string): ImportHit {
  const t = text.replace(/\u00a0/g, " ");
  const hay = `${file}\n${t}`;
  const avtal = AVTAL_ORD.filter((r) => r.test(hay)).length;
  const ej = EJ_AVTAL.some((r) => r.test(t.slice(0, 1500)));
  const avtalNr = pick(t, /(?:Avtal\s*(?:s?nr|nummer|sbeteckning)|Avt\.?\s*nr)\.?\s*:?\s*([A-Za-z]{0,6}[\-_\s]?\d[\w\-/]{0,20})/i) || field(t, "Dokument beteckning") || avtalNrFromFile(file);
  let kund = field(t, "Kund 2") || pick(t, /Beställare\s*:?\s*\n?\s*([^\n]{2,60})/);
  if (/^(UK Portservice AB|Entrepren|Org\.?\s*nr)/i.test(kund)) kund = "";
  kund = kund || (folder.trim().length > 2 ? folder : "");
  const datum = pick(t, /(20\d\d-\d\d-\d\d)/);
  const adress = pick(t, /(?:Anläggningsadress|Adress obj\w*|Objektsadress)\s*:?\s*([^\n]{3,80})/i) || field(t, "Projekt");
  const kalkyler = parseKalkyler(t, path);
  const k0 = kalkyler[0];
  const pv = perVisitOf(t);
  // Avtalets eget besökspris gäller när kalkyltabellen saknar årspris.
  if (pv !== null && kalkyler.length === 1 && k0 && k0.perYear === null) k0.perYear = pv * (besokOf(t) ?? k0.besokPerAr);
  const documentPrices = textPrices(t, path);
  if (!documentPrices.length && pv !== null) documentPrices.push({ type: "besok", value: pv, source: { file: path, location: "PDF, pris per besök" } });
  const checked = verifyKalkyl({ source: { file: path, location: "PDF" }, prices: documentPrices, objects: k0?.objekt.reduce((s, o) => s + o.qty, 0) ?? 0, declaredObjects: null, visits: besokOf(t) ?? 2, visitsExplicit: besokOf(t) !== null });
  const perYear = k0 ? sumYear(kalkyler) : checked.perYear;
  const base = { file, path, kund, avtalNr, datum, adress, perYear, objekt: k0?.objekt ?? [], besokPerAr: k0?.besokPerAr ?? besokOf(t) ?? 2, kalkyler, info: parseInfo(t), evidence: k0?.evidence ?? checked.evidence };
  if (!t.trim()) return { ...base, kind: avtal ? "granska" : "ej", reason: "Ingen text i PDF:en (skannad?)" };
  if (!avtal || (ej && avtal < 2)) return { ...base, kind: "ej", reason: kalkyler.length ? "Endast kalkyl – kan slås ihop med ett avtal" : ej ? "Ser ut som faktura/offert/protokoll" : "Inget avtalsord hittades" };
  const saknas = [!avtalNr && "avtalsnr", !kund && "kund", perYear === null && "pris"].filter(Boolean);
  if (kalkyler.length > 1) return { ...base, kind: "granska", reason: `${kalkyler.length} kalkyler i filen – välj vilken som ska importeras` };
  if (k0?.evidence?.verification.unresolvedIssues.length) return { ...base, kind: "granska", reason: k0.evidence.verification.unresolvedIssues.join(" ") };
  return saknas.length ? { ...base, kind: "granska", reason: `Äldre format – saknar ${saknas.join(", ")}` } : { ...base, kind: "ok", reason: "Avtal i dagens format" };
}

const sumYear = (ks: Kalkyl[]) => ks.length && ks.every((k) => k.perYear !== null) ? ks.reduce((s, k) => s + (k.perYear ?? 0), 0) : null;

/** Slår ihop flera kalkyler (t.ex. två anläggningar) till en. */
export function mergeKalkyler(ks: Kalkyl[]): Kalkyl {
  const objekt: ImportObj[] = [];
  for (const k of ks) for (const o of k.objekt) {
    const name = ks.length > 1 ? `${o.name} (${k.namn})` : o.name;
    objekt.push({ name, qty: o.qty });
  }
  return { namn: ks.map((k) => k.namn).join(" + "), objekt, besokPerAr: Math.max(1, ...ks.map((k) => k.besokPerAr)), perYear: sumYear(ks) };
}

/** Hittar alla objekttabeller ("Objekt Antal" … "Kostnad per år"). Dubbletter (samma tabell flera gånger) tas bort. */
export function parseKalkyler(t: string, file = "PDF"): Kalkyl[] {
  let page = 1, line = 0;
  const lines: { text: string; page: number; line: number }[] = [];
  for (const raw of t.split(/(\f)|\n/)) {
    if (raw === undefined) continue;
    if (raw === "\f") { page++; line = 0; continue; }
    line++;
    const text = raw.replace(/\s+/g, " ").trim();
    if (text) lines.push({ text, page, line });
  }
  const out: Kalkyl[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i];
    if (!header || !/^Objekt\s+Antal\b/i.test(header.text)) continue;
    const prev = lines.slice(Math.max(0, i - 3), i).filter((l) => l.page === header.page && !/^(Bilaga|Sida|Objekt)/i.test(l.text));
    const addressLine = prev.findLast((l) => /^(?:Anläggningsadress|Objektsadress|Serviceadress)\s*:/i.test(l.text));
    const adress = addressLine?.text.replace(/^[^:]+:\s*/, "");
    const namn = adress || prev.at(-1)?.text || `Kalkyl ${out.length + 1}`;
    const objekt: ImportObj[] = [];
    let besok = 0, declaredObjects: number | null = null, j = i + 1;
    const prices: ReadPrice[] = [];
    // Rubriken kan stå på samma rad som första objektet.
    const rest = header.text.replace(/^Objekt\s+Antal\s*/i, "");
    const rows = rest ? [rest] : [];
    for (; j < lines.length && j < i + 80; j++) {
      const current = lines[j];
      if (!current) break;
      const l = current.text;
      if (current.page !== header.page || /^Objekt\s+Antal\b|AVTALSTID|Prislista|Timdebitering|^Bilaga\s*2|^(?:Anläggningsadress|Objektsadress|Serviceadress)\s*:/i.test(l)) break;
      const b = besokOf(l); if (b !== null) besok = b;
      if (/^Totalt\s+(?:antal\s+)?objekt/i.test(l)) { declaredObjects = importNumber(l.match(/(\d+)\s*$/)?.[1]); continue; }
      const price = textPrices(l, file, header.page);
      if (price.length) { prices.push(...price.map((p) => ({ ...p, source: { file, location: `Sida ${current.page}, rad ${current.line}` } }))); continue; }
      if (/servicetillfälle|service\s+per\s+år|besök|^(?:Kostnad|Pris|Summa|Avgift)/i.test(l)) continue;
      rows.push(l);
    }
    for (const r of rows) {
      // En rad kan innehålla flera par: "Lastbrygga 8 Rullport 16"
      for (const m of r.matchAll(/([A-Za-zÅÄÖåäöéÉ][^\d]*?)\s+(\d{1,4})(?=\s|$)/g)) {
        const name = m[1]?.trim() ?? "";
        if (name && !/^(Bilaga|Sida)/i.test(name)) objekt.push({ name, qty: Number(m[2]) });
      }
    }
    i = j - 1;
    if (!objekt.length) continue;
    const besokPerAr = Math.min(12, Math.max(1, besok || 2));
    const checked = verifyKalkyl({ source: { file, location: `Sida ${header.page}, rad ${header.line}` }, prices, objects: objekt.reduce((s, o) => s + o.qty, 0), declaredObjects, visits: besokPerAr, visitsExplicit: besok > 0 });
    const k: Kalkyl = { namn, objekt, besokPerAr, perYear: checked.perYear, adress, evidence: checked.evidence };
    const key = JSON.stringify([header.page, namn, k.objekt, k.perYear]);
    if (seen.has(key)) continue;
    seen.add(key); out.push(k);
  }
  return [...out, ...parseLegacyText(t, file)];
}

/** Bakåtkompatibel: första kalkylen. */
export function parseObjekt(t: string): { objekt: ImportObj[]; besokPerAr: number } {
  const k = parseKalkyler(t)[0];
  return { objekt: k?.objekt ?? [], besokPerAr: k?.besokPerAr ?? 2 };
}

/** Läser texten (och ifyllda formulärfält) ur sidorna med pdf.js (körs i webbläsaren). */
export async function pdfText(bytes: ArrayBuffer, maxPages = 14): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  let out = "";
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const page = await doc.getPage(i);
    try {
      for (const a of (await page.getAnnotations()) as { fieldName?: string; fieldValue?: unknown }[]) {
        const v = Array.isArray(a.fieldValue) ? a.fieldValue.join(" ") : typeof a.fieldValue === "string" ? a.fieldValue : "";
        if (a.fieldName && v.trim()) out += `[[Fält ${a.fieldName}: ${v.trim().replace(/[\]\n]/g, " ")}]]\n`;
      }
    } catch { /* inga fält */ }
    const c = await page.getTextContent();
    // Visuell ordning (uppifrån och ned, vänster till höger) — mallens etiketter och ifyllda värden ligger i olika strömordning.
    const items = (c.items as { str: string; transform: number[] }[])
      .filter((it) => typeof it.str === "string" && it.str.trim())
      .map((it) => ({ s: it.str, x: it.transform[4] ?? 0, y: it.transform[5] ?? 0 }));
    const rows: { y: number; parts: { s: string; x: number }[] }[] = [];
    for (const it of items.sort((a, b) => b.y - a.y)) {
      const r = rows.find((r) => Math.abs(r.y - it.y) <= 4);
      if (r) r.parts.push(it); else rows.push({ y: it.y, parts: [it] });
    }
    out += rows.map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(" ")).join("\n");
    out += "\n\f\n";
  }
  await doc.destroy();
  return out;
}

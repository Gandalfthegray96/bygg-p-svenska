// Mapp-import av gamla avtals-PDF:er: sållar bort icke-avtal och plockar ut kund, avtalsnr, datum och kalkyler.
export type ImportKind = "ok" | "granska" | "ej";
export type ImportObj = { name: string; qty: number };
/** En kalkyl (Bilaga 1-sida) — en PDF kan innehålla flera anläggningar. */
export type Kalkyl = { namn: string; objekt: ImportObj[]; besokPerAr: number; perYear: number | null };
export type ImportHit = {
  file: string; path: string; kind: ImportKind; reason: string;
  kund: string; avtalNr: string; datum: string; adress: string; perYear: number | null;
  objekt: ImportObj[]; besokPerAr: number; kalkyler: Kalkyl[];
};

const AVTAL_ORD = [/förebyggande\s+underhåll/i, /underhållsavtal/i, /serviceavtal/i, /\bFU[\s_\-.]?(avtal|\d)/i, /garantiservice/i, /servicetillfällen/i, /avtal\s+mellan\s+parter/i, /servicebesök\s*\/\s*år/i];
// "Faktura" räknas bara som riktig faktura — inte kontaktfält som "E-post Faktura" / "Märkning Faktura".
const EJ_AVTAL = [/faktura\s*(nr|nummer)|att\s+betala|\bOCR\b|förfallodatum/i, /följesedel/i, /offert\s*nr/i, /besiktningsprotokoll/i, /bruksanvisning|manual|datablad|monteringsanvisning/i, /arbetsorder/i];

const pick = (t: string, re: RegExp) => (t.match(re)?.[1] ?? "").replace(/\s+/g, " ").trim();
const amount = (s: string) => { const n = Number(s.replace(/[\s\u00a0.]/g, "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };
const field = (t: string, name: string) => pick(t, new RegExp(`\\[\\[Fält ${name}: ([^\\]]*)\\]\\]`));
const perYearOf = (t: string) => amount(pick(t, /(?:Kostnad|Pris|Avgift)\s+per\s+år[^\d\n]{0,40}([\d\s.]+(?:,\d{1,2})?)/i));

/** Avtalsnr ur filnamn, t.ex. "OF LIH_C0157-1.pdf" → "LIH_C0157". */
export const avtalNrFromFile = (file: string) => file.match(/([A-Za-z]{2,5}_[A-Za-z]?\d{3,6})/)?.[1] ?? "";

/** Klassar en PDF utifrån dess text. folder = mappen filen ligger i (används som kundnamn om inget hittas). */
export function classify(text: string, file: string, path: string, folder: string): ImportHit {
  const t = text.replace(/\u00a0/g, " ");
  const hay = `${file}\n${t}`;
  const avtal = AVTAL_ORD.filter((r) => r.test(hay)).length;
  const ej = EJ_AVTAL.some((r) => r.test(t.slice(0, 1500)));
  const avtalNr = pick(t, /Avtal\s*(?:s?nr|nummer)\.?\s*:?\s*([A-Za-z]{0,6}[\-\s]?\d[\w\-/]{0,20})/i) || field(t, "Dokument beteckning") || avtalNrFromFile(file);
  let kund = field(t, "Kund 2") || pick(t, /Beställare\s*:?\s*\n?\s*([^\n]{2,60})/);
  if (/^(UK Portservice AB|Entrepren|Org\.?\s*nr)/i.test(kund)) kund = "";
  kund = kund || (folder.trim().length > 2 ? folder : "");
  const datum = pick(t, /(20\d\d-\d\d-\d\d)/);
  const adress = pick(t, /(?:Anläggningsadress|Adress obj\w*|Objektsadress)\s*:?\s*([^\n]{3,80})/i) || field(t, "Projekt");
  const kalkyler = parseKalkyler(t);
  const k0 = kalkyler[0];
  const perYear = k0 ? sumYear(kalkyler) : perYearOf(t);
  const base = { file, path, kund, avtalNr, datum, adress, perYear, objekt: k0?.objekt ?? [], besokPerAr: k0?.besokPerAr ?? 2, kalkyler };
  if (!t.trim()) return { ...base, kind: avtal ? "granska" : "ej", reason: "Ingen text i PDF:en (skannad?)" };
  if (!avtal || (ej && avtal < 2)) return { ...base, kind: "ej", reason: kalkyler.length ? "Endast kalkyl – kan slås ihop med ett avtal" : ej ? "Ser ut som faktura/offert/protokoll" : "Inget avtalsord hittades" };
  const saknas = [!avtalNr && "avtalsnr", !kund && "kund", perYear === null && "pris"].filter(Boolean);
  if (kalkyler.length > 1) return { ...base, kind: "granska", reason: `${kalkyler.length} kalkyler i filen – välj vilken som ska importeras` };
  return saknas.length ? { ...base, kind: "granska", reason: `Äldre format – saknar ${saknas.join(", ")}` } : { ...base, kind: "ok", reason: "Avtal i dagens format" };
}

const sumYear = (ks: Kalkyl[]) => ks.some((k) => k.perYear !== null) ? ks.reduce((s, k) => s + (k.perYear ?? 0), 0) : null;

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
export function parseKalkyler(t: string): Kalkyl[] {
  const lines = t.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const out: Kalkyl[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    if (!/^Objekt\s+Antal\b/i.test(lines[i]!)) continue;
    const prev = lines.slice(Math.max(0, i - 3), i).filter((l) => !/^(Bilaga|Sida|Objekt)/i.test(l));
    const namn = prev.at(-1) || `Kalkyl ${out.length + 1}`;
    const objekt: ImportObj[] = [];
    let besok = 0, perYear: number | null = null, j = i + 1;
    // Rubriken kan stå på samma rad som första objektet.
    const rest = lines[i]!.replace(/^Objekt\s+Antal\s*/i, "");
    const rows = rest ? [rest] : [];
    for (; j < lines.length && j < i + 80; j++) {
      const l = lines[j]!;
      if (/^Objekt\s+Antal\b/i.test(l)) break;
      const b = l.match(/servicetillfällen\s+per\s+år\s*:?\s*(\d{1,2})/i); if (b) besok = Number(b[1]);
      if (/Kostnad\s+per\s+år/i.test(l)) { perYear = perYearOf(l); break; }
      if (/^Totalt antal objekt|servicetillfälle|^Kostnad/i.test(l)) continue;
      rows.push(l);
    }
    for (const r of rows) {
      // En rad kan innehålla flera par: "Lastbrygga 8 Rullport 16"
      for (const m of r.matchAll(/([A-Za-zÅÄÖåäöéÉ][^\d]*?)\s+(\d{1,4})(?=\s|$)/g)) {
        const name = m[1]!.trim();
        if (name && !/^(Bilaga|Sida)/i.test(name)) objekt.push({ name, qty: Number(m[2]) });
      }
    }
    i = j;
    if (!objekt.length) continue;
    const k = { namn, objekt, besokPerAr: Math.min(12, Math.max(1, besok || 2)), perYear };
    const key = JSON.stringify([k.objekt, k.perYear]);
    if (seen.has(key)) continue;
    seen.add(key); out.push(k);
  }
  return out;
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
    let lastY: number | null = null;
    for (const it of c.items as { str: string; transform: number[] }[]) {
      const y = it.transform[5] ?? 0;
      out += lastY !== null && Math.abs(y - lastY) > 2 ? "\n" : " ";
      out += it.str; lastY = y;
    }
    out += "\n";
  }
  await doc.destroy();
  return out;
}

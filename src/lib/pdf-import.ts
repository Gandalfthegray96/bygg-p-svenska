// Mapp-import av gamla avtals-PDF:er: sållar bort icke-avtal och plockar ut kund, avtalsnr, datum och pris.
export type ImportKind = "ok" | "granska" | "ej";
export type ImportHit = {
  file: string; path: string; kind: ImportKind; reason: string;
  kund: string; avtalNr: string; datum: string; adress: string; perYear: number | null;
};

const AVTAL_ORD = [/förebyggande\s+underhåll/i, /underhållsavtal/i, /serviceavtal/i, /\bFU[\s_\-.]?(avtal|\d)/i, /garantiservice/i, /servicetillfällen/i];
const EJ_AVTAL = [/\bfaktura\b/i, /följesedel/i, /offert\s*nr/i, /besiktningsprotokoll/i, /bruksanvisning|manual|datablad|monteringsanvisning/i, /arbetsorder/i];

const pick = (t: string, re: RegExp) => (t.match(re)?.[1] ?? "").replace(/\s+/g, " ").trim();
const amount = (s: string) => { const n = Number(s.replace(/[\s\u00a0.]/g, "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };

/** Klassar en PDF utifrån dess text. folder = mappen filen ligger i (används som kundnamn om inget hittas). */
export function classify(text: string, file: string, path: string, folder: string): ImportHit {
  const t = text.replace(/\u00a0/g, " ");
  const hay = `${file}\n${t}`;
  const avtal = AVTAL_ORD.filter((r) => r.test(hay)).length;
  const ej = EJ_AVTAL.some((r) => r.test(t.slice(0, 1500)));
  const avtalNr = pick(t, /Avtal\s*(?:s?nr|nummer)\.?\s*:?\s*([A-Za-z0-9][\w\-/]{1,24})/i);
  const kund = pick(t, /Beställare\s*:?\s*\n?\s*([^\n]{2,60})/) .replace(/^(UK Portservice AB)$/i, "") || folder;
  const datum = pick(t, /(20\d\d-\d\d-\d\d)/);
  const adress = pick(t, /(?:Anläggningsadress|Adress obj\w*|Objektsadress)\s*:?\s*([^\n]{3,80})/i);
  const perYear = amount(pick(t, /(?:Kostnad|Pris|Avgift)\s+per\s+år[^\d\n]{0,40}([\d\s.]+(?:,\d{1,2})?)/i));
  const base = { file, path, kund, avtalNr, datum, adress, perYear };
  if (!t.trim()) return { ...base, kind: avtal ? "granska" : "ej", reason: "Ingen text i PDF:en (skannad?)" };
  if (!avtal || (ej && avtal < 2)) return { ...base, kind: "ej", reason: ej ? "Ser ut som faktura/offert/protokoll" : "Inget avtalsord hittades" };
  const saknas = [!avtalNr && "avtalsnr", !kund && "kund", perYear === null && "pris"].filter(Boolean);
  return saknas.length ? { ...base, kind: "granska", reason: `Äldre format – saknar ${saknas.join(", ")}` } : { ...base, kind: "ok", reason: "Avtal i dagens format" };
}

/** Läser texten ur de första sidorna med pdf.js (körs i webbläsaren). */
export async function pdfText(bytes: ArrayBuffer, maxPages = 6): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  let out = "";
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const c = await (await doc.getPage(i)).getTextContent();
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

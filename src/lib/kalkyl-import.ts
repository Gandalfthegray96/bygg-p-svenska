import type { Kalkyl } from "./pdf-import";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/kr|sek/gi, "").replace(/[\s\u00a0]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Older FU template: Objekt/typ, Antal objekt, Pris/st., Summa. No guessed prices. */
export function parseLegacyRows(rows: unknown[][], namn: string): Kalkyl | null {
  const header = rows.findIndex((r) => /^Objekt\s*\/\s*typ$/i.test(String(r[0] ?? "").trim()) && /Antal\s+objekt/i.test(String(r[1] ?? "")));
  if (header < 0) return null;
  const objekt: Kalkyl["objekt"] = [];
  let besokPerAr = 2;
  let perVisit: number | null = null;
  let perYear: number | null = null;
  for (const row of rows.slice(header + 1)) {
    const label = String(row[0] ?? "").trim();
    const values = row.slice(1).map(num).filter((v): v is number => v !== null);
    if (/servicetillfällen\s+per\s+år/i.test(label)) {
      const visits = values[0];
      if (visits !== undefined && Number.isInteger(visits) && visits >= 1 && visits <= 12) besokPerAr = visits;
    } else if (/^(?:TOTAL\s+SUMMA|Kostnad|Pris|Avgift)\s+per\s+(?:servicetillfälle|servicebesök|besök)/i.test(label)) {
      perVisit = values.at(-1) ?? null;
    } else if (/^(?:TOTAL\s+SUMMA|Kostnad|Pris|Avgift)\s+per\s+år/i.test(label)) {
      perYear = values.at(-1) ?? null;
    } else if (label && !/^(Totalt|Extra|Framkörning)/i.test(label)) {
      const qty = num(row[1]);
      if (qty !== null && Number.isInteger(qty) && qty > 0) objekt.push({ name: label, qty });
    }
  }
  if (!objekt.length) return null;
  return { namn, objekt, besokPerAr, perYear: perYear ?? (perVisit !== null && perVisit > 0 ? perVisit * besokPerAr : null) };
}

/** Equivalent PDF printout; only the first quantity after the name is an object count. */
export function parseLegacyText(text: string): Kalkyl[] {
  const sections = text.split(/(?=Objekt\s*\/\s*typ\s+Antal\s+objekt)/i).filter((s) => /^Objekt\s*\/\s*typ/i.test(s));
  return sections.flatMap((s, i) => {
    const rows: unknown[][] = [["Objekt/typ", "Antal objekt"]];
    for (const line of s.split("\n").slice(1)) {
      if (/\s[x×]\s/i.test(line) && !/^.+?\s+\d+\s+[x×]\s/i.test(line)) continue;
      const m = line.trim().match(/^(.*?)\s+(\d[\d\s.,]*)(?:\s*(?:kr|x|=).*)?$/i);
      if (m) rows.push([m[1], m[2]]);
      else if (/servicetillfällen\s+per\s+år|TOTAL\s+SUMMA\s+per\s+servicetillfälle/i.test(line)) rows.push([line]);
    }
    const k = parseLegacyRows(rows, `Äldre kalkyl ${i + 1}`);
    return k ? [k] : [];
  });
}

export async function excelKalkyler(bytes: ArrayBuffer): Promise<Kalkyl[]> {
  const XLSX = await import("xlsx");
  const book = XLSX.read(bytes, { type: "array" });
  return book.SheetNames.flatMap((name) => {
    const sheet = book.Sheets[name];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
    const k = parseLegacyRows(rows, name);
    return k ? [k] : [];
  });
}
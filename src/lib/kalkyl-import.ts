import type { Kalkyl } from "./pdf-import";
import { columnName, importNumber, priceRows, verifyKalkyl } from "./import-evidence";

const num = importNumber;

function withEvidence(k: Kalkyl, rows: unknown[][], file: string, prices = priceRows(rows, file, k.namn)): Kalkyl {
  const total = rows.find((r) => /^Totalt\s+(?:antal\s+)?objekt|^Summa$/i.test(String(r[0] ?? "")));
  const declared = /^Totalt/i.test(String(total?.[0] ?? "")) ? num(total?.[1]) : null;
  const visitsExplicit = rows.some((r) => r.some((v) => /(?:servicetillfällen?|service|besök)\s+per\s+år/i.test(String(v ?? ""))) && r.some((v) => { const n = num(v); return n !== null && Number.isInteger(n) && n >= 1 && n <= 12; }));
  const checked = verifyKalkyl({ source: { file, location: k.namn }, prices, objects: k.objekt.reduce((s, o) => s + o.qty, 0), declaredObjects: declared, visits: k.besokPerAr, visitsExplicit });
  return { ...k, perYear: checked.perYear, evidence: checked.evidence };
}

/** Older FU template: Objekt/typ, Antal objekt, Pris/st., Summa. No guessed prices. */
export function parseLegacyRows(rows: unknown[][], namn: string, file = namn): Kalkyl | null {
  const header = rows.findIndex((r) => /^Objekt\s*\/\s*typ$/i.test(String(r[0] ?? "").trim()) && /Antal\s+objekt/i.test(String(r[1] ?? "")));
  if (header < 0) return null;
  const objekt: Kalkyl["objekt"] = [];
  let besokPerAr = 2;
  let perVisit: number | null = null;
  let perYear: number | null = null;
  for (const row of rows.slice(header + 1)) {
    const label = String(row[0] ?? "").trim();
    const values = row.slice(1).map(num).filter((v): v is number => v !== null);
    if (/(servicetillfällen?|service|besök)\s+per\s+år/i.test(label)) {
      const visits = values[0];
      if (visits !== undefined && Number.isInteger(visits) && visits >= 1 && visits <= 12) besokPerAr = visits;
    } else if (/^(?:TOTAL\s+)?(?:SUMMA|Kostnad|Pris|Avgift)\s+per\s+(?:servicetillfälle|servicebesök|besök)/i.test(label)) {
      perVisit = values.at(-1) ?? null;
    } else if (/^(?:TOTAL\s+)?(?:SUMMA|Kostnad|Pris|Avgift)\s+per\s+år/i.test(label)) {
      perYear = values.at(-1) ?? null;
    } else if (/^(AVTALSTID|Prislista|Timdebitering|Bilaga\s*2)/i.test(label)) {
      break;
    } else if (label && !/^(Totalt|Extra|Framkörning|Saxlift|Summa|Antal|Övrigt|Kostnad|Pris|Avgift)/i.test(label)) {
      const qty = num(row[1]);
      if (qty !== null && Number.isInteger(qty) && qty > 0) objekt.push({ name: label, qty });
    }
  }
  if (!objekt.length) return null;
  return withEvidence({ namn, objekt, besokPerAr, perYear: perYear ?? (perVisit !== null && perVisit > 0 ? perVisit * besokPerAr : null) }, rows.slice(0, rows.findIndex((r) => /^(AVTALSTID|Prislista|Timdebitering|Bilaga\s*2)/i.test(String(r[0] ?? ""))) < 0 ? rows.length : rows.findIndex((r) => /^(AVTALSTID|Prislista|Timdebitering|Bilaga\s*2)/i.test(String(r[0] ?? "")))), file);
}

/** Equivalent PDF printout; only the first quantity after the name is an object count. */
export function parseLegacyText(text: string, file = "PDF"): Kalkyl[] {
  const sections = text.split(/(?=Objekt\s*\/\s*typ\s+Antal\s+objekt)/i).filter((s) => /^Objekt\s*\/\s*typ/i.test(s));
  return sections.flatMap((s, i) => {
    const rows: unknown[][] = [["Objekt/typ", "Antal objekt"]];
    for (const raw of s.split("\n").slice(1)) {
      const line = raw.replace(/\s*:\s*-/g, ":-").replace(/\s+/g, " ");
      if (/^(AVTALSTID|Prislista|Timdebitering|Bilaga\s*2|\f)/i.test(line.trim())) break;
      if (/\s[x×]\s/i.test(line) && !/^.+?\s+\d+\s+[x×]\s/i.test(line)) continue;
      const m = line.trim().match(/^(.*?)\s+(\d[\d\s.,]*)(?:\s*(?:kr|x|=|:-).*)?$/i);
      if (m) rows.push([m[1], m[2]]);
      else if (/(servicetillfällen?|service)\s+per\s+år|SUMMA\s+per\s+servicetillfälle/i.test(line)) rows.push([line]);
    }
    const k = parseLegacyRows(rows, `Äldre kalkyl ${i + 1}`, file);
    return k ? [k] : [];
  });
}

const txt = (v: unknown) => String(v ?? "").trim();
const SKIP = /^(Framkörning|Eldrift|Extra|Summa|Totalt|Plats|Saxlift|Rabatt|Kostnad|Arbetskostnad)/i;

/** "Servicekalkyl Enkel" (Antal | Objekt | – | Pris) och "Servicekalkyl Flera fastigheter" (Plats-nr | Objekt | Minuter). Summa = pris per besök. */
export function parseServicekalkyl(rows: unknown[][], namn: string, file = namn): Kalkyl | null {
  if (!rows.some((r) => /^Servicekalkyl/i.test(txt(r[0])))) return null;
  const flera = rows.some((r) => /^Plats$/i.test(txt(r[0])));
  const objekt: Kalkyl["objekt"] = [];
  let perVisit: number | null = null;
  for (const r of rows) {
    const a = txt(r[0]), b = txt(r[1]);
    if (/^Summa/i.test(a)) { perVisit = r.slice(1).map(num).filter((v): v is number => v !== null).at(-1) ?? null; continue; }
    const qty = num(r[0]);
    if (!b || SKIP.test(b) || qty === null || !Number.isInteger(qty) || qty < 1) continue;
    const q = flera ? 1 : qty; // i "Flera fastigheter" är kolumn A platsnummer, inte antal
    const o = objekt.find((x) => x.name.toLowerCase() === b.toLowerCase());
    if (o) o.qty += q; else objekt.push({ name: b, qty: q });
  }
  if (!objekt.length) return null;
  const sumRow = rows.findIndex((r) => /^Summa/i.test(txt(r[0])));
  const values = rows[sumRow] ?? [];
  const col = values.findLastIndex((v) => num(v) === perVisit && perVisit !== null);
  const prices = priceRows(rows, file, namn);
  if (!prices.length && perVisit !== null && perVisit > 0) prices.push({ type: "besok", value: perVisit, source: { file, location: `${namn}!${columnName(col)}${sumRow + 1}` } });
  return withEvidence({ namn, objekt, besokPerAr: 2, perYear: null }, rows, file, prices);
}

/** Dagens mall FU_GS_5år: Kalkyl-flik (Produkt | Antal | Tid) + "Antal servicetillfälle" och Kostnad/tillfälle. */
export function parseGsMall(sheets: Record<string, unknown[][]>, file = "Excel"): Kalkyl | null {
  const rows = Object.values(sheets).find((r) => r.some((x) => txt(x[0]) === "Produkt" && txt(x[1]) === "Antal"));
  if (!rows) return null;
  const h = rows.findIndex((x) => txt(x[0]) === "Produkt");
  const objekt: Kalkyl["objekt"] = [];
  for (const r of rows.slice(h + 1)) {
    if (/^Summa/i.test(txt(r[0]))) break;
    const qty = num(r[1]);
    if (txt(r[0]) && txt(r[0]) !== "0" && qty !== null && qty > 0) objekt.push({ name: txt(r[0]), qty });
  }
  if (!objekt.length) return null;
  let besok = 2;
  for (const r of Object.values(sheets).flat()) for (let i = 0; i < r.length; i++) if (/^Antal servicetillf/i.test(txt(r[i]))) { const v = num(r[i + 1]); if (v && v >= 1 && v <= 12) besok = v; }
  const sheetName = Object.entries(sheets).find(([, r]) => r === rows)?.[0] ?? "Kalkyl";
  const prices = priceRows(rows, file, sheetName);
  const k = rows.findIndex((x) => x.some((v) => /^Kostnad\/tillfälle/i.test(txt(v))));
  const costHeader = rows[k] ?? [];
  const labelledTotal = costHeader.findIndex((v) => /^(?:Total(?:t)?|Summa|Kostnad\/tillfälle)$/i.test(txt(v)));
  // Existing template's unnamed total is E; a named total column always wins.
  const col = costHeader.findIndex((v) => /^(?:Total(?:t)?|Summa)$/i.test(txt(v)));
  const totalColumn = col >= 0 ? col : costHeader.length <= 2 && labelledTotal === 0 ? 4 : labelledTotal;
  const perVisit = k >= 0 && totalColumn >= 0 ? num(rows[k + 1]?.[totalColumn]) : null;
  if (perVisit !== null && perVisit > 0) prices.push({ type: "besok", value: perVisit, source: { file, location: `${sheetName}!${columnName(totalColumn)}${k + 2}` } });
  const declared = num(rows.find((r) => /^Summa/i.test(txt(r[0])))?.[1]);
  const visitsExplicit = Object.values(sheets).flat().some((r) => r.some((v, i) => /^Antal servicetillf/i.test(txt(v)) && num(r[i + 1]) === besok));
  const checked = verifyKalkyl({ source: { file, location: sheetName }, prices, objects: objekt.reduce((s, o) => s + o.qty, 0), declaredObjects: declared, visits: besok, visitsExplicit });
  return { namn: "FU-kalkyl", objekt, besokPerAr: besok, perYear: checked.perYear, evidence: checked.evidence };
}

export async function excelKalkyler(bytes: ArrayBuffer, file = "Excel"): Promise<Kalkyl[]> {
  const XLSX = await import("xlsx");
  const book = XLSX.read(bytes, { type: "array" });
  const sheets: Record<string, unknown[][]> = {};
  for (const name of book.SheetNames) { const sh = book.Sheets[name]; if (sh) sheets[name] = XLSX.utils.sheet_to_json<unknown[]>(sh, { header: 1, defval: null }); }
  const gs = parseGsMall(sheets, file);
  if (gs) return [gs];
  return Object.entries(sheets).flatMap(([name, rows]) => {
    const k = parseLegacyRows(rows, name, file) ?? parseServicekalkyl(rows, name, file);
    return k ? [k] : [];
  });
}
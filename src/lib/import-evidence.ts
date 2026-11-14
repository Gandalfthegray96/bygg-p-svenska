import type { ImportEvidence } from "./kalkyl";

export type ImportSource = { file: string; location: string };
export type ReadPrice = {
  type: "besok" | "ar" | "period";
  value: number;
  years?: number;
  source: ImportSource;
};
export type KalkylEvidence = {
  source: ImportSource;
  prices: ReadPrice[];
  declaredObjects: number | null;
  perVisit: number | null;
  periodTotal: number | null;
  periodYears: number | null;
  visitsExplicit: boolean;
  verification: ImportEvidence;
};

/** Accept Swedish money and historical :- notation; reject ambiguous/non-numeric cells. */
export function importNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null || String(value).trim() === "") return null;
  let s = String(value).trim().replace(/kr|sek|:\s*-/gi, "").replace(/[\s\u00a0]/g, "");
  if (/^[+-]?\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
  else if (/^[+-]?\d{1,3}(?:[.,]\d{3})+[.,]\d{1,2}$/.test(s)) {
    const decimal = s.slice(-3).match(/[.,]/)?.[0];
    if (decimal) { const at = s.lastIndexOf(decimal); s = s.slice(0, at).replace(/[.,]/g, "") + "." + s.slice(at + 1); }
  } else s = s.replace(",", ".");
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function priceLabel(label: string): { type: ReadPrice["type"]; years?: number } | null {
  if (!/(?:summa|kostnad|pris|avgift|total|avtalskostnad)/i.test(label)) return null;
  const years = label.match(/(?:\b(\d{1,2})\s*[-–]?\s*års?\b|avtalsperiod\s*\(?\s*(\d{1,2})\s*år)/i);
  if (years) return { type: "period", years: Number(years[1] ?? years[2]) };
  if (/(?:per|\/)\s*(?:service)?(?:tillfälle|besök|servicebesök)/i.test(label)) return { type: "besok" };
  if (/(?:per|\/)\s*år\b/i.test(label)) return { type: "ar" };
  return null;
}

export function priceRows(rows: unknown[][], file: string, sheet: string): ReadPrice[] {
  const out: ReadPrice[] = [];
  rows.forEach((row, ri) => row.forEach((cell, ci) => {
    if (typeof cell !== "string") return;
    const kind = priceLabel(cell);
    if (!kind) return;
    // Never pick visits/times on the next row as a money value.
    for (let j = row.length - 1; j > ci; j--) {
      const value = importNumber(row[j]);
      if (value === null || value <= 0) continue;
      out.push({ ...kind, value, source: { file, location: `${sheet}!${columnName(j)}${ri + 1}` } });
      break;
    }
  }));
  return out;
}

export function columnName(index: number): string {
  let n = index + 1, out = "";
  while (n > 0) { n--; out = String.fromCharCode(65 + n % 26) + out; n = Math.floor(n / 26); }
  return out;
}

/** Compare independently read values, never adjust quantities or prices to make them fit. */
export function verifyKalkyl(input: {
  source: ImportSource; prices: ReadPrice[]; objects: number;
  declaredObjects: number | null; visits: number; visitsExplicit: boolean;
}): { perYear: number | null; evidence: KalkylEvidence } {
  const { source, prices, objects, declaredObjects, visits, visitsExplicit } = input;
  const issues: string[] = [];
  const checks: ImportEvidence["checks"] = [];
  if (declaredObjects !== null) {
    const passed = declaredObjects === objects;
    checks.push({ check: "objektantal", passed, sourceValue: declaredObjects, calculatedValue: objects, sourceFile: source.file, location: source.location });
    if (!passed) issues.push(`Objektantal avviker: dokumentet anger ${declaredObjects}, raderna innehåller ${objects}.`);
  } else issues.push("Dokumentet saknar avläst totalt objektantal.");
  if (!visitsExplicit) issues.push("Besök per år saknas; 2 besök är ett antagande, inte ett avläst värde.");
  const annual = prices.flatMap((p) => {
    const value = p.type === "ar" ? p.value : p.type === "besok" ? p.value * visits : p.years ? p.value / p.years : null;
    return value === null ? [] : [{ p, value: Math.round(value * 100) / 100 }];
  });
  const preferred = annual.find((v) => v.p.type === "ar") ?? annual.find((v) => v.p.type === "besok") ?? annual[0];
  let conflict = false;
  if (preferred) for (const candidate of annual) {
    const passed = Math.abs(candidate.value - preferred.value) <= 0.01;
    checks.push({ check: "prismodell", passed, sourceValue: candidate.p.value, calculatedValue: candidate.value, sourceFile: candidate.p.source.file, location: candidate.p.source.location });
    if (!passed) conflict = true;
  }
  if (conflict) issues.push("Motstridiga priser i dokumentet; inget årspris har valts automatiskt.");
  if (!prices.length) issues.push("Inget uttryckligt besökspris, årspris eller periodpris kunde läsas.");
  const period = prices.find((p) => p.type === "period");
  const visit = prices.find((p) => p.type === "besok");
  const perYear = conflict ? null : preferred?.value ?? null;
  const priceType = preferred?.p.type === "ar" ? "direkt_avlast_ar" : preferred?.p.type === "besok" ? "direkt_avlast_besok" : preferred?.p.years === 5 ? "direkt_avlast_total5" : "okant";
  return { perYear, evidence: {
    source, prices, declaredObjects, perVisit: visit?.value ?? null,
    periodTotal: period?.value ?? null, periodYears: period?.years ?? null, visitsExplicit,
    verification: { confidence: issues.length ? "lag" : "hog", priceType, checks, unresolvedIssues: issues },
  } };
}
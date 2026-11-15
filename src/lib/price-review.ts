import { calculate, clampVisits, newRow, type Avtal } from "./kalkyl";

export type PriceChoice = "avtal" | "kalkyl";
export type PriceReview = { document: number | null; calculated: number; diff: number | null; level: "match" | "avvikelse" | "saknas" };

/** Lägger in importerade objekt (om avtalspris finns) utan att röra priset. */
export function withImportedRows(a: Avtal, objekt: { name: string; qty: number }[] | undefined, besokPerAr: number | undefined, perYear: number | null, facilityId?: string): Avtal {
  const next = structuredClone(a);
  if (objekt?.length && perYear !== null) {
    const besok = clampVisits(besokPerAr ?? 2);
    next.rows = objekt.map((o) => ({ ...newRow(), name: o.name, qty: Math.max(1, o.qty), visits: besok, ...(facilityId ? { facilityId } : {}) }));
  }
  if (objekt?.length && perYear !== null) next.adjust = "";
  return next;
}

/** Jämför dokumentets uttryckliga årspris med appens kalkyl (utan utjämning). */
export function reviewPrice(a: Avtal, documentPerYear: number | null): PriceReview {
  const calculated = Math.round(calculate({ ...a, adjust: "" }).perYear);
  if (documentPerYear === null) return { document: null, calculated, diff: null, level: "saknas" };
  const diff = Math.round(documentPerYear - calculated);
  return { document: documentPerYear, calculated, diff, level: Math.abs(diff) < 1 ? "match" : "avvikelse" };
}

/** Användarens uttryckliga val: avtalspris (öppen, loggad justering per besök) eller appens kalkyl. */
export function applyPriceChoice(a: Avtal, documentPerYear: number | null, choice: PriceChoice): Avtal {
  const next = { ...a, adjust: "" };
  if (choice === "kalkyl" || documentPerYear === null || !next.rows.length) return next;
  const r = reviewPrice(next, documentPerYear);
  const nv = calculate(next).visits.length || 1;
  if (r.diff) next.adjust = String(Math.round((r.diff / nv) * 100) / 100).replace(".", ",");
  return next;
}

import type { Avtal } from "./kalkyl";

export type Avtalsform = "fast" | "garanti" | "lopande";
export const AVTALSFORMER: { id: Avtalsform; label: string; hint: string }[] = [
  { id: "fast", label: "Löpande FU-avtal", hint: "Fast pris, löper tills vidare" },
  { id: "garanti", label: "5-års garantiservice", hint: "Räknar år 1–5, påminner efter 4 år" },
  { id: "lopande", label: "Löpande räkning", hint: "Timdebitering med avtalsrabatt" },
];
export const formOf = (a: Pick<Avtal, "avtalsform">): Avtalsform => a.avtalsform ?? "fast";

const DAY = 86_400_000;
/** Garantiservice: år 1–5 från startdatum; flagga efter 4 år. Andra avtalsformer flaggas aldrig. */
export function garantiStatus(a: Pick<Avtal, "avtalsform">, start: string, now = Date.now()) {
  if (formOf(a) !== "garanti") return null;
  const t0 = new Date(start).getTime();
  if (!Number.isFinite(t0)) return null;
  const years = (now - t0) / (365 * DAY);
  const ar = Math.min(5, Math.max(1, Math.floor(years) + 1));
  const slut = new Date(t0 + 5 * 365 * DAY);
  return { ar, slut, flagga: years >= 4, utgatt: years >= 5 };
}

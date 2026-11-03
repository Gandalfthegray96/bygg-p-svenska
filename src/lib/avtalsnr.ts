import { pushKey } from "./cloud-sync";

// Säljarens senast sparade avtalsnummer, personligt och synkat till kontot.
export const LAST_NR_KEY = "uc-senaste-avtalsnr";

/** Räknar upp sista siffergruppen och behåller nollor, t.ex. ALS_A0114 -> ALS_A0115. */
export function nextAvtalNr(nr: string): string {
  const m = nr.trim().match(/^(.*?)(\d+)(\D*)$/);
  if (!m) return "";
  const n = String(Number(m[2]) + 1).padStart(m[2]!.length, "0");
  return `${m[1]}${n}${m[3]}`;
}

export function loadLastNr(): string {
  return typeof localStorage === "undefined" ? "" : localStorage.getItem(LAST_NR_KEY) ?? "";
}

export function saveLastNr(nr: string) {
  const v = nr.trim();
  if (!v) return;
  localStorage.setItem(LAST_NR_KEY, v);
  pushKey(LAST_NR_KEY, JSON.stringify(v));
}

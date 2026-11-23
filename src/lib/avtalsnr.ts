import { pushKey } from "./cloud-sync";

// Säljarens senast sparade avtalsnummer, personligt och synkat till kontot.
export const LAST_NR_KEY = "uc-senaste-avtalsnr";

const parts = (nr: string) => nr.trim().match(/^(.*?)(\d+)(\D*)$/);

/** Räknar upp sista siffergruppen och behåller nollor, t.ex. ALS_A0114 -> ALS_A0115. */
export function nextAvtalNr(nr: string): string {
  const m = parts(nr);
  if (!m) return "";
  const n = String(Number(m[2]) + 1).padStart(m[2]!.length, "0");
  return `${m[1]}${n}${m[3]}`;
}

/** Högsta numret i samma serie (prefix) bland senaste numret och registrets nummer. */
export function highestInSeries(last: string, existing: string[]): string {
  const m = parts(last);
  if (!m) return last;
  let best = last.trim(), max = Number(m[2]);
  for (const nr of existing) {
    const x = parts(nr);
    if (!x || x[1]!.toLowerCase() !== m[1]!.toLowerCase() || x[3] !== m[3]) continue;
    if (Number(x[2]) > max) { max = Number(x[2]); best = nr.trim(); }
  }
  return best;
}

/** Nästa nummer för ett nytt avtal: fortsätter efter det högsta som redan finns i serien. */
export function nextFromRegister(last: string, existing: string[]): string {
  return nextAvtalNr(highestInSeries(last, existing));
}

/** Ska ett sparat avtals nummer bli säljarens nya senaste? Bara giltiga nummer i samma serie och högre. */
export function shouldUpdateLast(current: string, nr: string): boolean {
  const n = parts(nr);
  if (!n) return false;
  const c = parts(current);
  if (!c) return true;
  return c[1]!.toLowerCase() === n[1]!.toLowerCase() && c[3] === n[3] && Number(n[2]) > Number(c[2]);
}

export function loadLastNr(): string {
  return typeof localStorage === "undefined" ? "" : localStorage.getItem(LAST_NR_KEY) ?? "";
}

/** force = säljaren anger själv sin serie (Inställningar). */
export function saveLastNr(nr: string, force = false) {
  const v = nr.trim();
  if (!v) return;
  if (!force && !shouldUpdateLast(loadLastNr(), v)) return;
  localStorage.setItem(LAST_NR_KEY, v);
  pushKey(LAST_NR_KEY, JSON.stringify(v));
}

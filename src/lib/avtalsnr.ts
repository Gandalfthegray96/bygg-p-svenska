import { pushKey } from "./cloud-sync";

// Säljarens senast sparade avtalsnummer, personligt och synkat till kontot.
export const LAST_NR_KEY = "uc-senaste-avtalsnr";

const parts = (nr: string) => {
  const match = nr.trim().match(/^(.*?)(\d+)(\D*)$/);
  const digits = match?.[2];
  if (!match || !digits || !Number.isSafeInteger(Number(digits))) return null;
  return { prefix: match[1] ?? "", digits, suffix: match[3] ?? "" };
};

/** Räknar upp sista siffergruppen och behåller nollor, t.ex. ALS_A0114 -> ALS_A0115. */
export function nextAvtalNr(nr: string): string {
  const m = parts(nr);
  if (!m) return "";
  const value = Number(m.digits) + 1;
  if (!Number.isSafeInteger(value)) return "";
  const n = String(value).padStart(m.digits.length, "0");
  return `${m.prefix}${n}${m.suffix}`;
}

/** Högsta numret i samma serie (prefix) bland senaste numret och registrets nummer. */
export function highestInSeries(last: string, existing: string[]): string {
  const m = parts(last);
  if (!m) return last;
  let best = last.trim(), max = Number(m.digits);
  for (const nr of existing) {
    const x = parts(nr);
    if (!x || x.prefix.toLowerCase() !== m.prefix.toLowerCase() || x.suffix !== m.suffix) continue;
    if (Number(x.digits) > max) { max = Number(x.digits); best = nr.trim(); }
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
  if (!c) return false;
  return c.prefix.toLowerCase() === n.prefix.toLowerCase() && c.suffix === n.suffix && Number(n.digits) > Number(c.digits);
}

export function loadLastNr(): string {
  return typeof localStorage === "undefined" ? "" : localStorage.getItem(LAST_NR_KEY) ?? "";
}

/** force = säljaren anger själv sin serie (Inställningar). */
export function saveLastNr(nr: string, force = false) {
  const v = nr.trim();
  if (!parts(v)) return;
  if (!force && !shouldUpdateLast(loadLastNr(), v)) return;
  localStorage.setItem(LAST_NR_KEY, v);
  pushKey(LAST_NR_KEY, JSON.stringify(v));
}

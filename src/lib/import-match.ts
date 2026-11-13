// Matchar en importerad PDF mot avtalsposter som redan finns i registret (import fyller bara befintliga kunder).
import type { CustomerFolder } from "./avtal-store";

const STOP = /\b(ab|aktiebolag|hb|kb|fastighets?|fastigheter|bostäder|brf|i|och|the|c\/o)\b/g;
export const normKund = (s: string) =>
  s.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-zåäö0-9 ]/g, " ").replace(STOP, " ").replace(/\s+/g, " ").trim()
    // Genitiv-s: "Karlssons" = "Karlsson"
    .split(" ").map((w) => (w.length > 4 && /[^s]s$/.test(w) ? w.slice(0, -1) : w)).join(" ");
const normAdr = (s: string) => s.toLowerCase().replace(/[^a-zåäö0-9]/g, "");

export type Match = { id: string; name: string; adress: string; score: number };

/** Kandidater sorterade bäst först. Avtalsnr ger träff direkt; annars kundnamn (även mappnamn i sökvägen) + adress. */
export function matchPosts(store: Record<string, CustomerFolder>, hit: { kund: string; avtalNr: string; adress: string; path: string }): Match[] {
  const nr = hit.avtalNr.trim().toLowerCase();
  const names = [hit.kund, ...hit.path.split("/").slice(0, -1)].map(normKund).filter((n) => n.length >= 3);
  const adr = normAdr(hit.adress.split(",")[0] ?? "");
  const out: Match[] = [];
  for (const f of Object.values(store)) {
    const c = f.versions.at(-1)?.data?.customer;
    const fAdr = c?.anlAdress ?? "";
    let score = 0;
    if (nr && (c?.avtalNr ?? "").trim().toLowerCase() === nr) score = 100;
    else {
      const fn = normKund(f.name);
      if (fn.length >= 3) for (const n of names) {
        if (n === fn) score = Math.max(score, 60);
        else if (n.includes(fn) || fn.includes(n)) score = Math.max(score, 40);
      }
      if (score && adr.length >= 5 && normAdr(fAdr).includes(adr)) score += 30;
    }
    if (score) out.push({ id: f.id, name: f.name, adress: fAdr, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

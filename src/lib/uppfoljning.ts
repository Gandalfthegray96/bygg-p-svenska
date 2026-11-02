import type { CustomerFolder } from "./avtal-store";

/** Skickade avtal utan händelse på så här många dagar flaggas för uppföljning. */
export const FOLLOW_UP_DAYS = 14;
const DAY = 86_400_000;

/** Dagar sedan senaste händelse (sparad version eller logg) på posten. */
export function daysSinceActivity(f: CustomerFolder, now = Date.now()): number {
  const v = f.versions.at(-1);
  if (!v) return 0;
  const last = [v.savedAt, ...(f.log ?? []).map((l) => l.at)].sort().at(-1)!;
  return Math.floor((now - new Date(last).getTime()) / DAY);
}

export function isStale(f: CustomerFolder, now = Date.now()): boolean {
  const v = f.versions.at(-1);
  return !!v && !f.uppsagd && (v.status ?? "utkast") === "skickat" && daysSinceActivity(f, now) >= FOLLOW_UP_DAYS;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Admin ser alla; säljare ser avtal där "Vår referens" matchar deras namn. Tekniker ser inga. */
export function canSee(ansvarig: string, me: { role: string | null; name: string }): boolean {
  if (me.role === "admin") return true;
  if (me.role !== "saljare") return false;
  const a = norm(ansvarig), n = norm(me.name);
  if (!a || !n) return false;
  return a === n || a.includes(n) || n.includes(a) || a.split(/\s+/)[0] === n.split(/\s+/)[0];
}

export function staleFor(store: Record<string, CustomerFolder>, me: { role: string | null; name: string }, now = Date.now()) {
  return Object.values(store).filter((f) => isStale(f, now) && canSee(f.versions.at(-1)!.data.customer?.varRef ?? "", me));
}

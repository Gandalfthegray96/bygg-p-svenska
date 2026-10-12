import { supabase } from "@/integrations/supabase/client";

// Personliga nycklar som speglas till kontot i molnet.
export const SYNC_KEYS = ["uc-avtal-draft", "uc-kalender", "uc-kalender-ics-url", "uc-kalender-feed"] as const;
// Avtalsregistret är gemensamt för hela företaget (en rad per kund).
export const SHARED_STORE_KEY = "uc-avtal-store";
const OWNER_KEY = "uc-sync-owner";

let userId: string | null = null;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let lastShared: Record<string, string> = {};

/** Hämtar kontots data och det gemensamma avtalsregistret till den här enheten. */
export async function pullAll(uid: string) {
  userId = uid;
  const [{ data, error }, shared] = await Promise.all([
    supabase.from("user_data").select("key, value"),
    supabase.from("avtal_register").select("name, folder"),
  ]);
  if (error) throw error;
  for (const k of SYNC_KEYS) localStorage.removeItem(k);
  for (const row of data) {
    if (row.key === SHARED_STORE_KEY) continue;
    const v = row.value;
    localStorage.setItem(row.key, typeof v === "string" ? v : JSON.stringify(v));
  }
  const store: Record<string, unknown> = {};
  lastShared = {};
  for (const r of shared.data ?? []) {
    store[r.name] = r.folder;
    lastShared[r.name] = JSON.stringify(r.folder);
  }
  localStorage.setItem(SHARED_STORE_KEY, JSON.stringify(store));
  localStorage.setItem(OWNER_KEY, uid);
}

export function stopSync() {
  userId = null;
}

/** Skickar ändrade/borttagna kunder i det gemensamma registret. */
export async function pushShared(store: Record<string, unknown>) {
  if (!userId) return;
  const upserts = Object.entries(store)
    .filter(([n, f]) => lastShared[n] !== JSON.stringify(f))
    .map(([name, folder]) => ({ name, folder: folder as never, updated_at: new Date().toISOString(), updated_by: userId }));
  const removed = Object.keys(lastShared).filter((n) => !(n in store));
  if (upserts.length) {
    const { error } = await supabase.from("avtal_register").upsert(upserts);
    if (error) console.error("Synk av avtal misslyckades", error);
  }
  if (removed.length) {
    const { error } = await supabase.from("avtal_register").delete().in("name", removed);
    if (error) console.error("Borttagning av avtal misslyckades", error);
  }
  lastShared = Object.fromEntries(Object.entries(store).map(([n, f]) => [n, JSON.stringify(f)]));
}

/** Skickar en lokal ändring till molnet (fördröjt så snabbt skrivande inte spammar). */
export function pushKey(key: string, raw: string) {
  if (!userId) return;
  const uid = userId;
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(async () => {
    timers.delete(key);
    let value: unknown = raw;
    try { value = JSON.parse(raw); } catch { /* sparas som text */ }
    const { error } = await supabase.from("user_data").upsert({ user_id: uid, key, value: value as never, updated_at: new Date().toISOString() });
    if (error) console.error("Synk misslyckades", error);
  }, 800));
}

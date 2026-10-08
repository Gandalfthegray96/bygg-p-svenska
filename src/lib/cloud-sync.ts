import { supabase } from "@/integrations/supabase/client";

// Lokala nycklar som speglas till kontot i molnet.
export const SYNC_KEYS = ["uc-avtal-store", "uc-avtal-draft", "uc-kalender", "uc-kalender-ics-url"] as const;
const OWNER_KEY = "uc-sync-owner";

let userId: string | null = null;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Hämtar kontots data till den här enheten. Rensar annat kontos lokala data. */
export async function pullAll(uid: string) {
  userId = uid;
  const { data, error } = await supabase.from("user_data").select("key, value");
  if (error) throw error;
  if (localStorage.getItem(OWNER_KEY) !== uid || data.length) {
    for (const k of SYNC_KEYS) localStorage.removeItem(k);
  }
  for (const row of data) {
    const v = row.value;
    localStorage.setItem(row.key, typeof v === "string" ? v : JSON.stringify(v));
  }
  localStorage.setItem(OWNER_KEY, uid);
}

export function stopSync() {
  userId = null;
  timers.forEach(clearTimeout);
  timers.clear();
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

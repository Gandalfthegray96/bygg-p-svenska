import { supabase } from "@/integrations/supabase/client";

/** Företagsgemensamma interna parametrar som admin kan ändra. */
export type ForetagSettings = { kostnadTimme: number; kostnadFramkorning: number; indexPct: number };
export const DEFAULT_SETTINGS: ForetagSettings = { kostnadTimme: 508, kostnadFramkorning: 350, indexPct: 2.5 };

const KEY = "uc-foretag-settings";
const ROW = "foretag";

export function getSettings(): ForetagSettings {
  if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return DEFAULT_SETTINGS; }
}

export async function pullSettings() {
  const { data } = await supabase.from("app_settings").select("value").eq("key", ROW).maybeSingle();
  if (data?.value) localStorage.setItem(KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...(data.value as object) }));
}

export async function saveSettings(s: ForetagSettings) {
  const { error } = await supabase.from("app_settings").upsert({ key: ROW, value: s, updated_at: new Date().toISOString() });
  if (!error) localStorage.setItem(KEY, JSON.stringify(s));
  return error;
}

export const fmtPct = (n: number) => String(n).replace(".", ",");

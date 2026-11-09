import { pushKey } from "@/lib/cloud-sync";

export type Kontakt = { namn: string; telefon: string; epost: string };
const KEY = "uc-mina-kontakt";

export function loadKontakt(): Kontakt {
  try { return { namn: "", telefon: "", epost: "", ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
  catch { return { namn: "", telefon: "", epost: "" }; }
}
export function saveKontakt(k: Kontakt) {
  const raw = JSON.stringify(k);
  localStorage.setItem(KEY, raw);
  void pushKey(KEY, raw);
}

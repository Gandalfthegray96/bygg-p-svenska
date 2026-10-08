export type KalEvent = { id: string; title: string; start: string; end?: string | undefined; place?: string | undefined; note?: string | undefined; source: "app" | "outlook" };

const KEY = "uc-kalender";
const URL_KEY = "uc-kalender-ics-url";

export function loadEvents(): KalEvent[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function saveEvents(e: KalEvent[]) { localStorage.setItem(KEY, JSON.stringify(e)); }
export function loadIcsUrl() { return localStorage.getItem(URL_KEY) || ""; }
export function saveIcsUrl(u: string) { localStorage.setItem(URL_KEY, u); }

function unfold(s: string) { return s.replace(/\r?\n[ \t]/g, ""); }
function parseDate(v: string): string {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return v;
  const [, y, mo, d, h = "00", mi = "00", se = "00", z] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${se}${z ? "Z" : ""}`;
  return new Date(iso).toISOString();
}
const unesc = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");

export function parseIcs(text: string): KalEvent[] {
  const out: KalEvent[] = [];
  const blocks = unfold(text).split("BEGIN:VEVENT").slice(1);
  for (const b of blocks) {
    const get = (k: string) => b.match(new RegExp(`^${k}(?:;[^:\\r\\n]*)?:(.*)$`, "m"))?.[1]?.trim();
    const start = get("DTSTART");
    if (!start) continue;
    const end = get("DTEND");
    out.push({
      id: "o-" + (get("UID") || Math.random().toString(36).slice(2)) + start,
      title: unesc(get("SUMMARY") || "(utan titel)"),
      start: parseDate(start),
      end: end ? parseDate(end) : undefined,
      place: get("LOCATION") ? unesc(get("LOCATION")!) : undefined,
      source: "outlook",
    });
  }
  return out;
}

const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

export function eventToIcs(e: KalEvent): string {
  const end = e.end || new Date(new Date(e.start).getTime() + 3600000).toISOString();
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//UK Portservice//Avtalskalkylator//SV",
    "BEGIN:VEVENT", `UID:${e.id}@ukportservice`, `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(e.start)}`, `DTEND:${fmt(end)}`, `SUMMARY:${esc(e.title)}`,
    e.place ? `LOCATION:${esc(e.place)}` : "", e.note ? `DESCRIPTION:${esc(e.note)}` : "",
    "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Påminnelse", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

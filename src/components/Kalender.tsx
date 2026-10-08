import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, RefreshCw, Trash2, Plus, Bell, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type KalEvent, eventToIcs, getFeedUrl, loadEvents, loadIcsUrl, parseIcs, saveEvents, saveIcsUrl } from "@/lib/kalender-store";
import { fetchIcs } from "@/lib/ics.functions";
import { saveFile } from "@/lib/save-file";

const DAYS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

export function Kalender({ defaultTitle, defaultPlace }: { defaultTitle: string; defaultPlace: string }) {
  const [events, setEvents] = useState<KalEvent[]>([]);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(() => key(new Date()));
  const [form, setForm] = useState({ title: "", time: "08:00", place: "", note: "" });
  const [icsUrl, setIcsUrl] = useState("");
  const [syncMsg, setSyncMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [openPanel, setOpenPanel] = useState<"sync" | "feed" | null>(null);

  useEffect(() => { setEvents(loadEvents()); setIcsUrl(loadIcsUrl()); setFeedUrl(getFeedUrl()); }, []);
  const persist = (e: KalEvent[]) => { setEvents(e); saveEvents(e); };

  // Påminnelser: notis 30 min innan appens egna besök (när appen är öppen).
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const timers = events.filter((e) => e.source === "app").map((e) => {
      const ms = new Date(e.start).getTime() - 30 * 60000 - Date.now();
      return ms > 0 && ms < 864e5 ? setTimeout(() => new Notification(`Om 30 min: ${e.title}`, { body: e.place || "" }), ms) : undefined;
    });
    return () => timers.forEach((t) => t && clearTimeout(t));
  }, [events]);

  const byDay = useMemo(() => {
    const m: Record<string, KalEvent[]> = {};
    for (const e of events) (m[key(new Date(e.start))] ??= []).push(e);
    Object.values(m).forEach((l) => l.sort((a, b) => a.start.localeCompare(b.start)));
    return m;
  }, [events]);

  const cells = useMemo(() => {
    const first = (month.getDay() + 6) % 7;
    const start = new Date(month); start.setDate(1 - first);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [month]);

  const add = () => {
    const [h, mi] = form.time.split(":").map(Number);
    const [y = 0, mo = 1, d = 1] = sel.split("-").map(Number);
    const start = new Date(y, mo - 1, d, h || 0, mi || 0).toISOString();
    persist([...events, { id: crypto.randomUUID(), title: form.title || defaultTitle || "Kundbesök", start, place: form.place || defaultPlace, note: form.note, source: "app" }]);
    setForm({ title: "", time: "08:00", place: "", note: "" });
  };

  const sync = async () => {
    if (!icsUrl.trim()) return;
    setBusy(true); setSyncMsg("");
    try {
      saveIcsUrl(icsUrl.trim());
      const { text } = await fetchIcs({ data: { url: icsUrl.trim() } });
      const imported = parseIcs(text);
      persist([...events.filter((e) => e.source !== "outlook"), ...imported]);
      setSyncMsg(`Synkat: ${imported.length} händelser från Outlook`);
    } catch (e) {
      setSyncMsg((e as Error).message || "Synkningen misslyckades");
    } finally { setBusy(false); }
  };

  const exportIcs = (e: KalEvent) => saveFile(new Blob([eventToIcs(e)], { type: "text/calendar" }), `${e.title.replace(/[^\wåäöÅÄÖ -]/g, "")}.ics`, "text/calendar", ".ics");
  const today = key(new Date());
  const dayList = byDay[sel] ?? [];

  return (
    <div className="space-y-4">
      <section className="ds-panel">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold capitalize text-foreground">{month.toLocaleDateString("sv-SE", { month: "long", year: "numeric" })}</h2>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" aria-label="Föregående månad" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></Button>
            <Button variant="ghost" className="h-9 px-3 text-sm" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSel(key(d)); }}>Idag</Button>
            <Button variant="ghost" size="icon" aria-label="Nästa månad" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">{DAYS.map((d) => <div key={d}>{d}</div>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const k = key(d); const list = byDay[k] ?? []; const inMonth = d.getMonth() === month.getMonth();
            return (
              <button key={k} onClick={() => setSel(k)}
                className={`min-h-16 rounded-lg border p-1 text-left text-xs transition-colors ${sel === k ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted"} ${inMonth ? "" : "opacity-40"}`}>
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-semibold ${k === today ? "bg-foreground text-background" : "text-foreground"}`}>{d.getDate()}</span>
                {list.slice(0, 2).map((e) => (
                  <div key={e.id} className={`mt-0.5 truncate rounded px-1 ${e.source === "outlook" ? "bg-info/15 text-info" : "bg-primary/20 text-foreground"}`}>{e.title}</div>
                ))}
                {list.length > 2 && <div className="text-muted-foreground">+{list.length - 2}</div>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="ds-panel">
        <h3 className="mb-2 font-display font-semibold text-foreground">{new Date(sel).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}</h3>
        {dayList.length === 0 && <p className="text-sm text-muted-foreground">Inga händelser denna dag.</p>}
        <ul className="space-y-2">
          {dayList.map((e) => (
            <li key={e.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <span className="w-12 font-semibold tabular-nums text-foreground">{time(e.start)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{e.title}</p>
                {(e.place || e.note) && <p className="truncate text-xs text-muted-foreground">{[e.place, e.note].filter(Boolean).join(" · ")}</p>}
              </div>
              <span className={`ds-badge ${e.source === "outlook" ? "bg-info/15 text-info" : "bg-muted text-muted-foreground"}`}>{e.source === "outlook" ? "Outlook" : "App"}</span>
              {e.source === "app" && <>
                <Button variant="ghost" size="icon" title="Lägg till i Outlook" aria-label="Lägg till i Outlook" onClick={() => exportIcs(e)}><Download size={16} /></Button>
                <Button variant="ghost" size="icon" title="Ta bort" aria-label="Ta bort" className="hover:text-destructive" onClick={() => persist(events.filter((x) => x.id !== e.id))}><Trash2 size={16} /></Button>
              </>}
            </li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[2fr_100px_2fr_2fr_auto]">
          <input className="ds-input" placeholder={defaultTitle || "Kundbesök"} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="ds-input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          <input className="ds-input" placeholder={defaultPlace || "Adress"} value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} />
          <input className="ds-input" placeholder="Notering" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <Button onClick={add} className="gap-1.5"><Plus size={16} />Boka</Button>
        </div>
        {typeof Notification !== "undefined" && Notification.permission === "default" && (
          <Button variant="ghost" className="mt-2 gap-1.5 text-sm text-info" onClick={() => Notification.requestPermission().then(() => setEvents([...events]))}><Bell size={16} />Slå på påminnelser</Button>
        )}
      </section>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button variant="outline" className="justify-start gap-2" onClick={() => setOpenPanel("sync")}><RefreshCw size={16} />Synka Outlook-kalendern</Button>
        <Button variant="outline" className="justify-start gap-2" onClick={() => setOpenPanel("feed")}><Download size={16} />Visa appens besök i Outlook</Button>
      </div>

      {openPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm" onClick={() => setOpenPanel(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            {openPanel === "sync" ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display font-semibold text-foreground">Synka Outlook-kalendern</h3>
                  <Button variant="ghost" size="icon" aria-label="Stäng" onClick={() => setOpenPanel(null)}><X /></Button>
                </div>
                <p className="mb-3 mt-1 text-xs text-muted-foreground">
                  I Outlook: Inställningar → Kalender → Delade kalendrar → <b>Publicera en kalender</b> → kopiera ICS-länken och klistra in här.
                  Om ni inte kan publicera har IT spärrat det. Besök du bokar här läggs in i Outlook med nedladdningsknappen.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input className="ds-input flex-1" placeholder="https://outlook.office365.com/owa/calendar/…/calendar.ics" value={icsUrl} onChange={(e) => setIcsUrl(e.target.value)} />
                  <Button onClick={sync} disabled={busy} className="gap-1.5"><RefreshCw size={16} className={busy ? "animate-spin" : ""} />Synka</Button>
                </div>
                {syncMsg && <p className="mt-2 text-sm text-foreground">{syncMsg}</p>}
              </>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display font-semibold text-foreground">Visa appens besök i Outlook</h3>
                  <Button variant="ghost" size="icon" aria-label="Stäng" onClick={() => setOpenPanel(null)}><X /></Button>
                </div>
                <p className="mb-3 mt-1 text-xs text-muted-foreground">
                  Kopiera länken. I Outlook: <b>Lägg till kalender → Prenumerera från webben</b> → klistra in → Importera.
                  Besök du bokar här dyker sedan upp i Outlook av sig själva (Outlook uppdaterar med några timmars mellanrum). Dela inte länken.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input readOnly className="ds-input flex-1" value={feedUrl} onFocus={(e) => e.target.select()} aria-label="Prenumerationslänk" />
                  <Button onClick={async () => { await navigator.clipboard.writeText(feedUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="gap-1.5">
                    {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Kopierad" : "Kopiera länk"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

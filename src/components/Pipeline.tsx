import { sendPush } from "@/lib/push.functions";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Mail, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { calculate, fmtKr, normalizeAvtal } from "@/lib/kalkyl";
import { createForfragan, setVersionStatus, type Forfragan, type CustomerFolder, type Status, type Version } from "@/lib/avtal-store";

const COLS: { id: Status; label: string; cls: string }[] = [
  { id: "offert", label: "Att skapa offert", cls: "bg-accent-foreground" },
  { id: "utkast", label: "Utkast", cls: "bg-muted-foreground" },
  { id: "skickat", label: "Skickat", cls: "bg-info" },
  { id: "forhandling", label: "Uppföljning / förhandling", cls: "bg-primary" },
  { id: "signerat", label: "Signerat", cls: "bg-success" },
  { id: "forlorat", label: "Förlorat / avböjt", cls: "bg-destructive" },
];
const DAY = 86_400_000;
import { FOLLOW_UP_DAYS } from "@/lib/uppfoljning";
export { FOLLOW_UP_DAYS };

type Card = { id: string; name: string; v: Version; status: Status; perYear: number; avtalNr: string; ansvarig: string; days: number; ff?: Forfragan | undefined };

export function Pipeline({ store, onOpen, onChanged }: { store: Record<string, CustomerFolder>; onOpen: (id: string, name: string, v: Version) => void; onChanged: () => void }) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const [nyOpen, setNyOpen] = useState(false);
  const empty = { kund: "", adress: "", beskrivning: "", kontakt: "", telefon: "", epost: "", kalla: "Mejl" };
  const [ny, setNy] = useState(empty);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [saljare, setSaljare] = useState("");
  useEffect(() => { supabase.rpc("chat_users").then(({ data }) => setUsers((data as { id: string; name: string; email: string }[]) ?? [])); }, []);
  const spara = async () => {
    const u = users.find((x) => x.id === saljare);
    const uname = u ? u.name || u.email : "";
    const id = createForfragan({ ...ny, tilldelad: uname });
    if (u) {
      await sendPush({ data: { userIds: [u.id], title: "🔔 Ny förfrågan tilldelad dig", body: `${ny.kund.trim()}${ny.beskrivning.trim() ? ` – ${ny.beskrivning.trim().slice(0, 120)}` : ""}`, tag: `ping-${id}` } }).catch(() => {});
    }
    setNy(empty); setSaljare(""); setNyOpen(false); onChanged();
  };
  const fld = (k: keyof typeof empty, label: string, type = "text") => (
    <div className="space-y-1"><Label htmlFor={`ff-${k}`}>{label}</Label><Input id={`ff-${k}`} type={type} value={ny[k]} onChange={(e) => setNy({ ...ny, [k]: e.target.value })} /></div>
  );

  const cards = useMemo<Card[]>(() => Object.values(store).filter((f) => f.versions.length).map((f) => {
    const v = f.versions.at(-1)!;
    const a = normalizeAvtal(v.data);
    const last = [v.savedAt, ...(f.log ?? []).map((l) => l.at)].sort().at(-1)!;
    return { id: f.id, name: f.name, v, status: v.status ?? "utkast", perYear: calculate(a).perYear, avtalNr: a.customer.avtalNr ?? "", ansvarig: a.customer.varRef ?? "", days: Math.floor((Date.now() - new Date(last).getTime()) / DAY), ff: f.forfragan };
  }), [store]);

  const move = (c: Card, s: Status) => { setVersionStatus(c.id, c.v.version, s); onChanged(); };
  const stale = cards.filter((c) => c.status === "skickat" && c.days >= FOLLOW_UP_DAYS).length;

  return (
    <div className="space-y-3">
      <div className="ds-panel flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[15px] font-semibold text-foreground">Säljpipeline</h2>
        <Button size="sm" onClick={() => setNyOpen(true)}><Plus size={15} />Ny förfrågan</Button>
        {stale > 0 && <span className="flex items-center gap-1.5 rounded-md bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive"><AlertTriangle size={14} />{stale} avtal behöver följas upp</span>}
      </div>
      <div className="flex snap-x gap-3 overflow-x-auto pb-2">
        {COLS.map((col, ci) => {
          const list = cards.filter((c) => c.status === col.id).sort((a, b) => b.v.savedAt.localeCompare(a.v.savedAt));
          return (
            <section key={col.id} aria-label={col.label}
              onDragOver={(e) => { e.preventDefault(); setOver(col.id); }} onDragLeave={() => setOver(null)}
              onDrop={() => { const c = cards.find((x) => x.id === drag); if (c) move(c, col.id); setDrag(null); setOver(null); }}
              className={`flex w-[78vw] max-w-72 shrink-0 snap-start flex-col gap-2 rounded-xl border p-2 sm:w-64 ${over === col.id ? "border-primary bg-primary/10" : "border-border bg-muted/40"}`}>
              <header className="flex items-center gap-2 px-1 pt-1">
                <span className={`h-2.5 w-2.5 rounded-full ${col.cls}`} />
                <h3 className="flex-1 truncate text-sm font-semibold text-foreground">{col.label}</h3>
                <span className="text-xs tabular-nums text-muted-foreground">{list.length}</span>
              </header>
              {col.id === "offert" && <Button variant="outline" size="sm" className="h-8" onClick={() => setNyOpen(true)}><Plus size={14} />Ny förfrågan</Button>}
              {col.id !== "offert" && <p className="px-1 text-xs tabular-nums text-muted-foreground">{fmtKr(list.reduce((t, c) => t + c.perYear, 0))} / år</p>}
              {list.map((c) => {
                const flag = c.status === "skickat" && c.days >= FOLLOW_UP_DAYS;
                return (
                  <article key={c.id} draggable onDragStart={() => setDrag(c.id)}
                    className={`space-y-1.5 rounded-lg border bg-card p-2.5 shadow-sm ${flag ? "border-destructive" : "border-border"}`}>
                    <button onClick={() => onOpen(c.id, c.name, c.v)} className="block w-full text-left">
                      <span className="block truncate text-sm font-semibold text-foreground">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{c.avtalNr ? `Nr ${c.avtalNr}` : "Inget avtalsnr"}{c.ansvarig ? ` · ${c.ansvarig}` : ""}</span>
                    </button>
                    {c.ff && (
                      <div className="space-y-1 rounded-md bg-muted/60 p-2 text-xs text-foreground">
                        {c.ff.beskrivning && <p className="line-clamp-4 whitespace-pre-wrap">{c.ff.beskrivning}</p>}
                        {c.ff.kontakt && <p className="font-medium">{c.ff.kontakt}</p>}
                        {c.ff.telefon && <a href={`tel:${c.ff.telefon}`} className="flex items-center gap-1 text-info"><Phone size={12} />{c.ff.telefon}</a>}
                        {c.ff.epost && <a href={`mailto:${c.ff.epost}`} className="flex items-center gap-1 truncate text-info"><Mail size={12} />{c.ff.epost}</a>}
                        <p className="text-muted-foreground">{c.ff.kalla ? `${c.ff.kalla} · ` : ""}{new Date(c.ff.at).toLocaleDateString("sv-SE")}{c.ff.by ? ` · ${c.ff.by}` : ""}</p>
                        {c.ff.tilldelad && <p className="font-semibold text-info">Tilldelad: {c.ff.tilldelad}</p>}
                      </div>
                    )}
                    {c.status === "offert" && <Button size="sm" className="h-7 w-full" onClick={() => onOpen(c.id, c.name, c.v)}>Skapa kalkyl</Button>}
                    <div className="flex items-center justify-between text-xs">
                      {c.status !== "offert" ? <span className="font-semibold tabular-nums text-foreground">{fmtKr(c.perYear)}/år</span> : <span />}
                      <span className={flag ? "flex items-center gap-1 font-semibold text-destructive" : "text-muted-foreground"}>{flag && <AlertTriangle size={12} />}{c.days} d</span>
                    </div>
                    <div className="flex justify-between">
                      <Button variant="ghost" size="sm" className="h-7 px-1.5" disabled={ci === 0} aria-label="Flytta bakåt" onClick={() => move(c, COLS[ci - 1]!.id)}><ChevronLeft size={16} /></Button>
                      <Button variant="ghost" size="sm" className="h-7 px-1.5" disabled={ci === COLS.length - 1} aria-label="Flytta framåt" onClick={() => move(c, COLS[ci + 1]!.id)}><ChevronRight size={16} /></Button>
                    </div>
                  </article>
                );
              })}
              {!list.length && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Inga avtal</p>}
            </section>
          );
        })}
      </div>
      <Dialog open={nyOpen} onOpenChange={setNyOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ny förfrågan – att skapa offert</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {fld("kund", "Kund *")}
            {fld("adress", "Adress")}
            {fld("kontakt", "Kontaktperson")}
            {fld("telefon", "Telefon", "tel")}
            {fld("epost", "E-post", "email")}
            {fld("kalla", "Källa (t.ex. Mejl, Telefon)")}
            <div className="space-y-1"><Label htmlFor="ff-saljare">Pinga säljare</Label>
              <select id="ff-saljare" value={saljare} onChange={(e) => setSaljare(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground">
                <option value="">Ingen</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select></div>
          </div>
          <div className="space-y-1"><Label htmlFor="ff-besk">Vad gäller förfrågan?</Label>
            <Textarea id="ff-besk" rows={6} placeholder="Klistra in mejlet eller skriv antal portar, typer, önskemål…" value={ny.beskrivning} onChange={(e) => setNy({ ...ny, beskrivning: e.target.value })} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNyOpen(false)}>Avbryt</Button>
            <Button disabled={!ny.kund.trim()} onClick={spara}>Spara förfrågan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

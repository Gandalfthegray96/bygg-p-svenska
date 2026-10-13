import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculate, fmtKr, normalizeAvtal } from "@/lib/kalkyl";
import { setVersionStatus, type CustomerFolder, type Status, type Version } from "@/lib/avtal-store";

const COLS: { id: Status; label: string; cls: string }[] = [
  { id: "utkast", label: "Utkast / förfrågan", cls: "bg-muted-foreground" },
  { id: "skickat", label: "Skickat", cls: "bg-info" },
  { id: "forhandling", label: "Uppföljning / förhandling", cls: "bg-primary" },
  { id: "signerat", label: "Signerat", cls: "bg-success" },
  { id: "forlorat", label: "Förlorat / avböjt", cls: "bg-destructive" },
];
const DAY = 86_400_000;
/** Skickade avtal utan händelse på så här många dagar flaggas för uppföljning. */
export const FOLLOW_UP_DAYS = 14;

type Card = { id: string; name: string; v: Version; status: Status; perYear: number; avtalNr: string; ansvarig: string; days: number };

export function Pipeline({ store, onOpen, onChanged }: { store: Record<string, CustomerFolder>; onOpen: (id: string, name: string, v: Version) => void; onChanged: () => void }) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);

  const cards = useMemo<Card[]>(() => Object.values(store).filter((f) => f.versions.length).map((f) => {
    const v = f.versions.at(-1)!;
    const a = normalizeAvtal(v.data);
    const last = [v.savedAt, ...(f.log ?? []).map((l) => l.at)].sort().at(-1)!;
    return { id: f.id, name: f.name, v, status: v.status ?? "utkast", perYear: calculate(a).perYear, avtalNr: a.customer.avtalNr ?? "", ansvarig: a.customer.varRef ?? "", days: Math.floor((Date.now() - new Date(last).getTime()) / DAY) };
  }), [store]);

  const move = (c: Card, s: Status) => { setVersionStatus(c.id, c.v.version, s); onChanged(); };
  const stale = cards.filter((c) => c.status === "skickat" && c.days >= FOLLOW_UP_DAYS).length;

  return (
    <div className="space-y-3">
      <div className="ds-panel flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[15px] font-semibold text-foreground">Säljpipeline</h2>
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
              <p className="px-1 text-xs tabular-nums text-muted-foreground">{fmtKr(list.reduce((t, c) => t + c.perYear, 0))} / år</p>
              {list.map((c) => {
                const flag = c.status === "skickat" && c.days >= FOLLOW_UP_DAYS;
                return (
                  <article key={c.id} draggable onDragStart={() => setDrag(c.id)}
                    className={`space-y-1.5 rounded-lg border bg-card p-2.5 shadow-sm ${flag ? "border-destructive" : "border-border"}`}>
                    <button onClick={() => onOpen(c.id, c.name, c.v)} className="block w-full text-left">
                      <span className="block truncate text-sm font-semibold text-foreground">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{c.avtalNr ? `Nr ${c.avtalNr}` : "Inget avtalsnr"}{c.ansvarig ? ` · ${c.ansvarig}` : ""}</span>
                    </button>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold tabular-nums text-foreground">{fmtKr(c.perYear)}/år</span>
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
    </div>
  );
}

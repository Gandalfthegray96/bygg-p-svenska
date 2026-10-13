import { useMemo, useState } from "react";
import { Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculate, fmtKr, normalizeAvtal } from "@/lib/kalkyl";
import { angraUppsagning, deleteAvtal, sagUpp, UPPSAGD_ORSAKER, type CustomerFolder } from "@/lib/avtal-store";

export function SagUppDialog({ folder, onClose, onDone }: { folder: CustomerFolder; onClose: () => void; onDone: () => void }) {
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [orsak, setOrsak] = useState(UPPSAGD_ORSAKER[0]);
  const [notering, setNotering] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onClick={onClose}>
      <div className="ds-panel w-full max-w-md space-y-3 bg-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-foreground">Säg upp avtal – {folder.name}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Stäng"><X size={16} /></Button>
        </div>
        <label className="block space-y-1 text-sm"><span className="text-muted-foreground">Uppsägningsdatum</span>
          <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className="ds-input" /></label>
        <label className="block space-y-1 text-sm"><span className="text-muted-foreground">Orsak</span>
          <select value={orsak} onChange={(e) => setOrsak(e.target.value)} className="ds-input">
            {UPPSAGD_ORSAKER.map((o) => <option key={o}>{o}</option>)}
          </select></label>
        <label className="block space-y-1 text-sm"><span className="text-muted-foreground">Notering (valfri)</span>
          <textarea value={notering} onChange={(e) => setNotering(e.target.value)} rows={3} className="ds-input" /></label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Avbryt</Button>
          <Button variant="destructive" disabled={!datum} onClick={() => { sagUpp(folder.id, { datum, orsak, notering: notering.trim() }); onDone(); }}>Säg upp</Button>
        </div>
      </div>
    </div>
  );
}

export function UppsagdaLista({ store, onChanged }: { store: Record<string, CustomerFolder>; onChanged: () => void }) {
  const list = useMemo(() => Object.values(store).filter((f) => f.uppsagd && f.versions.length)
    .sort((a, b) => b.uppsagd!.datum.localeCompare(a.uppsagd!.datum)), [store]);
  const perOrsak = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of list) m[f.uppsagd!.orsak] = (m[f.uppsagd!.orsak] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [list]);
  const year = String(new Date().getFullYear());
  const iAr = list.filter((f) => f.uppsagd!.datum.startsWith(year)).length;
  const lostValue = list.reduce((t, f) => t + calculate(normalizeAvtal(f.versions.at(-1)!.data)).perYear, 0);

  return (
    <section className="ds-panel space-y-3">
      <h2 className="font-display text-[15px] font-semibold text-foreground">Uppsagda avtal</h2>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Totalt uppsagda</p><p className="text-xl font-bold tabular-nums">{list.length}</p></div>
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Uppsagda {year}</p><p className="text-xl font-bold tabular-nums">{iAr}</p></div>
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Förlorat värde</p><p className="truncate text-xl font-bold tabular-nums">{fmtKr(lostValue)}<span className="text-xs font-normal">/år</span></p></div>
      </div>
      {perOrsak.length > 0 && <div className="flex flex-wrap gap-1.5">{perOrsak.map(([o, n]) => <span key={o} className="ds-badge bg-muted text-muted-foreground">{o}: {n}</span>)}</div>}
      {list.length === 0 && <p className="text-sm text-muted-foreground">Inga uppsagda avtal.</p>}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {list.map((f) => {
          const u = f.uppsagd!;
          const nr = f.versions.at(-1)!.data.customer?.avtalNr;
          return (
            <li key={f.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{f.name} {nr && <span className="text-xs text-muted-foreground">Nr {nr}</span>}</p>
                <p className="truncate text-xs text-muted-foreground">Uppsagt {u.datum} · {u.orsak}{u.notering ? ` · ${u.notering}` : ""} · av {u.by}</p>
              </div>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => { angraUppsagning(f.id); onChanged(); }}><Undo2 size={14} />Ångra</Button>
                <Button variant="outline" size="sm" className="gap-1 text-destructive" onClick={() => {
                  if (confirm(`Ta bort ${f.name} permanent från appen? Avtalet finns kvar i SharePoint.`)) { deleteAvtal(f.id); onChanged(); }
                }}><Trash2 size={14} />Ta bort</Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

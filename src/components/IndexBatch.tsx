import { useMemo, useState } from "react";
import { TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculate, fmtKr, indexera, normalizeAvtal } from "@/lib/kalkyl";
import { indexeraBatch, type CustomerFolder } from "@/lib/avtal-store";

/** Årlig indexreglering för alla signerade avtal på en gång, direkt från Hem. */
export function IndexBatch({ store, onClose, onDone }: { store: Record<string, CustomerFolder>; onClose: () => void; onDone: () => void }) {
  const [pct, setPct] = useState("2,5");
  const p = Number(pct.replace(",", ".")) || 0;
  const rows = useMemo(() => Object.values(store).flatMap((f) => {
    const v = f.versions.at(-1);
    if (!v || v.status !== "signerat") return [];
    const a = normalizeAvtal(v.data);
    return [{ id: f.id, name: f.name, nr: a.customer.avtalNr ?? "", a }];
  }).sort((x, y) => x.name.localeCompare(y.name, "sv")), [store]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const valda = rows.filter((r) => !off.has(r.id));
  const fore = valda.reduce((t, r) => t + calculate(r.a).perYear, 0);
  const efter = valda.reduce((t, r) => t + calculate(indexera(r.a, p)).perYear, 0);
  const toggle = (id: string) => setOff((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const kor = () => {
    if (!confirm(`Räkna upp ${valda.length} avtal med ${pct} %? En ny version sparas för varje avtal.`)) return;
    indexeraBatch(valda.map((r) => r.id), p, (a) => indexera(a, p));
    onDone();
  };

  return (
    <section className="ds-panel space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h2 className="font-display text-[15px] font-semibold text-foreground">Årlig indexreglering</h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Stäng"><X size={16} /></Button>
      </div>
      <p className="text-xs text-muted-foreground">Gäller signerade avtal. Timpeng, framkörning och utjämning räknas upp; status behålls och händelsen loggas.</p>
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Uppräkning (%)</span>
          <input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} onFocus={(e) => e.target.select()} className="ds-input" />
        </label>
        <p className="text-sm tabular-nums text-foreground">{fmtKr(fore)} → <span className="font-semibold">{fmtKr(efter)}</span><span className="text-xs text-muted-foreground"> / år</span></p>
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Inga signerade avtal ännu.</p> : (
        <ul className="max-h-72 divide-y divide-border overflow-auto rounded-lg border border-border">
          {rows.map((r) => (
            <li key={r.id}>
              <label className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-sm">
                <input type="checkbox" checked={!off.has(r.id)} onChange={() => toggle(r.id)} />
                <span className="min-w-0 truncate text-foreground">{r.name}{r.nr && <span className="text-muted-foreground"> · {r.nr}</span>}</span>
                <span className="tabular-nums text-xs text-muted-foreground">{fmtKr(calculate(r.a).perYear)} → {fmtKr(calculate(indexera(r.a, p)).perYear)}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <Button disabled={p === 0 || valda.length === 0} className="gap-1.5" onClick={kor}><TrendingUp size={16} />Räkna upp {valda.length} avtal</Button>
    </section>
  );
}

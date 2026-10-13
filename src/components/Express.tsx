import { useMemo, useState } from "react";
import { Minus, Plus, Zap, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Avtal, calculate, emptyAvtal, fmtKr, fmtNum, newRow, OBJEKT_TYPER, YEARS } from "@/lib/kalkyl";

type Line = { qty: number; minutes: number; visits: number };
const DEFAULT_LINE: Line = { qty: 0, minutes: 30, visits: 2 };

/** Bygger ett avtal av expressvalen — samma calculate() som resten av appen. */
export function buildExpressAvtal(lines: Record<string, Line>, rabattTim: number, rabattMaterial: number, discount: number): Avtal {
  const base = emptyAvtal();
  const rows = OBJEKT_TYPER.filter((t) => (lines[t]?.qty ?? 0) > 0).map((t) => {
    const l = lines[t]!;
    return { ...newRow(), name: t, qty: l.qty, minutes: l.minutes, visits: l.visits };
  });
  return { ...base, rows: rows.length ? rows : base.rows, rabattTim, rabattMaterial, discount };
}

function Stepper({ value, onChange, min = 0, max = 999, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="flex items-center gap-1" aria-label={label}>
      <Button variant="ghost" type="button" aria-label={`Minska ${label}`} onClick={() => onChange(Math.max(min, value - 1))}
        className="h-9 w-9 rounded-lg border border-border bg-card p-0 text-foreground hover:bg-muted"><Minus size={16} /></Button>
      <span className="w-9 text-center font-display text-base font-semibold tabular-nums text-foreground">{value}</span>
      <Button variant="ghost" type="button" aria-label={`Öka ${label}`} onClick={() => onChange(Math.min(max, value + 1))}
        className="h-9 w-9 rounded-lg border border-border bg-card p-0 text-foreground hover:bg-muted"><Plus size={16} /></Button>
    </div>
  );
}

function Pct({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input type="number" inputMode="decimal" min={0} max={100} value={Number.isFinite(value) ? value : ""}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Math.min(100, Math.max(0, Number(e.target.value))))}
        onBlur={() => { if (!Number.isFinite(value)) onChange(0); }}
        className="ds-input" />
    </label>
  );
}

export function Express({ onOpenFull }: { onOpenFull: (a: Avtal) => void }) {
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [rabattTim, setRabattTim] = useState(10);
  const [rabattMaterial, setRabattMaterial] = useState(10);
  const [discount, setDiscount] = useState(0);
  const get = (t: string) => lines[t] ?? DEFAULT_LINE;
  const set = (t: string, patch: Partial<Line>) => setLines((p) => ({ ...p, [t]: { ...(p[t] ?? DEFAULT_LINE), ...patch } }));

  const avtal = useMemo(() => buildExpressAvtal(lines, rabattTim || 0, rabattMaterial || 0, discount || 0), [lines, rabattTim, rabattMaterial, discount]);
  const hasRows = OBJEKT_TYPER.some((t) => get(t).qty > 0);
  const k = useMemo(() => (hasRows ? calculate(avtal) : null), [avtal, hasRows]);
  const firstVisit = k?.visits[0]?.perVisit ?? 0;

  return (
    <div className="space-y-4">
      <section className="ds-panel">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Zap size={18} /></span>
          <div>
            <h2 className="font-display text-[15px] font-semibold text-foreground">Expresskalkyl</h2>
            <p className="text-xs text-muted-foreground">Klicka i antal objekt — priset räknas direkt med samma regler som avtalet.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {OBJEKT_TYPER.map((t) => {
              const l = get(t);
              return (
                <li key={t} className={`px-3 py-2.5 ${l.qty > 0 ? "bg-accent/40" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">{t}</span>
                    <Stepper label={`antal ${t}`} value={l.qty} onChange={(n) => set(t, { qty: n })} />
                  </div>
                  <div className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground ${l.qty > 0 ? "" : "opacity-60"}`}>
                    <span className="flex items-center gap-1.5">Tid/st (min)
                      <Button variant="ghost" type="button" aria-label={`Minska tid ${t}`} onClick={() => set(t, { minutes: Math.max(0, l.minutes - 5) })}
                        className="h-8 w-8 rounded-lg border border-border bg-card p-0 text-foreground hover:bg-muted"><Minus size={14} /></Button>
                      <input type="number" inputMode="numeric" min={0} aria-label={`Tid per styck ${t}`} value={Number.isFinite(l.minutes) ? l.minutes : ""} onFocus={(e) => e.target.select()}
                        onChange={(e) => set(t, { minutes: e.target.value === "" ? NaN : Math.max(0, Number(e.target.value)) })}
                        onBlur={() => { if (!Number.isFinite(l.minutes)) set(t, { minutes: 0 }); }}
                        className="ds-input h-8 w-16 py-1 text-center text-sm" />
                      <Button variant="ghost" type="button" aria-label={`Öka tid ${t}`} onClick={() => set(t, { minutes: (l.minutes || 0) + 5 })}
                        className="h-8 w-8 rounded-lg border border-border bg-card p-0 text-foreground hover:bg-muted"><Plus size={14} /></Button>
                    </span>
                    <span className="flex items-center gap-1.5">Besök/år <Stepper label={`besök per år ${t}`} min={1} max={12} value={l.visits} onChange={(n) => set(t, { visits: n })} /></span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="space-y-3 lg:sticky lg:top-40 lg:self-start">
            <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)]">
              <dl className="space-y-3 tabular-nums">
                <div><dt className="text-xs font-semibold text-muted-foreground">Pris per år</dt><dd className="font-display text-3xl font-bold text-info">{fmtKr(k?.perYear ?? 0)}</dd></div>
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                  <div><dt className="text-xs font-semibold text-muted-foreground">{(k?.visits.length ?? 0) > 1 ? "Besök 1" : "Per besök"}</dt><dd className="font-display text-lg font-semibold text-foreground">{fmtKr(firstVisit)}</dd></div>
                  <div><dt className="text-xs font-semibold text-muted-foreground">Totalt {YEARS} år</dt><dd className="font-display text-lg font-semibold text-foreground">{fmtKr(k?.total5 ?? 0)}</dd></div>
                  <div><dt className="text-xs font-semibold text-muted-foreground">Objekt</dt><dd className="text-sm font-semibold text-foreground">{fmtNum(k?.totalQty ?? 0)} st</dd></div>
                  <div><dt className="text-xs font-semibold text-muted-foreground">Servicetid</dt><dd className="text-sm font-semibold text-foreground">{fmtNum((k?.totalMinutes ?? 0) / 60)} h</dd></div>
                </div>
              </dl>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="grid grid-cols-2 gap-2">
                <Pct label="Rabatt timpris (%)" value={rabattTim} onChange={setRabattTim} />
                <Pct label="Rabatt material (%)" value={rabattMaterial} onChange={setRabattMaterial} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Gäller prislistan för löpande arbeten och material.</p>
              <div className="mt-3"><Pct label="Rabatt på avtalets arbete (%)" value={discount} onChange={setDiscount} /></div>
            </div>
            <Button variant="ghost" type="button" disabled={!hasRows} onClick={() => onOpenFull(avtal)}
              className="h-11 w-full gap-2 bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Öppna som fullt avtal <ArrowRight size={16} />
            </Button>
            <Button variant="ghost" type="button" onClick={() => { setLines({}); setRabattTim(10); setRabattMaterial(10); setDiscount(0); }}
              className="h-9 w-full gap-2 text-sm text-muted-foreground hover:text-foreground"><RotateCcw size={14} />Rensa</Button>
          </div>
        </div>
      </section>
    </div>
  );
}

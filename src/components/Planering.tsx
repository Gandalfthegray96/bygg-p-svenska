import { useMemo, useRef, useState } from "react";
import { Check, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculate, normalizeAvtal } from "@/lib/kalkyl";
import { setPlanering, type CustomerFolder, type Filial, type Planering as Plan } from "@/lib/avtal-store";
import { FILIALER, KVARTAL_VECKOR, foreslaVeckor, kvartal } from "@/lib/planering";

type Row = { f: CustomerFolder; kund: string; adress: string; avtalNr: string; visits: { hours: number; trips: number; objekt: number }[]; plan: Plan };
type Filter = "alla" | Filial | "ingen";

function rows(store: Record<string, CustomerFolder>): Row[] {
  const out: Row[] = [];
  for (const f of Object.values(store)) {
    const v = f.versions.at(-1);
    if (!v || v.status !== "signerat" || f.uppsagd) continue;
    const a = normalizeAvtal(v.data);
    const c = calculate(a);
    const visits = c.visits.map((x) => ({ hours: x.hours, trips: x.trips, objekt: a.rows.filter((r) => r.visits >= x.k).reduce((s, r) => s + r.qty, 0) }));
    const besok = visits.map((_, i) => f.planering?.besok[i] ?? { vecka: null });
    out.push({ f, kund: a.customer.bestallare || f.name, adress: a.customer.anlAdress, avtalNr: a.customer.avtalNr, visits, plan: { filial: f.planering?.filial, besok } });
  }
  return out.sort((x, y) => x.kund.localeCompare(y.kund, "sv"));
}

const fmtH = (h: number) => h.toLocaleString("sv-SE", { maximumFractionDigits: 1 });

export function Planering({ store, onChanged }: { store: Record<string, CustomerFolder>; onChanged: () => void }) {
  const [filter, setFilter] = useState<Filter>("alla");
  const [q, setQ] = useState<1 | 2 | 3 | 4>(() => kvartal(Math.min(52, Math.ceil(((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 864e5 + 1) / 7))));
  const all = useMemo(() => rows(store), [store]);
  const shown = all.filter((r) => filter === "alla" || (filter === "ingen" ? !r.plan.filial : r.plan.filial === filter));
  const save = (r: Row, p: Plan) => { setPlanering(r.f.id, p); onChanged(); };
  const done = (r: Row) => !!r.plan.filial && r.plan.besok.every((b) => !!b.vecka);
  // Avtal som var oplanerade när fliken öppnades stannar kvar i listan medan man fyller i dem.
  const pending = useRef<Set<string> | null>(null);
  pending.current ??= new Set(all.filter((r) => !done(r)).map((r) => r.f.id));
  for (const r of all) if (!done(r)) pending.current.add(r.f.id);
  const attPlanera = shown.filter((r) => pending.current!.has(r.f.id));
  const kvar = attPlanera.filter((r) => !done(r)).length;

  const weeks = KVARTAL_VECKOR[q].map((w) => {
    const items = shown.flatMap((r) => r.plan.besok.map((b, i) => ({ r, b, i })).filter((x) => x.b.vecka === w));
    return { w, items, hours: items.reduce((s, x) => s + (x.r.visits[x.i]?.hours ?? 0), 0) };
  });
  const qHours = weeks.reduce((s, w) => s + w.hours, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {([["alla", "Alla filialer"], ...FILIALER.map((f) => [f.id, f.label]), ["ingen", "Ingen filial"]] as [Filter, string][]).map(([id, label]) => (
          <Button key={id} size="sm" variant={filter === id ? "default" : "outline"} onClick={() => setFilter(id)}>{label}</Button>
        ))}
      </div>

      <section className="ds-panel space-y-3 bg-card">
        <h2 className="font-display text-base font-semibold text-foreground">Att planera <span className="text-muted-foreground">({kvar} kvar)</span></h2>
        {kvar === 0 && <p className="text-sm text-muted-foreground">Alla signerade avtal har filial och vecka.</p>}
        <div className="divide-y divide-border">
          {attPlanera.map((r) => <PlanRow key={r.f.id} r={r} onSave={(p) => save(r, p)} />)}
        </div>
      </section>

      <section className="ds-panel space-y-3 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
            {([1, 2, 3, 4] as const).map((k) => (
              <Button key={k} size="sm" variant={q === k ? "default" : "ghost"} onClick={() => setQ(k)}>Q{k}</Button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">Q{q}: {fmtH(qHours)} h planerat</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {weeks.map(({ w, items, hours }) => (
            <div key={w} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground">Vecka {w}</span>
                <span className="text-muted-foreground">{items.length} besök · {fmtH(hours)} h</span>
              </div>
              {items.length === 0 ? <p className="text-xs text-muted-foreground">Inget planerat</p> : (
                <ul className="space-y-1.5">
                  {items.map(({ r, b, i }) => (
                    <li key={r.f.id + i} className="flex items-start gap-2 text-sm">
                      <button type="button" aria-label={b.klar ? "Markera ej klar" : "Markera ärende skapat"}
                        onClick={() => save(r, { ...r.plan, besok: r.plan.besok.map((x, j) => (j === i ? { ...x, klar: !x.klar } : x)) })}
                        className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border ${b.klar ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                        {b.klar && <Check size={12} />}
                      </button>
                      <div className="min-w-0">
                        <div className={`truncate font-medium ${b.klar ? "text-muted-foreground line-through" : "text-foreground"}`}>{r.kund}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.adress && <><MapPin size={11} className="mr-0.5 inline" />{r.adress} · </>}
                          Besök {i + 1} · {r.visits[i]?.objekt ?? 0} obj · {fmtH(r.visits[i]?.hours ?? 0)} h · {r.visits[i]?.trips ?? 0} framk.
                          {filter === "alla" && r.plan.filial && ` · ${FILIALER.find((x) => x.id === r.plan.filial)?.label}`}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Bocka i när ärendet är skapat i Mobigo.</p>
      </section>

      <section className="ds-panel space-y-3 bg-card">
        <h2 className="font-display text-base font-semibold text-foreground">Alla signerade avtal <span className="text-muted-foreground">({shown.length})</span></h2>
        <div className="divide-y divide-border">
          {shown.map((r) => <PlanRow key={r.f.id} r={r} onSave={(p) => save(r, p)} />)}
        </div>
      </section>
    </div>
  );
}

function PlanRow({ r, onSave }: { r: Row; onSave: (p: Plan) => void }) {
  const p = r.plan;
  const setVecka = (i: number, v: string) => onSave({ ...p, besok: p.besok.map((b, j) => (j === i ? { ...b, vecka: v ? Number(v) : null } : b)) });
  return (
    <div className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{r.kund}</div>
        <div className="truncate text-xs text-muted-foreground">{[r.avtalNr, r.adress].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filial" value={p.filial ?? ""} onChange={(e) => onSave({ ...p, filial: (e.target.value || undefined) as Filial | undefined })} className="ds-input h-9 w-32">
          <option value="">Filial…</option>
          {FILIALER.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        {p.besok.map((b, i) => (
          <select key={i} aria-label={`Vecka besök ${i + 1}`} value={b.vecka ?? ""} onChange={(e) => setVecka(i, e.target.value)} className="ds-input h-9 w-36">
            <option value="">Besök {i + 1}: vecka…</option>
            {Array.from({ length: 52 }, (_, k) => k + 1).map((w) => <option key={w} value={w}>Besök {i + 1}: v{w} (Q{kvartal(w)})</option>)}
          </select>
        ))}
        {!!p.filial && p.besok.every((b) => !!b.vecka) && <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-foreground"><Check size={14} />Planerad</span>}
        {p.besok.some((b) => !b.vecka) && p.besok.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => { const first = p.besok[0]?.vecka ?? 4; const f = foreslaVeckor(p.besok.length, first); onSave({ ...p, besok: p.besok.map((b, i) => ({ ...b, vecka: b.vecka ?? f[i] ?? null })) }); }}>Föreslå veckor</Button>
        )}
      </div>
    </div>
  );
}

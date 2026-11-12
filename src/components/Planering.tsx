import { useMemo, useRef, useState } from "react";
import { Check, MapPin, Search, TrendingUp, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { fmtPct, getSettings } from "@/lib/foretag-settings";
import { Button } from "@/components/ui/button";
import { type Avtal, calculate, fmtKr, indexera, lonsamhet, normalizeAvtal } from "@/lib/kalkyl";
import { indexeraBatch, loadStore, setPlanering, type CustomerFolder, type Filial, type Planering as Plan } from "@/lib/avtal-store";
import { FILIALER, KVARTAL_VECKOR, filialFor, foreslaVeckor, gissaFilial, kvartal } from "@/lib/planering";

type Row = { f: CustomerFolder; kund: string; adress: string; avtalNr: string; a: Avtal; visits: { hours: number; trips: number; objekt: number; lista: string; pris: number }[]; plan: Plan };
type Filter = "alla" | Filial;

function rows(store: Record<string, CustomerFolder>): Row[] {
  const out: Row[] = [];
  for (const f of Object.values(store)) {
    const v = f.versions.at(-1);
    if (!v || v.status !== "signerat" || f.uppsagd) continue;
    const a = normalizeAvtal(v.data);
    const c = calculate(a);
    const visits = c.visits.map((x) => ({ hours: x.hours, trips: x.trips, objekt: a.rows.filter((r) => r.visits >= x.k).reduce((s, r) => s + r.qty, 0), lista: objektLista(a, x.k), pris: x.perVisit }));
    const besok = visits.map((_, i) => f.planering?.besok[i] ?? { vecka: null });
    out.push({ f, a, kund: a.customer.bestallare || f.name, adress: a.customer.anlAdress, avtalNr: a.customer.avtalNr, visits, plan: { filial: filialFor(f.planering?.filial, a.customer.anlAdress), besok } });
  }
  return out.sort((x, y) => x.kund.localeCompare(y.kund, "sv"));
}

/** Objekt i besök k, t.ex. "3 st Tsp el, 21 st Vikport". */
function objektLista(a: Avtal, k: number) {
  return a.rows.filter((r) => r.visits >= k).map((r) => `${/^\s*\d+\s*st\b/i.test(r.name || "") ? "" : `${r.qty} st `}${r.name || "objekt"}${r.make && !r.name.toLowerCase().includes(r.make.toLowerCase()) ? ` (${r.make})` : ""}`).join(", ");
}

const fmtH = (h: number) => h.toLocaleString("sv-SE", { maximumFractionDigits: 1 });

export function Planering({ store, onChanged }: { store: Record<string, CustomerFolder>; onChanged: () => void }) {
  const [filter, setFilter] = useState<Filter>("alla");
  const [q, setQ] = useState<1 | 2 | 3 | 4>(() => kvartal(Math.min(52, Math.ceil(((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 864e5 + 1) / 7))));
  const [vecka, setVecka] = useState<number | null>(null);
  const [popup, setPopup] = useState<string | null>(null);
  const all = useMemo(() => rows(store), [store]);
  const [sok, setSok] = useState("");
  const shown = all.filter((r) => filter === "alla" || r.plan.filial === filter);
  const s0 = sok.trim().toLowerCase();
  const traffar = s0 ? shown.filter((r) => [r.kund, r.adress, r.avtalNr].some((x) => (x ?? "").toLowerCase().includes(s0))).slice(0, 30) : [];
  // Läser alltid senast sparade planering så filial- och veckoval inte skriver över varandra.
  const save = (r: Row, update: (p: Plan) => Plan) => {
    const cur = loadStore()[r.f.id]?.planering;
    const base: Plan = { filial: cur?.filial ?? r.plan.filial, besok: r.visits.map((_, i) => cur?.besok[i] ?? { vecka: null }) };
    setPlanering(r.f.id, update(base));
    onChanged();
  };
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
  const sel = weeks.find((x) => x.w === vecka) ?? weeks.find((x) => x.items.length) ?? weeks[0];
  const popRow = popup ? all.find((r) => r.f.id === popup) : undefined;

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {([["alla", "Alla filialer"], ...FILIALER.map((f) => [f.id, f.label])] as [Filter, string][]).map(([id, label]) => (
          <Button key={id} size="sm" variant={filter === id ? "default" : "outline"} onClick={() => setFilter(id)}>{label}</Button>
        ))}
      </div>

      <section className="ds-panel space-y-3 bg-card">
        <label className="relative block min-w-0">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={sok} onChange={(e) => setSok(e.target.value)} placeholder="Sök kund, adress eller avtalsnr" className="ds-input pl-9 pr-9" aria-label="Sök avtal i planeringen" />
          {sok && <button type="button" onClick={() => setSok("")} aria-label="Rensa sökning" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"><X size={14} /></button>}
        </label>
        {s0 && (traffar.length === 0 ? <p className="text-sm text-muted-foreground">Inga avtal matchar sökningen.</p> : (
          <ul className="divide-y divide-border">
            {traffar.map((r) => (
              <li key={r.f.id} className="min-w-0 space-y-1.5 py-2 text-sm">
                <button type="button" onClick={() => setPopup(r.f.id)} className="break-words text-left font-medium text-foreground underline-offset-2 hover:underline">{r.kund}</button>
                <div className="break-words text-xs text-muted-foreground">{[r.avtalNr, r.adress, FILIALER.find((x) => x.id === r.plan.filial)?.label].filter(Boolean).join(" · ")}</div>
                <div className="flex flex-wrap gap-1.5">
                  {r.plan.besok.map((b, i) => b.vecka ? (
                    <Button key={i} size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setQ(kvartal(b.vecka!)); setVecka(b.vecka); }}>Besök {i + 1}: v{b.vecka} (Q{kvartal(b.vecka)})</Button>
                  ) : <span key={i} className="text-xs text-muted-foreground">Besök {i + 1}: ej planerat</span>)}
                </div>
              </li>
            ))}
          </ul>
        ))}
      </section>

      <section className="ds-panel space-y-3 bg-card">
        <h2 className="font-display text-base font-semibold text-foreground">Att planera <span className="text-muted-foreground">({kvar} kvar)</span></h2>
        {kvar === 0 && <p className="text-sm text-muted-foreground">Alla signerade avtal har filial och vecka.</p>}
        <div className="divide-y divide-border">
          {attPlanera.map((r) => <PlanRow key={r.f.id} r={r} onSave={(u) => save(r, u)} onShowQ={(k) => { setQ(k); setVecka(null); }} onOpen={() => setPopup(r.f.id)} />)}
        </div>
      </section>

      <section className="ds-panel space-y-3 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
            {([1, 2, 3, 4] as const).map((k) => (
              <Button key={k} size="sm" variant={q === k ? "default" : "ghost"} onClick={() => { setQ(k); setVecka(null); }}>Q{k}</Button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">Q{q}: {fmtH(qHours)} h planerat</span>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-13">
          {weeks.map(({ w, items, hours }) => {
            const klara = items.filter((x) => x.b.klar).length;
            const on = sel?.w === w;
            return (
              <button key={w} type="button" onClick={() => setVecka(w)} aria-pressed={on}
                className={`min-w-0 rounded-lg border p-2 text-left transition ${on ? "border-primary bg-primary/15" : "border-border hover:bg-muted"} ${items.length === 0 ? "opacity-60" : ""}`}>
                <div className="text-sm font-semibold text-foreground">v{w}</div>
                <div className="text-[11px] leading-tight text-muted-foreground">{items.length} besök</div>
                <div className="text-[11px] leading-tight text-muted-foreground">{fmtH(hours)} h</div>
                {items.length > 0 && <div className={`mt-1 text-[10px] font-medium ${klara === items.length ? "text-foreground" : "text-muted-foreground"}`}>{klara}/{items.length} i Mobigo</div>}
              </button>
            );
          })}
        </div>
        {sel && (
          <div className="min-w-0 rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">Vecka {sel.w}</span>
              <span className="text-muted-foreground">{sel.items.length} besök · {fmtH(sel.hours)} h</span>
            </div>
            {sel.items.length === 0 ? <p className="text-xs text-muted-foreground">Inget planerat</p> : (
              <ul className="space-y-1.5">
                {sel.items.map(({ r, b, i }) => {
                  const v = r.visits[i];
                  return (
                  <li key={r.f.id + i} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 border-b border-border/50 py-2 text-sm last:border-b-0">
                    <button type="button" aria-label={b.klar ? "Markera ej klar" : "Markera ärende skapat"}
                      onClick={() => save(r, (p) => ({ ...p, besok: p.besok.map((x, j) => (j === i ? { ...x, klar: !x.klar } : x)) }))}
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${b.klar ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                      {b.klar && <Check size={13} />}
                    </button>
                    <div className="min-w-0">
                      <button type="button" onClick={() => setPopup(r.f.id)} className={`break-words text-left font-medium underline-offset-2 hover:underline ${b.klar ? "text-muted-foreground line-through" : "text-foreground"}`}>{r.kund}</button>
                      <div className="mt-1 space-y-1 text-xs leading-relaxed text-muted-foreground">
                        {r.adress && <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-1"><MapPin size={12} className="mt-0.5 shrink-0" /><span className="break-words">{r.adress}</span></div>}
                        {v?.lista && <div className="break-words text-foreground">{v.lista}</div>}
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <span>Besök {i + 1}</span><span>{fmtH(v?.hours ?? 0)} h</span><span>{v?.trips ?? 0} framk.</span>
                          <span className="font-medium text-foreground">{fmtKr(v?.pris ?? 0)} exkl. moms</span>
                          {r.avtalNr && <span>{r.avtalNr}</span>}
                          {filter === "alla" && r.plan.filial && <span>{FILIALER.find((x) => x.id === r.plan.filial)?.label}</span>}
                          {b.klar && <span className="font-medium text-foreground">Ärende skapat i Mobigo</span>}
                        </div>
                        <label className="mt-1 inline-flex items-center gap-2">
                          <span>Flytta till</span>
                          <select aria-label={`Flytta besök ${i + 1} för ${r.kund}`} value={b.vecka ?? ""} onChange={(e) => { const nv = Number(e.target.value); if (!nv) return; save(r, (p) => ({ ...p, besok: p.besok.map((x, j) => (j === i ? { ...x, vecka: nv } : x)) })); setQ(kvartal(nv)); setVecka(nv); }} className="ds-input h-8 w-36 text-xs">
                            {Array.from({ length: 52 }, (_, k) => k + 1).map((w) => <option key={w} value={w}>v{w} (Q{kvartal(w)})</option>)}
                          </select>
                        </label>
                      </div>
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Bocka i när ärendet är skapat i Mobigo. Flytta ett besök med "Flytta till".</p>
      </section>

      <AvtalPopup r={popRow} onClose={() => setPopup(null)} onChanged={onChanged} />
    </div>
  );
}

function AvtalPopup({ r, onClose, onChanged }: { r: Row | undefined; onClose: () => void; onChanged: () => void }) {
  const [pct, setPct] = useState(() => fmtPct(getSettings().indexPct));
  const p = Number(pct.replace(",", ".")) || 0;
  const c = r ? calculate(r.a) : null;
  const l = r ? lonsamhet(r.a) : null;
  return (
    <Dialog open={!!r} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {r && c && l && <>
          <DialogHeader>
            <DialogTitle className="break-words">{r.kund}</DialogTitle>
            <DialogDescription className="break-words">{[r.avtalNr, r.adress, `v${r.f.versions.at(-1)?.version}`].filter(Boolean).join(" · ")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["Per år", fmtKr(c.perYear)], ["5 år", fmtKr(c.total5)], ["TB / år", fmtKr(l.tb)], ["TG", `${Math.round(l.tg)} %`]].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border p-2"><div className="text-xs text-muted-foreground">{k}</div><div className="font-semibold tabular-nums text-foreground">{v}</div></div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">Timpris {fmtKr(r.a.hourRate)} · framkörning {fmtKr(r.a.tripFee)}{r.a.discount ? ` · rabatt ${r.a.discount} % på arbete` : ""}</div>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-foreground">Objekt</h3>
            <ul className="divide-y divide-border text-sm">
              {r.a.rows.map((x) => <li key={x.id} className="flex justify-between gap-3 py-1.5"><span className="min-w-0 break-words">{x.qty} st {x.name || "objekt"}{x.make ? ` (${x.make})` : ""}</span><span className="shrink-0 text-muted-foreground">{x.visits} besök/år · {x.minutes} min</span></li>)}
            </ul>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-foreground">Per besök</h3>
            <ul className="divide-y divide-border text-sm">
              {c.visits.map((v, i) => <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 py-1.5"><span className="font-medium">Besök {i + 1}</span><span className="text-muted-foreground">{fmtH(v.hours)} h · {v.trips} framk. · arbete {fmtKr(v.laborNet)} · framk. {fmtKr(v.travel)}</span><span className="font-semibold tabular-nums">{fmtKr(v.perVisit)}</span></li>)}
            </ul>
          </div>
          <div className="space-y-2 rounded-lg border border-border p-3">
            <h3 className="text-sm font-semibold text-foreground">Årlig indexreglering</h3>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block w-28"><span className="mb-1 block text-xs text-muted-foreground">Uppräkning (%)</span>
                <input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} className="ds-input" /></label>
              <p className="text-sm tabular-nums">{fmtKr(c.perYear)} → <span className="font-semibold">{fmtKr(calculate(indexera(r.a, p)).perYear)}</span> / år</p>
            </div>
            <Button type="button" disabled={p === 0} className="gap-1.5" onClick={() => { indexeraBatch([r.f.id], p, (x) => indexera(x, p)); onChanged(); }}>
              <TrendingUp size={16} />Räkna upp {String(p).replace(".", ",")} % och spara ny version
            </Button>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  );
}

const fyllVeckor = (p: Plan): Plan => {
  const f = foreslaVeckor(p.besok.length, p.besok[0]?.vecka ?? 4);
  return { ...p, besok: p.besok.map((b, i) => ({ ...b, vecka: b.vecka ?? f[i] ?? null })) };
};

function PlanRow({ r, onSave, onShowQ, onOpen }: { r: Row; onSave: (u: (p: Plan) => Plan) => void; onShowQ: (q: 1 | 2 | 3 | 4) => void; onOpen: () => void }) {
  const p = r.plan;
  const [kvitto, setKvitto] = useState(false);
  const foresla = () => { onSave((x) => fyllVeckor({ ...x, filial: x.filial ?? gissaFilial(r.adress) })); setKvitto(true); };
  const setVecka = (i: number, v: string) => onSave((x) => ({ ...x, besok: x.besok.map((b, j) => (j === i ? { ...b, vecka: v ? Number(v) : null } : b)) }));
  const setFilial = (v: string) => onSave((x) => {
    const next = { ...x, filial: (v || undefined) as Filial | undefined };
    return next.filial && next.besok.every((b) => !b.vecka) ? fyllVeckor(next) : next;
  });
  return (
    <div className="flex min-w-0 flex-col gap-2 py-3 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onOpen} className="break-words text-left text-sm font-medium text-foreground underline-offset-2 hover:underline">{r.kund}</button>
        <div className="break-words text-xs leading-relaxed text-muted-foreground">{[r.avtalNr, r.adress].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <select aria-label="Filial" value={p.filial ?? ""} onChange={(e) => setFilial(e.target.value)} className="ds-input h-9 w-32">
          <option value="">Filial…</option>
          {FILIALER.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        {p.besok.map((b, i) => (
          <select key={i} aria-label={`Vecka besök ${i + 1}`} value={b.vecka ?? ""} onChange={(e) => setVecka(i, e.target.value)} className="ds-input h-9 w-36">
            <option value="">Besök {i + 1}: vecka…</option>
            {Array.from({ length: 52 }, (_, k) => k + 1).map((w) => <option key={w} value={w}>Besök {i + 1}: v{w} (Q{kvartal(w)})</option>)}
          </select>
        ))}
        {!!p.filial && p.besok.every((b) => !!b.vecka) && <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground"><Check size={14} />Planerad</span>}
        {p.besok.some((b) => !b.vecka) && p.besok.length > 0 && (
          <Button size="sm" variant="outline" onClick={foresla}>Föreslå veckor</Button>
        )}
      </div>
      {kvitto && p.besok.some((b) => b.vecka) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground lg:basis-full">
          <Check size={14} className="text-foreground" />
          <span>Sparat: {p.besok.map((b, i) => b.vecka ? `Besök ${i + 1} i v${b.vecka} (Q${kvartal(b.vecka)})` : null).filter(Boolean).join(" · ")}</span>
          {p.besok[0]?.vecka && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onShowQ(kvartal(p.besok[0]!.vecka!))}>Visa Q{kvartal(p.besok[0].vecka)}</Button>}
        </div>
      )}
    </div>
  );
}

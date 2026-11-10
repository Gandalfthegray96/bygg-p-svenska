import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown, ArrowUpRight, CheckCircle2, Clock, Coins, FilePen, FolderUp, Plus, Ban, TrendingUp, Search, UserRound, Wrench, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KundKort } from "./KundKort";
import { IndexBatch } from "./IndexBatch";
import { ImportPdf } from "./ImportPdf";
import { SagUppDialog, UppsagdaLista } from "./Uppsagt";
import { calculate, fmtKr, lonsamhet, normalizeAvtal } from "@/lib/kalkyl";
import { FOLLOW_UP_DAYS, canSee, daysSinceActivity, isStale } from "@/lib/uppfoljning";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getSettings } from "@/lib/foretag-settings";
import { setVersionStatus, type CustomerFolder, type Status, type Version } from "@/lib/avtal-store";

type Row = { stale: boolean; days: number; id: string; name: string; v: Version; status: Status; perYear: number; lon: ReturnType<typeof lonsamhet>; signedAt: string; avtalNr: string; ansvarig: string; adress: string };
export type Filter = "alla" | Status | "forsenad";
type Sort = "datum" | "varde" | "kund";
const METRIC = { v: "Värde", tb: "Täckningsbidrag", h: "Timmar" } as const;

const STATUS_LABEL: Record<Status, string> = { offert: "Att skapa offert", utkast: "Utkast", skickat: "Väntar på svar", forhandling: "Förhandling", signerat: "Signerat", forlorat: "Förlorat" };
const STATUS_CLS: Record<Status, string> = {
  offert: "bg-accent text-accent-foreground",
  signerat: "bg-success/15 text-success",
  skickat: "bg-info/15 text-info",
  utkast: "bg-muted text-muted-foreground",
  forhandling: "bg-primary/20 text-foreground",
  forlorat: "bg-destructive/15 text-destructive",
};

function Stat({ label, value, sub, icon, active, onClick }: { label: string; value: string; sub: string; icon: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <Button variant="ghost" onClick={onClick} aria-pressed={active}
      className={`ds-overview-stat relative h-auto min-w-0 flex-col items-start gap-2 whitespace-normal rounded-lg border p-4 text-left sm:p-5 ${active ? "border-ring/30 bg-accent" : "border-border bg-card"}`}>
      <span className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground">{icon}<span className="min-w-0 flex-1">{label}</span><ArrowUpRight size={14} /></span>
      <span className="font-display text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{value}</span>
      <span className="text-xs font-normal text-muted-foreground">{sub}</span>
    </Button>
  );
}

export function Hem({ store, onOpen, onNew, onChanged, me = { role: null, name: "" }, view = "lista", initialFilter = "alla", onGoList }: { view?: "oversikt" | "lista"; initialFilter?: Filter; onGoList?: (f: Filter) => void; me?: { role: string | null; name: string }; store: Record<string, CustomerFolder>; onOpen: (id: string, name: string, v: Version) => void; onNew: () => void; onChanged?: () => void }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [sort, setSort] = useState<Sort>("datum");
  const [ansv, setAnsv] = useState("alla");
  const [kund, setKund] = useState<string | null>(null);
  const [index, setIndex] = useState(false);
  const [imp, setImp] = useState(false);
  const [upp, setUpp] = useState<string | null>(null);
  const [visaUpp, setVisaUpp] = useState(false);
  const [metric, setMetric] = useState<"v" | "tb" | "h">("v");
  const nUpp = Object.values(store).filter((f) => f.uppsagd && f.versions.length).length;

  const rows = useMemo<Row[]>(() =>
    Object.values(store).filter((f) => f.versions.length && !f.uppsagd).map((f) => {
      const v = f.versions.at(-1)!;
      const a = normalizeAvtal(v.data);
      const ans = a.customer.varRef ?? ""; return { stale: isStale(f) && canSee(ans, me), days: daysSinceActivity(f), id: f.id, name: f.name, v, status: v.status ?? "utkast", perYear: calculate(a).perYear, lon: lonsamhet(a, getSettings()), signedAt: [...(f.log ?? [])].reverse().find((l) => l.kind === "signerat")?.at ?? v.savedAt, avtalNr: a.customer.avtalNr ?? "", ansvarig: a.customer.varRef ?? "", adress: a.customer.anlAdress ?? "" };
    }), [store, me]);

  const stat = (s: Status) => { const l = rows.filter((x) => x.status === s); return { n: l.length, sum: l.reduce((t, x) => t + x.perYear, 0) }; };
  const sent = stat("skickat"), signed = stat("signerat"), draft = stat("utkast");

  const ansvariga = useMemo(() => [...new Set(rows.map((r) => r.ansvarig.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "sv")), [rows]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const l = rows.filter((r) => (filter === "alla" || (filter === "forsenad" ? r.stale : r.status === filter)) && (ansv === "alla" || r.ansvarig.trim() === ansv) &&
      (!s || [r.name, r.avtalNr, r.ansvarig, r.adress].some((x) => x.toLowerCase().includes(s))));
    return l.sort((a, b) => sort === "varde" ? b.perYear - a.perYear : sort === "kund" ? a.name.localeCompare(b.name, "sv") : b.v.savedAt.localeCompare(a.v.savedAt));
  }, [rows, q, filter, sort, ansv]);

  const toggle = (f: Filter) => view === "oversikt" ? onGoList?.(f) : setFilter((cur) => (cur === f ? "alla" : f));

  const nStale = rows.filter((r) => r.stale).length;
  const act = rows.filter((r) => r.status === "signerat");
  const sum = (f: (l: Row["lon"]) => number) => act.reduce((t, r) => t + f(r.lon), 0);
  const kpi = { arr: sum((l) => l.intakt), tb: sum((l) => l.tb), h: sum((l) => l.hours), trips: sum((l) => l.trips), obj: sum((l) => l.objekt) };
  const tg = kpi.arr > 0 ? (kpi.tb / kpi.arr) * 100 : 0;
  const DAY = 86_400_000;
  const fornyelse = act.map((r) => ({ r, slut: new Date(new Date(r.signedAt).getTime() + 5 * 365 * DAY) }))
    .filter((x) => x.slut.getTime() - Date.now() < 180 * DAY).sort((a, b) => +a.slut - +b.slut);
  const forsenade = rows.filter((r) => r.stale).sort((a, b) => b.days - a.days);
  const graf = (() => {
    const now = new Date(); const out: { m: string; v: number; tb: number; h: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).toISOString();
      const l = act.filter((r) => r.signedAt < end);
      const add = (f: (x: Row["lon"]) => number) => l.reduce((t, r) => t + f(r.lon), 0);
      out.push({ m: new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleDateString("sv-SE", { month: "short" }), v: Math.round(add((x) => x.intakt)), tb: Math.round(add((x) => x.tb)), h: Math.round(add((x) => x.hours) * 10) / 10 });
    }
    return out;
  })();
  const g0 = graf[0]?.[metric] ?? 0, g1 = graf.at(-1)?.[metric] ?? 0;
  const trend = g0 > 0 ? ((g1 - g0) / g0) * 100 : null;
  const offerter = rows.filter((r) => r.status === "offert" || r.status === "utkast").sort((a, b) => b.v.savedAt.localeCompare(a.v.savedAt));
  const todo = forsenade.length + offerter.length + fornyelse.length;
  const cnt = (f: (r: Row) => boolean) => rows.filter(f).length;
  const donut: { key: Filter; label: string; n: number; fill: string }[] = [
    { key: "signerat", label: "Aktiva", n: cnt((r) => r.status === "signerat"), fill: "var(--color-sidebar)" },
    { key: "skickat", label: "Väntar på svar", n: cnt((r) => r.status === "skickat" || r.status === "forhandling"), fill: "var(--color-primary)" },
    { key: "utkast", label: "Utkast / offert", n: cnt((r) => r.status === "utkast" || r.status === "offert"), fill: "var(--color-muted-foreground)" },
    { key: "forlorat", label: "Förlorade", n: cnt((r) => r.status === "forlorat"), fill: "var(--color-destructive)" },
  ];
  const pct = (n: number) => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(n) + " %";
  return (
    <div className="space-y-4">
      {nStale > 0 && (
        <button onClick={() => toggle("forsenad")} aria-pressed={filter === "forsenad"}
          className="flex w-full items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-left text-sm font-semibold text-destructive hover:bg-destructive/15">
          <AlertTriangle size={18} className="shrink-0" />
          <span className="flex-1">{nStale} avtal har väntat på svar i över {FOLLOW_UP_DAYS} dagar</span>
          <span className="text-xs font-medium underline">{filter === "forsenad" ? "Visa alla" : "Visa dessa"}</span>
        </button>
      )}
      {view === "oversikt" && <>
      <div className="ds-overview-finance">
        <div className="ds-overview-value">
          <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-sidebar-foreground">Årligt avtalsvärde (aktiva)</span><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><TrendingUp size={19} /></span></div>
          <p className="ds-overview-amount mt-3 font-display font-semibold tabular-nums">{fmtKr(Math.round(kpi.arr))}</p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-sidebar-border pt-3 text-xs text-sidebar-foreground"><span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-primary" />{act.length} aktiva avtal</span><span>{fmtKr(Math.round(kpi.arr * 5))} på 5 år</span></div>
        </div>
        <div className="ds-overview-metrics">
          <div className="ds-overview-metric"><span className="ds-overview-metric-label"><Coins size={16} />Täckningsbidrag / år</span><span className="ds-overview-metric-value text-success">{fmtKr(Math.round(kpi.tb))}</span><span className="text-xs text-muted-foreground">Täckningsgrad {pct(tg)}</span></div>
          <div className="ds-overview-metric"><span className="ds-overview-metric-label"><Wrench size={16} />Årlig servicevolym</span><span className="ds-overview-metric-value">{new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(kpi.h)} h</span><span className="text-xs text-muted-foreground">{kpi.trips} framkörningar</span></div>
          <div className="ds-overview-metric ds-overview-objects"><span className="ds-overview-metric-label"><Building2 size={16} />Objekt i aktiva avtal</span><span className="ds-overview-metric-value">{kpi.obj} st</span><span className="text-xs text-muted-foreground">Snitt {fmtKr(Math.round(act.length ? kpi.arr / act.length : 0))} / avtal</span></div>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="ds-panel min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="font-display text-base font-semibold text-foreground">Avtalsutveckling</h3><p className="text-xs text-muted-foreground">Aktiva avtal, senaste 12 månaderna{trend !== null && <span className={trend >= 0 ? " text-success" : " text-destructive"}> · {trend >= 0 ? "+" : ""}{pct(trend)} på 12 mån</span>}</p></div>
            <div className="flex rounded-lg border border-border p-0.5" role="tablist">
              {(["v", "tb", "h"] as const).map((k) => (
                <Button key={k} size="sm" variant={metric === k ? "default" : "ghost"} className="h-7 px-2.5 text-xs" onClick={() => setMetric(k)} aria-pressed={metric === k}>{METRIC[k]}</Button>
              ))}
            </div>
          </div>
          <div className="h-56 lg:h-72 2xl:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={graf} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs><linearGradient id="arrFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-sidebar)" stopOpacity={0.45} /><stop offset="100%" stopColor="var(--color-sidebar)" stopOpacity={0.02} /></linearGradient></defs>
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis width={44} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(n: number) => n >= 1000 ? Math.round(n / 1000) + "k" : String(n)} />
                <Tooltip formatter={(n: number) => [metric === "h" ? n + " h" : fmtKr(n), METRIC[metric]]} contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-card)", fontSize: 12 }} />
                <Area type="monotone" dataKey={metric} stroke="var(--color-sidebar)" strokeWidth={2} fill="url(#arrFill)" dot={{ r: 2.5, fill: "var(--color-sidebar)" }} activeDot={{ r: 5, fill: "var(--color-primary)", stroke: "var(--color-sidebar)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="ds-panel min-w-0">
          <h3 className="mb-3 font-display text-base font-semibold text-foreground">Avtalsstatus</h3>
          <div className="flex items-center gap-4">
            <div className="relative h-36 w-36 shrink-0 2xl:h-52 2xl:w-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={donut.filter((d) => d.n > 0).length ? donut.filter((d) => d.n > 0) : [{ key: "tom", label: "", n: 1, fill: "var(--color-muted)" }]} dataKey="n" innerRadius="70%" outerRadius="95%" paddingAngle={2} stroke="none">
                  {(donut.filter((d) => d.n > 0).length ? donut.filter((d) => d.n > 0) : [{ key: "tom", fill: "var(--color-muted)" }]).map((d) => <Cell key={d.key} fill={d.fill} />)}
                </Pie></PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-2xl font-semibold tabular-nums">{rows.length}</span><span className="text-[11px] text-muted-foreground">avtal</span></div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1">
              {donut.map((d) => (
                <li key={d.key}><button onClick={() => toggle(d.key)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.fill }} /><span className="min-w-0 flex-1 truncate">{d.label}</span><span className="tabular-nums font-medium">{d.n}</span>
                </button></li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <section className="ds-panel min-w-0 max-w-4xl">
        <h3 className="mb-2 flex items-center gap-2 font-display text-base font-semibold text-foreground">Att göra{todo > 0 && <span className="rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold text-destructive-foreground">{todo}</span>}</h3>
        {todo === 0 && <p className="text-sm text-muted-foreground">Inget som behöver göras just nu.</p>}
        <ul className="grid max-h-72 gap-1 overflow-y-auto max-w-4xl">
          {forsenade.map((r) => (
            <li key={"f" + r.id}><button onClick={() => onOpen(r.id, r.name, r.v)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted">
              <Clock size={15} className="shrink-0 text-destructive" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name}</span><span className="text-xs text-muted-foreground">Uppföljning · {r.days} dagar utan svar</span></span>
            </button></li>
          ))}
          {offerter.map((r) => (
            <li key={"o" + r.id}><button onClick={() => onOpen(r.id, r.name, r.v)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted">
              <FilePen size={15} className="shrink-0 text-foreground" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name}</span><span className="text-xs text-muted-foreground">{r.status === "offert" ? "Offert att skapa" : "Utkast att slutföra"}</span></span>
            </button></li>
          ))}
          {fornyelse.map(({ r, slut }) => (
            <li key={"r" + r.id}><button onClick={() => onOpen(r.id, r.name, r.v)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted">
              <RefreshCw size={15} className="shrink-0 text-info" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name}</span><span className="text-xs text-muted-foreground">{slut.getTime() < Date.now() ? "Förnyelse · 5 år passerat" : "Förnyelse · " + slut.toLocaleDateString("sv-SE")}</span></span>
            </button></li>
          ))}
        </ul>
      </section>

      </>}
      {view === "lista" && <>
      {imp && <ImportPdf store={store} onClose={() => setImp(false)} onDone={() => { setImp(false); onChanged?.(); }} />}
      {index && <IndexBatch store={Object.fromEntries(Object.entries(store).filter(([, f]) => !f.uppsagd))} onClose={() => setIndex(false)} onDone={() => { setIndex(false); onChanged?.(); }} />}

      {visaUpp && <UppsagdaLista store={store} onChanged={() => onChanged?.()} />}
      {upp && store[upp] && <SagUppDialog folder={store[upp]} onClose={() => setUpp(null)} onDone={() => { setUpp(null); onChanged?.(); }} />}

      <section className="ds-panel space-y-3">
        <div className="flex items-center justify-end gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto]">
          <h2 className="hidden sm:block truncate font-display text-[15px] font-semibold text-foreground">Avtalsöversikt</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImp((x) => !x)} className="gap-1.5" aria-label="Importera"><FolderUp size={16} /><span className="hidden sm:inline">Importera</span></Button>
            <Button variant={visaUpp ? "default" : "outline"} onClick={() => setVisaUpp((x) => !x)} className="gap-1.5" aria-label="Uppsagda avtal"><Ban size={16} /><span className="hidden sm:inline">Uppsagda ({nUpp})</span></Button>
            <Button variant="outline" onClick={() => setIndex((x) => !x)} className="gap-1.5" aria-label="Indexreglering"><TrendingUp size={16} /><span className="hidden sm:inline">Indexreglering</span></Button>
            <Button onClick={onNew} className="hidden gap-1.5 sm:inline-flex"><Plus size={16} />Nytt avtal</Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <label className="relative block min-w-0">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök kund, avtalsnr, ansvarig, adress" className="ds-input pl-9" aria-label="Sök avtal" />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <select value={ansv} onChange={(e) => setAnsv(e.target.value)} className="ds-input sm:w-40" aria-label="Filtrera ansvarig">
              <option value="alla">Alla säljare</option>
              {ansvariga.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="ds-input sm:w-40" aria-label="Filtrera status">
              <option value="alla">Alla statusar</option>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <label className="relative col-span-2 block sm:col-span-1">
              <ArrowUpDown size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="ds-input pl-8 sm:w-40" aria-label="Sortera">
                <option value="datum">Senast ändrad</option>
                <option value="varde">Högst värde</option>
                <option value="kund">Kund A–Ö</option>
              </select>
            </label>
          </div>
        </div>

        {rows.length === 0 && <p className="text-sm text-muted-foreground">Inga sparade avtal ännu.</p>}
        {rows.length > 0 && shown.length === 0 && <p className="text-sm text-muted-foreground">Inga avtal matchar sökningen.</p>}

        <ul className="divide-y divide-border rounded-lg border border-border">
          {shown.map((x) => (
            <li key={x.id} className="flex flex-col gap-2 p-3 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto_auto_auto] sm:items-center sm:gap-x-3">
              <div className="flex min-w-0 items-start justify-between gap-3 sm:contents">
                <div className="min-w-0 flex-1 text-left">
                  <p className="break-words font-medium text-foreground sm:truncate">{x.name} <span className="text-xs text-muted-foreground">v{x.v.version}</span></p>
                  <p className="break-words text-xs text-muted-foreground sm:truncate">
                    {x.avtalNr ? `Nr ${x.avtalNr}` : "Inget avtalsnr"} · {new Date(x.v.savedAt).toLocaleDateString("sv-SE")}
                  </p>
                </div>
                <span className="hidden shrink-0 text-right text-xs tabular-nums sm:order-3 sm:block" title="Täckningsbidrag per år (internt)"><span className="font-semibold text-success">{fmtKr(Math.round(x.lon.tb))}</span><span className="block text-muted-foreground">TG {pct(x.lon.tg)}</span></span>
                <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-foreground sm:order-3">{fmtKr(x.perYear)}<span className="text-xs font-normal text-muted-foreground">/år</span></span>
              </div>
              <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground sm:order-2">{x.ansvarig && <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar text-[10px] font-bold text-sidebar-foreground">{x.ansvarig.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>}<span className="min-w-0 truncate">{x.stale && <span className="mr-2 inline-flex items-center gap-1 font-semibold text-destructive"><AlertTriangle size={12} />{x.days} dagar sedan skickat</span>}{x.ansvarig ? `Ansvarig: ${x.ansvarig}` : "Ingen ansvarig"}</span></span>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:contents">
                <select value={x.status} aria-label="Status"
                  onChange={(e) => { setVersionStatus(x.id, x.v.version, e.target.value as Status); onChanged?.(); }}
                  className={`ds-badge outline-none sm:order-4 ${STATUS_CLS[x.status]}`}>
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <div className="flex gap-1.5 sm:order-5 sm:justify-self-end">
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => setKund(x.name)}><UserRound size={14} />Kundkort</Button>
                  <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={() => setUpp(x.id)}><Ban size={14} />Säg upp</Button>
                  <Button variant="outline" size="sm" onClick={() => onOpen(x.id, x.name, x.v)}>Öppna</Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
      </>}
      {kund && <KundKort name={kund} store={store} onClose={() => setKund(null)} onChanged={() => onChanged?.()}
        onOpen={(id, n, v) => { setKund(null); onOpen(id, n, v); }} />}
    </div>
  );
}

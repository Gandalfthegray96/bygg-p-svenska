import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown, ArrowUpRight, CheckCircle2, Clock, Coins, FilePen, FolderUp, Plus, Ban, TrendingUp, Search, UserRound, Wrench, Building2, Handshake, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { KundKort } from "./KundKort";
import { IndexBatch } from "./IndexBatch";
import { ImportPdf } from "./ImportPdf";
import { SagUppDialog, UppsagdaLista } from "./Uppsagt";
import { calculate, fmtKr, lonsamhet, normalizeAvtal } from "@/lib/kalkyl";
import { FOLLOW_UP_DAYS, canSee, daysSinceActivity, isStale } from "@/lib/uppfoljning";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getSettings } from "@/lib/foretag-settings";
import { FILIALER, filialFor } from "@/lib/planering";
import { setVersionStatus, type CustomerFolder, type Status, type Version } from "@/lib/avtal-store";

type Row = { stale: boolean; days: number; id: string; name: string; v: Version; status: Status; perYear: number; lon: ReturnType<typeof lonsamhet>; signedAt: string; avtalNr: string; ansvarig: string; adress: string; filial: "GBG" | "BORAS" };
export type Filter = "alla" | Status | "forsenad";
const filLabel = (f: "GBG" | "BORAS") => FILIALER.find((x) => x.id === f)?.label ?? f;
/** Färdigt avtal = har både avtalsnummer och pris; döljs i arbetskön tills "Se alla avtal". */
const komplett = (r: { avtalNr: string; perYear: number }) => !!r.avtalNr.trim() && r.perYear > 0;
type Sort = "datum" | "varde" | "kund" | "filial";
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
  const [fil, setFil] = useState<"alla" | "GBG" | "BORAS">("alla");
  const [kund, setKund] = useState<string | null>(null);
  const [index, setIndex] = useState(false);
  const [imp, setImp] = useState(false);
  const [upp, setUpp] = useState<string | null>(null);
  const [visaUpp, setVisaUpp] = useState(false);
  const [allaAvtal, setAllaAvtal] = useState(false);
  const [metric, setMetric] = useState<"v" | "tb" | "h">("v");
  const [period, setPeriod] = useState<number>(12);
  const nUpp = Object.values(store).filter((f) => f.uppsagd && f.versions.length).length;

  const rows = useMemo<Row[]>(() =>
    Object.values(store).filter((f) => f.versions.length && !f.uppsagd).map((f) => {
      const v = f.versions.at(-1)!;
      const a = normalizeAvtal(v.data);
      const ans = a.customer.varRef ?? ""; return { stale: isStale(f) && canSee(ans, me), days: daysSinceActivity(f), id: f.id, name: f.name, v, status: v.status ?? "utkast", perYear: calculate(a).perYear, lon: lonsamhet(a, getSettings()), signedAt: (/^\d{4}-\d{2}-\d{2}/.test(a.customer.datum ?? "") && a.customer.datum < (f.versions[0]?.savedAt ?? v.savedAt).slice(0, 10) ? a.customer.datum : undefined) ?? [...(f.log ?? [])].reverse().find((l) => l.kind === "signerat")?.at ?? v.savedAt, avtalNr: a.customer.avtalNr ?? "", ansvarig: a.customer.varRef ?? "", adress: a.customer.anlAdress ?? "", filial: filialFor(f.planering?.filial, a.customer.anlAdress ?? "") };
    }), [store, me]);

  const nKomplett = rows.filter(komplett).length;
  const stat = (s: Status) => { const l = rows.filter((x) => x.status === s); return { n: l.length, sum: l.reduce((t, x) => t + x.perYear, 0) }; };
  const sent = stat("skickat"), signed = stat("signerat"), draft = stat("utkast");

  const ansvariga = useMemo(() => [...new Set(rows.map((r) => r.ansvarig.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "sv")), [rows]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const l = rows.filter((r) => (allaAvtal || !komplett(r)) && (filter === "alla" || (filter === "forsenad" ? r.stale : r.status === filter)) && (ansv === "alla" || r.ansvarig.trim() === ansv) && (fil === "alla" || r.filial === fil) &&
      (!s || [r.name, r.avtalNr, r.ansvarig, r.adress, filLabel(r.filial)].some((x) => x.toLowerCase().includes(s))));
    return l.sort((a, b) => sort === "filial" ? filLabel(a.filial).localeCompare(filLabel(b.filial), "sv") || a.name.localeCompare(b.name, "sv") : sort === "varde" ? b.perYear - a.perYear : sort === "kund" ? a.name.localeCompare(b.name, "sv") : b.v.savedAt.localeCompare(a.v.savedAt));
  }, [rows, q, filter, sort, ansv, fil, allaAvtal]);

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
  const first = act.reduce((m, r) => (r.signedAt < m ? r.signedAt : m), new Date().toISOString());
  const allMonths = (() => { const d = new Date(first), n = new Date(); return Math.max(6, (n.getFullYear() - d.getFullYear()) * 12 + n.getMonth() - d.getMonth() + 1); })();
  const nMonths = period === 0 ? Math.min(allMonths, 120) : period;
  const graf = (() => {
    const now = new Date(); const out: { m: string; v: number; tb: number; h: number }[] = [];
    for (let i = nMonths - 1; i >= 0; i--) {
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).toISOString();
      const l = act.filter((r) => r.signedAt < end);
      const add = (f: (x: Row["lon"]) => number) => l.reduce((t, r) => t + f(r.lon), 0);
      out.push({ m: new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleDateString("sv-SE", { month: "short", ...(nMonths > 12 ? { year: "2-digit" } : {}) }), v: Math.round(add((x) => x.intakt)), tb: Math.round(add((x) => x.tb)), h: Math.round(add((x) => x.hours) * 10) / 10 });
    }
    return out;
  })();
  const g0 = graf[0]?.[metric] ?? 0, g1 = graf.at(-1)?.[metric] ?? 0;
  const trend = g0 > 0 ? ((g1 - g0) / g0) * 100 : null;
  const offerter = rows.filter((r) => r.status === "offert" || r.status === "utkast").sort((a, b) => b.v.savedAt.localeCompare(a.v.savedAt));
  const snart = rows.filter((r) => r.status === "skickat" && !r.stale && r.days >= 7 && canSee(r.ansvarig, me)).sort((a, b) => b.days - a.days);
  const forhandling = rows.filter((r) => r.status === "forhandling").sort((a, b) => b.days - a.days);
  const utanNr = act.filter((r) => !r.avtalNr.trim());
  const todo = forsenade.length + snart.length + forhandling.length + offerter.length + fornyelse.length + utanNr.length;
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
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-3">
        <section className="ds-panel min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="font-display text-base font-semibold text-foreground">Avtalsutveckling</h3><p className="text-xs text-muted-foreground">Aktiva avtal, {period === 0 ? "hela perioden" : `senaste ${period} månaderna`}{trend !== null && <span className={trend >= 0 ? " text-success" : " text-destructive"}> · {trend >= 0 ? "+" : ""}{pct(trend)} under perioden</span>}</p></div>
            <div className="flex flex-wrap gap-2"><div className="flex rounded-lg border border-border p-0.5" aria-label="Tidsperiod">{([6, 12, 24, 0] as const).map((p) => <Button key={p} size="sm" variant={period === p ? "secondary" : "ghost"} className="h-7 px-2.5 text-xs" onClick={() => setPeriod(p)} aria-pressed={period === p}>{p === 0 ? "Allt" : p + " mån"}</Button>)}</div><div className="flex rounded-lg border border-border p-0.5" role="tablist">
              {(["v", "tb", "h"] as const).map((k) => (
                <Button key={k} size="sm" variant={metric === k ? "default" : "ghost"} className="h-7 px-2.5 text-xs" onClick={() => setMetric(k)} aria-pressed={metric === k}>{METRIC[k]}</Button>
              ))}
            </div></div>
          </div>
          <div className="h-56 lg:h-80 2xl:h-[26rem]">
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
        </div>
        <div className="min-w-0 space-y-3">
        <section className="ds-panel min-w-0">
          <h3 className="mb-3 font-display text-base font-semibold text-foreground">Avtalsstatus</h3>
          <div className="flex items-center gap-4">
            <div className="relative h-36 w-36 shrink-0 2xl:h-44 2xl:w-44">
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
      <section className="ds-panel min-w-0">
          <h3 className="mb-2 flex items-center gap-2 font-display text-base font-semibold text-foreground">Att göra{todo > 0 && <span className="rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold text-destructive-foreground">{todo}</span>}</h3>
          {todo === 0 && <p className="text-sm text-muted-foreground">Inget som behöver göras just nu.</p>}
          <ul className="grid max-h-80 gap-0.5 overflow-y-auto lg:max-h-none lg:overflow-visible">
            {forsenade.map((r) => (
              <li key={"f" + r.id}><button onClick={() => onOpen(r.id, r.name, r.v)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted">
                <Clock size={15} className="shrink-0 text-destructive" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name}</span><span className="text-xs text-muted-foreground">Uppföljning · {r.days} dagar utan svar</span></span>
              </button></li>
            ))}
            {snart.map((r) => (
              <li key={"s" + r.id}><button onClick={() => onOpen(r.id, r.name, r.v)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted">
                <Clock size={15} className="shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name}</span><span className="text-xs text-muted-foreground">Följ upp snart · skickat för {r.days} dagar sedan</span></span>
              </button></li>
            ))}
            {forhandling.map((r) => (
              <li key={"h" + r.id}><button onClick={() => onOpen(r.id, r.name, r.v)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted">
                <Handshake size={15} className="shrink-0 text-info" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name}</span><span className="text-xs text-muted-foreground">Förhandling pågår · {r.days} dagar sedan senaste aktivitet</span></span>
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
            {utanNr.map((r) => (
              <li key={"n" + r.id}><button onClick={() => onOpen(r.id, r.name, r.v)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted">
                <Hash size={15} className="shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name}</span><span className="text-xs text-muted-foreground">Signerat avtal saknar avtalsnummer</span></span>
              </button></li>
            ))}
          </ul>
        </section>
        </div>
      </div>

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
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Snabbfilter">
          {([["alla","Alla"],["signerat","Aktiva / Signerade"],["skickat","Väntar på svar"],["utkast","Utkast"],["forhandling","Förhandling"]] as [Filter,string][]).map(([f,l]) => (
            <button key={f} type="button" onClick={() => { setFilter(f); setVisaUpp(false); }} aria-pressed={filter===f && !visaUpp}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${filter===f && !visaUpp ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>
              {l} <span className="tabular-nums opacity-70">{f==="alla" ? rows.length : rows.filter((r) => r.status===f).length}</span>
            </button>
          ))}
          <button type="button" onClick={() => setVisaUpp((v) => !v)} aria-pressed={visaUpp}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${visaUpp ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>Uppsagda <span className="tabular-nums opacity-70">{nUpp}</span></button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={allaAvtal ? "outline" : "default"} onClick={() => setAllaAvtal(false)} aria-pressed={!allaAvtal}>Att komplettera ({rows.length - nKomplett} kvar)</Button>
          <Button size="sm" variant={allaAvtal ? "default" : "outline"} onClick={() => setAllaAvtal(true)} aria-pressed={allaAvtal}>Se alla avtal ({rows.length})</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
          <label className="relative block min-w-0">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök kund, avtalsnr, ansvarig, adress, filial" className="ds-input pl-9" aria-label="Sök avtal" />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <select value={fil} onChange={(e) => setFil(e.target.value as typeof fil)} className="ds-input sm:w-36" aria-label="Filtrera filial">
              <option value="alla">Alla filialer</option>
              {FILIALER.map((f) => <option key={f.id} value={f.id}>{f.label} ({rows.filter((r) => r.filial === f.id).length})</option>)}
            </select>
            <select value={ansv} onChange={(e) => setAnsv(e.target.value)} className="ds-input sm:w-40" aria-label="Filtrera ansvarig">
              <option value="alla">Alla säljare</option>
              {ansvariga.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="ds-input sm:w-40" aria-label="Filtrera status">
              <option value="alla">Alla statusar</option>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <label className="relative block">
              <ArrowUpDown size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="ds-input pl-8 sm:w-40" aria-label="Sortera">
                <option value="datum">Senast ändrad</option>
                <option value="varde">Högst värde</option>
                <option value="kund">Kund A–Ö</option>
                <option value="filial">Filial</option>
              </select>
            </label>
          </div>
        </div>

        {rows.length === 0 && <p className="text-sm text-muted-foreground">Inga sparade avtal ännu.</p>}
        {rows.length > 0 && shown.length === 0 && <p className="text-sm text-muted-foreground">Inga avtal matchar sökningen.</p>}

        <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_8rem_8rem_9rem_12.5rem] gap-x-4 border-b border-border px-4 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid">
          <span className="text-left">Kund</span><span className="text-left">Ansvarig</span><span className="text-right">Årsvärde</span><span className="text-right">TB / TG</span><span className="text-left">Status</span><span className="text-center">Åtgärder</span>
        </div>
        <ul className="divide-y divide-border lg:-mt-3">
          {shown.map((x) => (
            <li key={x.id} className="group rounded-lg border border-border p-4 transition-colors hover:bg-muted/40 max-lg:mb-2 lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_8rem_8rem_9rem_12.5rem] lg:items-center lg:gap-x-4 lg:rounded-none lg:border-0 lg:px-4 lg:py-3.5">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-[15px] font-semibold leading-tight text-foreground lg:truncate">{x.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <span className="font-medium tabular-nums text-foreground/70">{x.avtalNr || "Inget avtalsnr"}</span><span aria-hidden>·</span><span>v{x.v.version}</span><span aria-hidden>·</span><span className="tabular-nums">{new Date(x.v.savedAt).toLocaleDateString("sv-SE")}</span><span aria-hidden>·</span><span className="rounded border border-border px-1.5 text-[10px] font-medium text-foreground/70">{filLabel(x.filial)}</span>
                  </p>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium lg:hidden ${STATUS_CLS[x.status]}`}>{STATUS_LABEL[x.status]}</span>
              </div>
              <div className="mt-3 flex min-w-0 items-center gap-2 text-xs text-muted-foreground lg:mt-0">
                {x.ansvarig && <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sidebar text-[10px] font-bold text-sidebar-foreground">{x.ansvarig.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>}
                <span className="min-w-0 truncate">{x.ansvarig || "Ingen ansvarig"}</span>
                {x.stale && <span className="inline-flex shrink-0 items-center gap-1 font-medium text-destructive" title={`${x.days} dagar sedan skickat`}><AlertTriangle size={12} />{x.days} d</span>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 lg:contents">
                <div className="lg:text-right"><p className="text-[11px] text-muted-foreground lg:hidden">Årsvärde</p><p className="text-sm font-semibold tabular-nums text-foreground">{fmtKr(x.perYear)}</p></div>
                <div className="text-right lg:text-right" title="Täckningsbidrag per år (internt)"><p className="text-[11px] text-muted-foreground lg:hidden">TB / TG</p><p className="text-sm font-medium tabular-nums text-success">{fmtKr(Math.round(x.lon.tb))}</p><p className="text-[11px] tabular-nums text-muted-foreground">TG {pct(x.lon.tg)}</p></div>
              </div>
              <div className="mt-3 lg:mt-0">
                <select value={x.status} aria-label="Status"
                  onChange={(e) => { setVersionStatus(x.id, x.v.version, e.target.value as Status); onChanged?.(); }}
                  className={`w-full cursor-pointer rounded-md border-0 px-2 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-auto ${STATUS_CLS[x.status]}`}>
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div className="mt-3 flex items-center gap-1.5 lg:mt-0 lg:justify-center">
                <Button variant="ghost" size="sm" className="gap-1 max-lg:flex-1" onClick={() => setKund(x.name)}><UserRound size={14} />Kundkort</Button>
                <Button size="sm" className="max-lg:flex-1" onClick={() => onOpen(x.id, x.name, x.v)}>Öppna</Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Fler åtgärder"><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onSelect={() => setUpp(x.id)}><Ban size={14} />Säg upp avtal</DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onSelect={() => { if (window.confirm(`Radera avtalet permanent?\n\n${x.name}\n${x.adress || "Ingen adress"}\n${x.avtalNr ? `Avtalsnr ${x.avtalNr}` : "Inget avtalsnr"}\n\nAlla versioner och loggen tas bort för alla användare.`)) { deleteAgreement(x.id); onChanged?.(); } }}><Trash2 size={14} />Radera avtal</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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

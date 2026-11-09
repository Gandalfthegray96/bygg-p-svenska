import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown, CheckCircle2, Clock, Coins, FilePen, FolderUp, Plus, Ban, TrendingUp, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KundKort } from "./KundKort";
import { IndexBatch } from "./IndexBatch";
import { ImportPdf } from "./ImportPdf";
import { SagUppDialog, UppsagdaLista } from "./Uppsagt";
import { calculate, fmtKr, lonsamhet, normalizeAvtal } from "@/lib/kalkyl";
import { FOLLOW_UP_DAYS, canSee, daysSinceActivity, isStale } from "@/lib/uppfoljning";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getSettings } from "@/lib/foretag-settings";
import { setVersionStatus, type CustomerFolder, type Status, type Version } from "@/lib/avtal-store";

type Row = { stale: boolean; days: number; id: string; name: string; v: Version; status: Status; perYear: number; lon: ReturnType<typeof lonsamhet>; signedAt: string; avtalNr: string; ansvarig: string; adress: string };
export type Filter = "alla" | Status | "forsenad";
type Sort = "datum" | "varde" | "kund";

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
    <button onClick={onClick} aria-pressed={active}
      className={`flex min-w-0 flex-col gap-1 rounded-lg border p-4 text-left shadow-[var(--shadow-panel)] transition-colors sm:p-5 ${active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-ring/40"}`}>
      <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">{icon}<span className="truncate">{label}</span></span>
      <span className="truncate font-display text-2xl font-bold tabular-nums text-foreground sm:text-3xl">{value}</span>
      <span className="truncate text-xs text-muted-foreground">{sub}</span>
    </button>
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
    const now = new Date(); const out: { m: string; v: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).toISOString();
      const v = act.filter((r) => r.signedAt < end).reduce((t, r) => t + r.lon.intakt, 0);
      out.push({ m: new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleDateString("sv-SE", { month: "short" }), v: Math.round(v) });
    }
    return out;
  })();
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
      <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-sidebar p-5 text-sidebar-accent-foreground shadow-[var(--shadow-panel)]">
          <span className="text-xs font-semibold opacity-80">Årligt avtalsvärde (aktiva)</span>
          <span className="truncate font-display text-3xl font-bold tabular-nums">{fmtKr(Math.round(kpi.arr))}</span>
          <span className="text-xs opacity-80">{act.length} aktiva avtal · {fmtKr(Math.round(kpi.arr * 5))} på 5 år</span>
        </div>
        <div className="ds-panel flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Täckningsbidrag / år</span>
          <span className="truncate font-display text-3xl font-bold tabular-nums text-success">{fmtKr(Math.round(kpi.tb))}</span>
          <span className="text-xs text-muted-foreground">Täckningsgrad {pct(tg)}</span>
        </div>
        <div className="ds-panel flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Årlig servicevolym</span>
          <span className="truncate font-display text-3xl font-bold tabular-nums text-foreground">{new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(kpi.h)} h</span>
          <span className="text-xs text-muted-foreground">planerad servicetid · {kpi.trips} framkörningar</span>
        </div>
        <div className="ds-panel flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Objekt i aktiva avtal</span>
          <span className="truncate font-display text-3xl font-bold tabular-nums text-foreground">{kpi.obj} st</span>
          <span className="text-xs text-muted-foreground">Snitt {fmtKr(Math.round(act.length ? kpi.arr / act.length : 0))} / avtal</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Stat label="Aktiva avtal" icon={<CheckCircle2 size={14} className="text-success" />} value={String(signed.n)} sub={fmtKr(signed.sum) + " / år"} active={filter === "signerat"} onClick={() => toggle("signerat")} />
        <Stat label="Väntar på svar" icon={<Clock size={14} className="text-info" />} value={String(sent.n)} sub={fmtKr(sent.sum) + " / år"} active={filter === "skickat"} onClick={() => toggle("skickat")} />
        <Stat label="Utkast" icon={<FilePen size={14} />} value={String(draft.n)} sub={fmtKr(draft.sum) + " / år"} active={filter === "utkast"} onClick={() => toggle("utkast")} />
        <Stat label="Alla avtal" icon={<Coins size={14} className="text-success" />} value={String(rows.length)} sub={fmtKr(rows.reduce((t, x) => t + x.perYear, 0)) + " / år totalt"} active={filter === "alla"} onClick={() => (view === "oversikt" ? onGoList?.("alla") : setFilter("alla"))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="ds-panel min-w-0">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Avtalsstockens årsvärde, senaste 12 månaderna</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={graf} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs><linearGradient id="arrFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-sidebar)" stopOpacity={0.5} /><stop offset="100%" stopColor="var(--color-sidebar)" stopOpacity={0.03} /></linearGradient></defs>
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis width={44} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(n: number) => n >= 1000 ? Math.round(n / 1000) + "k" : String(n)} />
                <Tooltip formatter={(n: number) => [fmtKr(n), "Årsvärde"]} contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-card)", fontSize: 12 }} />
                <Area type="monotone" dataKey="v" stroke="var(--color-sidebar)" strokeWidth={2} fill="url(#arrFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="ds-panel min-w-0">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><AlertTriangle size={15} className="text-destructive" />Behöver uppmärksamhet</h3>
          {forsenade.length === 0 && fornyelse.length === 0 && <p className="text-sm text-muted-foreground">Inget som behöver göras just nu.</p>}
          <ul className="max-h-52 space-y-1.5 overflow-y-auto">
            {forsenade.map((r) => (
              <li key={"f" + r.id}><button onClick={() => onOpen(r.id, r.name, r.v)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
                <Clock size={14} className="shrink-0 text-destructive" /><span className="min-w-0 flex-1 truncate">{r.name}</span><span className="shrink-0 text-xs text-destructive">{r.days} dagar utan svar</span>
              </button></li>
            ))}
            {fornyelse.map(({ r, slut }) => (
              <li key={"r" + r.id}><button onClick={() => onOpen(r.id, r.name, r.v)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
                <RefreshCw size={14} className="shrink-0 text-info" /><span className="min-w-0 flex-1 truncate">{r.name}</span><span className="shrink-0 text-xs text-muted-foreground">{slut.getTime() < Date.now() ? "5 år passerat" : "Förnyas " + slut.toLocaleDateString("sv-SE")}</span>
              </button></li>
            ))}
          </ul>
        </section>
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

import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown, CheckCircle2, Clock, Coins, FilePen, FolderUp, Plus, TrendingUp, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KundKort } from "./KundKort";
import { IndexBatch } from "./IndexBatch";
import { ImportPdf } from "./ImportPdf";
import { calculate, fmtKr, normalizeAvtal } from "@/lib/kalkyl";
import { setVersionStatus, type CustomerFolder, type Status, type Version } from "@/lib/avtal-store";

type Row = { id: string; name: string; v: Version; status: Status; perYear: number; avtalNr: string; ansvarig: string; adress: string };
type Filter = "alla" | Status;
type Sort = "datum" | "varde" | "kund";

const STATUS_LABEL: Record<Status, string> = { utkast: "Utkast", skickat: "Väntar på svar", forhandling: "Förhandling", signerat: "Signerat", forlorat: "Förlorat" };
const STATUS_CLS: Record<Status, string> = {
  signerat: "bg-success/15 text-success",
  skickat: "bg-info/15 text-info",
  utkast: "bg-muted text-muted-foreground",
  forhandling: "bg-primary/20 text-foreground",
  forlorat: "bg-destructive/15 text-destructive",
};

function Stat({ label, value, sub, icon, active, onClick }: { label: string; value: string; sub: string; icon: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={`flex min-w-0 flex-col gap-1 rounded-xl border p-3 text-left transition-colors sm:p-4 ${active ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted"}`}>
      <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">{icon}<span className="truncate">{label}</span></span>
      <span className="truncate font-display text-2xl font-bold tabular-nums text-foreground sm:text-3xl">{value}</span>
      <span className="truncate text-xs text-muted-foreground">{sub}</span>
    </button>
  );
}

export function Hem({ store, onOpen, onNew, onChanged }: { store: Record<string, CustomerFolder>; onOpen: (id: string, name: string, v: Version) => void; onNew: () => void; onChanged?: () => void }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("alla");
  const [sort, setSort] = useState<Sort>("datum");
  const [ansv, setAnsv] = useState("alla");
  const [kund, setKund] = useState<string | null>(null);
  const [index, setIndex] = useState(false);
  const [imp, setImp] = useState(false);

  const rows = useMemo<Row[]>(() =>
    Object.values(store).filter((f) => f.versions.length).map((f) => {
      const v = f.versions.at(-1)!;
      const a = normalizeAvtal(v.data);
      return { id: f.id, name: f.name, v, status: v.status ?? "utkast", perYear: calculate(a).perYear, avtalNr: a.customer.avtalNr ?? "", ansvarig: a.customer.varRef ?? "", adress: a.customer.anlAdress ?? "" };
    }), [store]);

  const stat = (s: Status) => { const l = rows.filter((x) => x.status === s); return { n: l.length, sum: l.reduce((t, x) => t + x.perYear, 0) }; };
  const sent = stat("skickat"), signed = stat("signerat"), draft = stat("utkast");

  const ansvariga = useMemo(() => [...new Set(rows.map((r) => r.ansvarig.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "sv")), [rows]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const l = rows.filter((r) => (filter === "alla" || r.status === filter) && (ansv === "alla" || r.ansvarig.trim() === ansv) &&
      (!s || [r.name, r.avtalNr, r.ansvarig, r.adress].some((x) => x.toLowerCase().includes(s))));
    return l.sort((a, b) => sort === "varde" ? b.perYear - a.perYear : sort === "kund" ? a.name.localeCompare(b.name, "sv") : b.v.savedAt.localeCompare(a.v.savedAt));
  }, [rows, q, filter, sort, ansv]);

  const toggle = (f: Filter) => setFilter((cur) => (cur === f ? "alla" : f));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Stat label="Aktiva avtal" icon={<CheckCircle2 size={14} className="text-success" />} value={String(signed.n)} sub={fmtKr(signed.sum) + " / år"} active={filter === "signerat"} onClick={() => toggle("signerat")} />
        <Stat label="Väntar på svar" icon={<Clock size={14} className="text-info" />} value={String(sent.n)} sub={fmtKr(sent.sum) + " / år"} active={filter === "skickat"} onClick={() => toggle("skickat")} />
        <Stat label="Utkast" icon={<FilePen size={14} />} value={String(draft.n)} sub={fmtKr(draft.sum) + " / år"} active={filter === "utkast"} onClick={() => toggle("utkast")} />
        <Stat label="Årligt avtalsvärde" icon={<Coins size={14} className="text-success" />} value={fmtKr(signed.sum)} sub={`${rows.length} avtal totalt`} active={filter === "alla"} onClick={() => setFilter("alla")} />
      </div>

      {imp && <ImportPdf store={store} onClose={() => setImp(false)} onDone={() => { setImp(false); onChanged?.(); }} />}
      {index && <IndexBatch store={store} onClose={() => setIndex(false)} onDone={() => { setIndex(false); onChanged?.(); }} />}

      <section className="ds-panel space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <h2 className="truncate font-display text-[15px] font-semibold text-foreground">Avtalsöversikt</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImp((x) => !x)} className="gap-1.5" aria-label="Importera"><FolderUp size={16} /><span className="hidden sm:inline">Importera</span></Button>
            <Button variant="outline" onClick={() => setIndex((x) => !x)} className="gap-1.5" aria-label="Indexreglering"><TrendingUp size={16} /><span className="hidden sm:inline">Indexreglering</span></Button>
            <Button onClick={onNew} className="gap-1.5"><Plus size={16} />Nytt avtal</Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <label className="relative block min-w-0">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök kund, avtalsnr, ansvarig, adress" className="ds-input pl-9" aria-label="Sök avtal" />
          </label>
          <div className="grid grid-cols-3 gap-2 sm:contents">
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
              </select>
            </label>
          </div>
        </div>

        {rows.length === 0 && <p className="text-sm text-muted-foreground">Inga sparade avtal ännu.</p>}
        {rows.length > 0 && shown.length === 0 && <p className="text-sm text-muted-foreground">Inga avtal matchar sökningen.</p>}

        <ul className="divide-y divide-border rounded-lg border border-border">
          {shown.map((x) => (
            <li key={x.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto_auto]">
              <button onClick={() => onOpen(x.id, x.name, x.v)} className="min-w-0 text-left">
                <p className="truncate font-medium text-foreground">{x.name} <span className="text-xs text-muted-foreground">v{x.v.version}</span></p>
                <p className="truncate text-xs text-muted-foreground">
                  {x.avtalNr ? `Nr ${x.avtalNr}` : "Inget avtalsnr"} · {new Date(x.v.savedAt).toLocaleDateString("sv-SE")}
                </p>
              </button>
              <span className="order-3 col-span-2 truncate text-xs text-muted-foreground sm:order-none sm:col-span-1">{x.ansvarig ? `Ansvarig: ${x.ansvarig}` : "Ingen ansvarig"}</span>
              <span className="text-right text-sm font-semibold tabular-nums text-foreground">{fmtKr(x.perYear)}<span className="text-xs font-normal text-muted-foreground">/år</span></span>
              <select value={x.status} aria-label="Status"
                onChange={(e) => { setVersionStatus(x.id, x.v.version, e.target.value as Status); onChanged?.(); }}
                className={`ds-badge order-4 outline-none sm:order-none ${STATUS_CLS[x.status]}`}>
                {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <div className="order-5 flex gap-1.5 justify-self-end sm:order-none">
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => setKund(x.name)}><UserRound size={14} />Kundkort</Button>
                <Button variant="outline" size="sm" onClick={() => onOpen(x.id, x.name, x.v)}>Öppna</Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {kund && <KundKort name={kund} store={store} onClose={() => setKund(null)} onChanged={() => onChanged?.()}
        onOpen={(id, n, v) => { setKund(null); onOpen(id, n, v); }} />}
    </div>
  );
}

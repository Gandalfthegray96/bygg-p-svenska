import { useMemo } from "react";
import { CheckCircle2, Clock, FilePen, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculate, fmtKr, normalizeAvtal } from "@/lib/kalkyl";
import type { CustomerFolder, Status, Version } from "@/lib/avtal-store";

type Latest = { name: string; v: Version; status: Status; perYear: number };

export function Hem({ store, onOpen, onNew }: { store: Record<string, CustomerFolder>; onOpen: (name: string, v: Version) => void; onNew: () => void }) {
  const latest = useMemo<Latest[]>(() =>
    Object.values(store).filter((f) => f.versions.length).map((f) => {
      const v = f.versions.at(-1)!;
      return { name: f.name, v, status: v.status ?? "utkast", perYear: calculate(normalizeAvtal(v.data)).perYear };
    }).sort((a, b) => b.v.savedAt.localeCompare(a.v.savedAt)), [store]);

  const stat = (s: Status) => { const l = latest.filter((x) => x.status === s); return { n: l.length, sum: l.reduce((t, x) => t + x.perYear, 0) }; };
  const sent = stat("skickat"), signed = stat("signerat"), draft = stat("utkast");
  const rate = sent.n + signed.n ? Math.round((signed.n / (sent.n + signed.n)) * 100) : 0;

  const cards = [
    { label: "Väntar på svar", icon: Clock, ...sent, cls: "text-info" },
    { label: "Påskrivna", icon: CheckCircle2, ...signed, cls: "text-success" },
    { label: "Utkast", icon: FilePen, ...draft, cls: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="ds-panel">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><c.icon size={16} className={c.cls} />{c.label}</div>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums text-foreground">{c.n}</p>
            <p className="text-xs text-muted-foreground">{fmtKr(c.sum)} / år</p>
          </div>
        ))}
        <div className="ds-panel">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Send size={16} className="text-primary" />Andel påskrivna</div>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-foreground">{rate} %</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${rate}%` }} /></div>
        </div>
      </div>

      <section className="ds-panel">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[15px] font-semibold text-foreground">Senaste avtal</h2>
          <Button onClick={onNew} className="gap-1.5"><Plus size={16} />Nytt avtal</Button>
        </div>
        {latest.length === 0 && <p className="text-sm text-muted-foreground">Inga sparade avtal ännu.</p>}
        <ul className="space-y-1">
          {latest.slice(0, 8).map((x) => (
            <li key={x.name}>
              <button onClick={() => onOpen(x.name, x.v)} className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm hover:bg-muted">
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{x.name} <span className="text-muted-foreground">v{x.v.version}</span></span>
                <span className="tabular-nums text-muted-foreground">{fmtKr(x.perYear)}/år</span>
                <span className={`ds-badge ${x.status === "signerat" ? "bg-success/15 text-success" : x.status === "skickat" ? "bg-info/15 text-info" : "bg-muted text-muted-foreground"}`}>
                  {x.status === "signerat" ? "Signerat" : x.status === "skickat" ? "Skickat" : "Utkast"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

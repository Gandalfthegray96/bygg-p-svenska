import { useMemo, type ReactNode } from "react";
import { CheckCircle2, Clock, FilePen, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculate, fmtKr, normalizeAvtal } from "@/lib/kalkyl";
import type { CustomerFolder, Status, Version } from "@/lib/avtal-store";

type Latest = { name: string; v: Version; status: Status; perYear: number };

const C = 2 * Math.PI * 52;

function Ring({ pct, color, children }: { pct: number; color: string; children: ReactNode }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative mx-auto h-40 w-40">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="10" />
        <circle
          cx="60" cy="60" r="52" fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(p / 100) * C} ${C}`}
          style={{ transition: "stroke-dasharray 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function StatRing({ label, icon, pct, color, value, sub, pulse }: {
  label: string;
  icon: ReactNode;
  pct: number;
  color: string;
  value: string;
  sub: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">{icon}{label}</div>
      <Ring pct={pct} color={color}>
        <span className={`font-display text-4xl font-bold tabular-nums text-foreground ${pulse ? "" : ""}`}>{value}</span>
        <span className="mt-1 text-xs text-muted-foreground">{sub}</span>
      </Ring>
    </div>
  );
}

export function Hem({ store, onOpen, onNew }: { store: Record<string, CustomerFolder>; onOpen: (name: string, v: Version) => void; onNew: () => void }) {
  const latest = useMemo<Latest[]>(() =>
    Object.values(store).filter((f) => f.versions.length).map((f) => {
      const v = f.versions.at(-1)!;
      return { name: f.name, v, status: v.status ?? "utkast", perYear: calculate(normalizeAvtal(v.data)).perYear };
    }).sort((a, b) => b.v.savedAt.localeCompare(a.v.savedAt)), [store]);

  const stat = (s: Status) => { const l = latest.filter((x) => x.status === s); return { n: l.length, sum: l.reduce((t, x) => t + x.perYear, 0) }; };
  const sent = stat("skickat"), signed = stat("signerat"), draft = stat("utkast");
  const rate = sent.n + signed.n ? Math.round((signed.n / (sent.n + signed.n)) * 100) : 0;
  const signedShare = sent.n + signed.n ? Math.round((signed.n / (sent.n + signed.n)) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-6 py-4 lg:grid-cols-4">
        <StatRing
          label="Väntar på svar"
          icon={<Clock size={16} className="text-info" />}
          pct={100}
          color="var(--info)"
          value={String(sent.n)}
          sub={fmtKr(sent.sum) + " / år"}
        />
        <StatRing
          label="Påskrivna"
          icon={<CheckCircle2 size={16} className="text-success" />}
          pct={signedShare}
          color="var(--success)"
          value={String(signed.n)}
          sub={fmtKr(signed.sum) + " / år"}
        />
        <StatRing
          label="Utkast"
          icon={<FilePen size={16} className="text-primary" />}
          pct={100}
          color="var(--primary)"
          value={String(draft.n)}
          sub={fmtKr(draft.sum) + " / år"}
        />
        <StatRing
          label="Andel påskrivna"
          icon={<Send size={16} className="text-success" />}
          pct={rate}
          color="var(--success)"
          value={rate + " %"}
          sub="av skickade"
        />
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

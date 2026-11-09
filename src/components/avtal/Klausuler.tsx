import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Avtal } from "@/lib/kalkyl";
import { KLAUSULER } from "@/lib/klausuler";

/** Redigera originalavtalets rubriker för just detta avtal. */
export function Klausuler({ a, setA }: { a: Avtal; setA: (f: (p: Avtal) => Avtal) => void }) {
  const set = (id: string, v: string | undefined) => setA((p) => {
    const k = { ...p.klausuler };
    if (v === undefined) delete k[id]; else k[id] = v;
    return { ...p, klausuler: k };
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Ändra, lägg till eller ta bort text under avtalets rubriker. Ändringen gäller bara detta avtal och syns direkt under samma rubrik i avtalet.</p>
      {KLAUSULER.filter((k) => !k.fast).map((k) => {
        const v = a.klausuler?.[k.id];
        const changed = v !== undefined && v !== k.text;
        return (
          <div key={k.id} className="space-y-1.5 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`kl-${k.id}`} className="text-sm font-semibold text-foreground">{k.rubrik} <span className="font-normal text-muted-foreground">· sida {k.sida}</span></label>
              {changed && <Button variant="ghost" size="sm" onClick={() => set(k.id, undefined)}><RotateCcw size={14} />Återställ till standard</Button>}
            </div>
            <textarea id={`kl-${k.id}`} rows={Math.min(12, Math.max(3, Math.ceil((v ?? k.text).length / 70)))} className="ds-input w-full py-2 text-sm"
              value={v ?? k.text} onChange={(e) => set(k.id, e.target.value)} />
            {changed && <p className="text-xs text-primary-foreground/80"><span className="rounded bg-primary px-1.5 py-0.5 text-primary-foreground">Ändrad</span></p>}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">Tom rad = nytt stycke. Lämna fältet tomt för att ta bort texten under rubriken.</p>
    </div>
  );
}

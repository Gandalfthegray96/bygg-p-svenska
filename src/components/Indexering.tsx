import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Avtal, calculate, fmtKr, indexera } from "@/lib/kalkyl";

/** Årlig indexreglering per avtal: fast procent på hela avtalspriset. */
export function Indexering({ a, onApply }: { a: Avtal; onApply: (next: Avtal, pct: number) => void }) {
  const [pct, setPct] = useState("2,5");
  const p = Number(pct.replace(",", ".")) || 0;
  const now = calculate(a).perYear;
  const after = calculate(indexera(a, p)).perYear;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Räknar upp timpeng, framkörning och utjämning med en fast procent. Spara sedan som ny version.</p>
      <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Uppräkning (%)</span>
          <input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} onFocus={(e) => e.target.select()} className="ds-input" />
        </label>
        <p className="text-sm tabular-nums text-foreground">{fmtKr(now)} → <span className="font-semibold">{fmtKr(after)}</span><span className="text-xs text-muted-foreground"> / år</span></p>
      </div>
      <Button type="button" disabled={p === 0} className="gap-1.5" onClick={() => onApply(indexera(a, p), p)}>
        <TrendingUp size={16} />Räkna upp {String(p).replace(".", ",")} %
      </Button>
    </div>
  );
}

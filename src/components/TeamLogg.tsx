import { useMemo, useState } from "react";
import { loadStore } from "@/lib/avtal-store";
import { Tidslinje, type LogItem } from "./Aktivitet";

/** Samlad aktivitetslogg för hela teamet (alla avtalsposter), för admin. */
export function TeamLogg() {
  const [vem, setVem] = useState("");
  const [antal, setAntal] = useState(50);
  const all = useMemo<LogItem[]>(() => {
    const store = loadStore();
    return Object.entries(store).flatMap(([pid, f]) =>
      (f.log ?? []).map((x) => ({ ...x, postId: pid, avtal: f.name })));
  }, []);
  const personer = [...new Set(all.map((x) => x.by).filter(Boolean))].sort();
  const items = all.filter((x) => !vem || x.by === vem).sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-foreground">Teamets aktivitet</h3>
        <select className="ds-input w-full sm:w-56" value={vem} onChange={(e) => setVem(e.target.value)} aria-label="Filtrera på person">
          <option value="">Alla personer</option>
          {personer.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <Tidslinje items={items.slice(0, antal)} canWrite={false} />
      {items.length > antal && (
        <button className="text-sm font-medium text-info hover:underline" onClick={() => setAntal(antal + 50)}>Visa fler ({items.length - antal} kvar)</button>
      )}
    </div>
  );
}

import { FileText, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Avtal } from "@/lib/kalkyl";

type Slot = "cover" | "contract";
const LABEL: Record<Slot, string> = { cover: "Försättsblad", contract: "Huvudavtal (villkorssidor + signatursida)" };

/** Visar vilka avtalsblad som används. Uppladdning av egna PDF:er är borttagen – villkor ändras via textrutorna. */
export function AvtalVillkor({ a, setA }: { a: Avtal; setA: (f: (p: Avtal) => Avtal) => void }) {
  return (
    <div className="space-y-4">
      {(["contract", "cover"] as const).map((s) => (
        <div key={s} className="space-y-1.5 border-t border-border pt-3">
          <div className="text-sm font-medium">{LABEL[s]}</div>
          <div className="break-words text-sm text-muted-foreground"><FileText size={13} className="mr-1 inline" />{a.attachments?.[s]?.name ?? "Företagets standard"}</div>
          {a.attachments?.[s] && (
            <Button variant="ghost" size="sm" onClick={() => setA((p) => { const att = { ...p.attachments }; delete att[s]; return { ...p, attachments: att }; })}><RotateCcw size={15} />Använd standard</Button>
          )}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Ändra texten i avtalet under fliken Villkor. Kalkyl (Bilaga 1) och prislista läggs till automatiskt.</p>
    </div>
  );
}

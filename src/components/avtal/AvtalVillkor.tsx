import { useRef, useState } from "react";
import { FileText, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Avtal } from "@/lib/kalkyl";
import { uploadAgreementPdf } from "@/lib/bilagor";

type Slot = "cover" | "contract" | "price";
const LABEL: Record<Slot, string> = { cover: "Försättsblad", contract: "Huvudavtal (villkorssidor + signatursida)", price: "Bilaga 2 – Prislista" };

/** Visar vilka avtalsblad som används. Endast prislistan kan bytas mot egen PDF för detta avtal. */
export function AvtalVillkor({ a, setA }: { a: Avtal; setA: (f: (p: Avtal) => Avtal) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-4">
      <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Importera prislista" onChange={async (e) => {
        const file = e.target.files?.[0]; e.target.value = "";
        if (!file) return;
        setBusy(true); setMsg("");
        try {
          const f = await uploadAgreementPdf(file);
          setA((p) => ({ ...p, attachments: { ...p.attachments, price: f } }));
          setMsg("Prislistan gäller nu bara detta avtal. Spara avtalet för att behålla den.");
        } catch (err) { setMsg(err instanceof Error ? err.message : "Kunde inte importera PDF:en."); } finally { setBusy(false); }
      }} />
      {(["contract", "cover", "price"] as const).map((s) => (
        <div key={s} className="space-y-1.5 border-t border-border pt-3">
          <div className="text-sm font-medium">{LABEL[s]}</div>
          <div className="break-words text-sm text-muted-foreground"><FileText size={13} className="mr-1 inline" />{a.attachments?.[s]?.name ?? "Företagets standard"}</div>
          <div className="flex flex-wrap gap-2">
            {s === "price" && <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}><Upload size={15} />{busy ? "Importerar…" : "Importera prislista (PDF)"}</Button>}
            {a.attachments?.[s] && (
              <Button variant="ghost" size="sm" onClick={() => setA((p) => { const att = { ...p.attachments }; delete att[s]; return { ...p, attachments: att }; })}><RotateCcw size={15} />Använd standard</Button>
            )}
          </div>
        </div>
      ))}
      {msg && <p role="status" className="text-sm text-foreground">{msg}</p>}
      <p className="text-xs text-muted-foreground">Ändra texten i avtalet under fliken Villkor. Kalkyl (Bilaga 1) läggs till automatiskt.</p>
    </div>
  );
}

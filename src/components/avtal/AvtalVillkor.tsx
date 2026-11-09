import { useRef, useState } from "react";
import { FileText, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Avtal } from "@/lib/kalkyl";
import { uploadAgreementPdf } from "@/lib/bilagor";

type Slot = "cover" | "contract";
const LABEL: Record<Slot, string> = { cover: "Försättsblad", contract: "Huvudavtal (villkorssidor + signatursida)" };

/** Säljarens avtalsspecifika ändringar – påverkar bara detta avtal, aldrig företagets mallar. */
export function AvtalVillkor({ a, setA }: { a: Avtal; setA: (f: (p: Avtal) => Avtal) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [slot, setSlot] = useState<Slot>("contract");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="sarskilda-villkor">Särskilda villkor för detta avtal</label>
        <textarea id="sarskilda-villkor" rows={6} className="ds-input min-h-32 w-full py-2"
          placeholder="T.ex. Betalningsvillkor 60 dagar. Port 3 undantas från avtalet."
          value={a.sarskildaVillkor ?? ""} onChange={(e) => { const v = e.target.value; setA((p) => ({ ...p, sarskildaVillkor: v })); }} />
        <p className="mt-1 text-xs text-muted-foreground">Läggs som eget blad "Särskilda villkor" före Bilaga 1 och har företräde framför standardtexten.</p>
      </div>
      <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Välj egen PDF" onChange={(e) => {
        const file = e.target.files?.[0]; e.target.value = "";
        if (!file) return;
        setBusy(true); setMsg("");
        uploadAgreementPdf(file).then((f) => { setA((p) => ({ ...p, attachments: { ...p.attachments, [slot]: f } })); setMsg("Egen PDF tillagd. Spara avtalet för att behålla den."); })
          .catch((err: Error) => setMsg(err.message)).finally(() => setBusy(false));
      }} />
      {(["contract", "cover"] as const).map((s) => (
        <div key={s} className="space-y-1.5 border-t border-border pt-3">
          <div className="text-sm font-medium">{LABEL[s]}</div>
          <div className="break-words text-sm text-muted-foreground"><FileText size={13} className="mr-1 inline" />{a.attachments?.[s]?.name ?? "Företagets standard"}</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => { setSlot(s); input.current?.click(); }}><Upload size={15} />Ersätt med egen PDF</Button>
            {a.attachments?.[s] && <Button variant="ghost" size="sm" disabled={busy} onClick={() => setA((p) => { const att = { ...p.attachments }; delete att[s]; return { ...p, attachments: att }; })}><RotateCcw size={15} />Använd standard</Button>}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Tips: Spara PDF, redigera texten i Acrobat Pro och ladda upp den här som "Huvudavtal". Kalkyl (Bilaga 1) och prislista läggs till automatiskt.</p>
      {msg && <p role="status" className="text-sm text-foreground">{msg}</p>}
    </div>
  );
}

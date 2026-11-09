import { useEffect, useRef, useState } from "react";
import { FileText, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type CustomerFolder } from "@/lib/avtal-store";
import { ATTACHMENT_LABELS, type Attachments, type AttachmentSlot } from "@/lib/bilagor-model";
import { attachmentBytes, fetchAttachments, resetAttachment, updateOldPriceLists, uploadAttachment } from "@/lib/bilagor";

export function Bilagor({ store, onChanged }: { store: Record<string, CustomerFolder>; onChanged: () => void }) {
  const [files, setFiles] = useState<Attachments>({});
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [slot, setSlot] = useState<AttachmentSlot>("price");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { fetchAttachments().then(setFiles).catch((e: Error) => setMessage(e.message)).finally(() => setBusy(false)); }, []);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await action(); } catch (e) { setMessage(e instanceof Error ? e.message : "Kunde inte spara bilagorna."); } finally { setBusy(false); }
  };
  const agreements = Object.values(store).filter((f) => !f.uppsagd && f.versions.length && `${f.name} ${f.versions.at(-1)?.data.customer.avtalNr}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="space-y-3 border-t border-border pt-4">
    <h3 className="flex items-center gap-2 font-semibold text-foreground"><FileText size={17} />Bilagor – admin</h3>
    <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Bifoga PDF-bilaga" onChange={(e) => {
      const file = e.target.files?.[0]; e.target.value = "";
      if (file) void run(async () => { setFiles(await uploadAttachment(slot, file)); setMessage("Bilagan är sparad för nya avtal."); });
    }} />
    {(["cost", "price"] as const).map((key) => <div key={key} className="space-y-2 border-b border-border pb-3">
      <div className="text-sm font-medium">{ATTACHMENT_LABELS[key]}</div>
      <div className="break-words text-sm text-muted-foreground">{files[key]?.name ?? (key === "cost" ? "Automatisk kostnadsbilaga" : "Originalprislista")}</div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => { setSlot(key); input.current?.click(); }}><Upload size={15} />Bifoga PDF</Button>
        {files[key] && <>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => { const f = files[key]; if (f) void run(async () => {
            const url = URL.createObjectURL(new Blob([await attachmentBytes(f)], { type: "application/pdf" }));
            const link = document.createElement("a"); link.href = url; link.download = f.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
          }); }}><FileText size={15} />Hämta PDF</Button>
          <Button variant="ghost" size="sm" disabled={busy} title="Återställ standardbilaga för nya avtal" onClick={() => { if (window.confirm("Återställ standardbilagan för nya avtal? Sparade versioner ändras inte.")) void run(async () => { setFiles(await resetAttachment(key)); }); }}><RotateCcw size={15} />Återställ</Button>
        </>}
      </div>
    </div>)}
    {files.price && <div className="space-y-2">
      <h4 className="text-sm font-semibold">Uppdatera prislista i befintliga avtal</h4>
      <input className="ds-input" aria-label="Sök avtal för prislista" placeholder="Sök kund eller avtalsnummer" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="max-h-48 space-y-2 overflow-y-auto">
        {!agreements.length && <p className="text-sm text-muted-foreground">Inga avtal hittades.</p>}
        {agreements.map((f) => <label key={f.id} className="flex items-start gap-2 text-sm">
          <input type="checkbox" disabled={busy} className="mt-1 accent-primary" checked={selected.includes(f.id)} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, f.id] : ids.filter((id) => id !== f.id))} />
          <span className="min-w-0 break-words">{f.name}<span className="block text-xs text-muted-foreground">{f.versions.at(-1)?.data.customer.avtalNr || "Utan avtalsnummer"}</span></span>
        </label>)}
      </div>
      <Button disabled={busy || !selected.length} className="h-auto min-h-9 whitespace-normal" onClick={() => {
        const price = files.price;
        if (!price || !window.confirm(`Uppdatera endast prislistan i ${selected.length} avtal? En ny version sparas per avtal. Tidigare versioner behålls.`)) return;
        void run(async () => { const count = await updateOldPriceLists(selected, price); setSelected([]); onChanged(); setMessage(`Prislistan uppdaterad i ${count} avtal. Tidigare versioner finns kvar.`); });
      }}>Uppdatera prislista ({selected.length})</Button>
    </div>}
    {message && <p role="status" className="break-words text-sm text-foreground">{message}</p>}
  </section>;
}
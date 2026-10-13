import { useRef, useState } from "react";
import { FolderUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { classify, pdfText, type ImportHit, type ImportKind } from "@/lib/pdf-import";
import { avtalNrOwner, importAvtal, type CustomerFolder, type Status } from "@/lib/avtal-store";
import { fmtKr } from "@/lib/kalkyl";

type Item = ImportHit & { on: boolean; status: Status; dup: string | null };
type FsEntry = { isFile: boolean; isDirectory: boolean; name: string; fullPath: string; file?: (cb: (f: File) => void, err: (e: unknown) => void) => void; createReader?: () => { readEntries: (cb: (e: FsEntry[]) => void, err: (e: unknown) => void) => void } };

async function walk(e: FsEntry, out: { file: File; path: string }[]) {
  if (e.isFile && /\.pdf$/i.test(e.name)) out.push({ file: await new Promise<File>((res, rej) => e.file!(res, rej)), path: e.fullPath.replace(/^\//, "") });
  else if (e.isDirectory) {
    const r = e.createReader!();
    for (;;) {
      const batch = await new Promise<FsEntry[]>((res, rej) => r.readEntries(res, rej));
      if (!batch.length) break;
      for (const c of batch) await walk(c, out);
    }
  }
}

const TABS: { id: ImportKind; label: string; cls: string }[] = [
  { id: "ok", label: "Klara", cls: "bg-success/15 text-success" },
  { id: "granska", label: "Granska", cls: "bg-primary/20 text-foreground" },
  { id: "ej", label: "Ej avtal", cls: "bg-muted text-muted-foreground" },
];

/** Importera en hel mapp (t.ex. SharePoint-synkad kundmapp): sållar avtal från andra PDF:er. */
export function ImportPdf({ store, onClose, onDone }: { store: Record<string, CustomerFolder>; onClose: () => void; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState<{ n: number; of: number } | null>(null);
  const [tab, setTab] = useState<ImportKind>("ok");

  const run = async (files: { file: File; path: string }[]) => {
    const out: Item[] = [];
    setBusy({ n: 0, of: files.length });
    for (const [i, { file, path }] of files.entries()) {
      const parts = path.split("/");
      const folder = parts.length > 1 ? parts[parts.length - 2] ?? "" : "";
      let text = "";
      try { text = await pdfText(await file.arrayBuffer()); } catch { /* trasig pdf */ }
      const h = classify(text, file.name, path, folder);
      const dup = h.avtalNr ? avtalNrOwner(store, h.avtalNr) || (out.find((x) => x.avtalNr && x.avtalNr.toLowerCase() === h.avtalNr.toLowerCase())?.kund ?? null) : null;
      out.push({ ...h, on: h.kind === "ok" && !dup, status: "signerat", dup });
      setBusy({ n: i + 1, of: files.length });
    }
    setItems(out); setBusy(null); setTab(out.some((x) => x.kind === "ok") ? "ok" : "granska");
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files: { file: File; path: string }[] = [];
    for (const it of Array.from(e.dataTransfer.items)) {
      const en = (it as DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null }).webkitGetAsEntry?.();
      if (en) await walk(en, files);
    }
    void run(files);
  };
  const onPick = (fl: FileList | null) => {
    if (!fl) return;
    void run(Array.from(fl).filter((f) => /\.pdf$/i.test(f.name)).map((f) => ({ file: f, path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name })));
  };

  const upd = (i: number, p: Partial<Item>) => setItems((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const valda = items.filter((x) => x.on && x.kind !== "ej" && !x.dup);
  const spara = () => {
    if (!valda.length) return;
    const n = importAvtal(valda);
    alert(`${n} avtal importerade till registret.`);
    onDone();
  };

  return (
    <section className="ds-panel space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h2 className="font-display text-[15px] font-semibold text-foreground">Importera avtal från mapp</h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Stäng"><X size={16} /></Button>
      </div>
      <input ref={input} type="file" multiple accept="application/pdf" className="hidden" {...{ webkitdirectory: "", directory: "" }} onChange={(e) => onPick(e.target.files)} />
      {!items.length && (
        <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center">
          <FolderUp size={28} className="text-muted-foreground" />
          <p className="text-sm text-foreground">Dra hit kundmappen (från SharePoint/OneDrive på datorn)</p>
          <p className="text-xs text-muted-foreground">Appen läser varje PDF och sorterar ut avtalen. Inget sparas förrän du godkänner.</p>
          <Button variant="outline" disabled={!!busy} onClick={() => input.current?.click()}>Välj mapp</Button>
          {busy && <p className="text-xs text-muted-foreground">Läser {busy.n} av {busy.of} PDF:er …</p>}
        </div>
      )}
      {!!items.length && (
        <>
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <Button key={t.id} variant={tab === t.id ? "default" : "outline"} size="sm" onClick={() => setTab(t.id)}>
                {t.label} ({items.filter((x) => x.kind === t.id).length})
              </Button>
            ))}
          </div>
          <ul className="max-h-[55vh] space-y-2 overflow-auto">
            {items.map((x, i) => x.kind !== tab ? null : (
              <li key={x.path} className="rounded-md border border-border p-2 text-sm">
                <div className="flex items-start gap-2">
                  {x.kind !== "ej" && <input type="checkbox" className="mt-1" checked={x.on && !x.dup} disabled={!!x.dup} onChange={(e) => upd(i, { on: e.target.checked })} aria-label="Importera" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-muted-foreground" title={x.path}>{x.path}</p>
                    <p className="text-xs"><span className={`rounded px-1.5 py-0.5 ${TABS.find((t) => t.id === x.kind)!.cls}`}>{x.reason}</span>{x.dup && <span className="ml-2 text-destructive">Avtalsnr finns redan hos {x.dup}</span>}</p>
                    {x.kind !== "ej" && (
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <input className="ds-input" value={x.kund} onChange={(e) => upd(i, { kund: e.target.value })} placeholder="Kund" aria-label="Kund" />
                        <input className="ds-input" value={x.avtalNr} onChange={(e) => upd(i, { avtalNr: e.target.value, dup: e.target.value ? avtalNrOwner(store, e.target.value) : null })} placeholder="Avtalsnr" aria-label="Avtalsnr" />
                        <input className="ds-input" value={x.datum} onChange={(e) => upd(i, { datum: e.target.value })} placeholder="Datum" aria-label="Datum" />
                        <select className="ds-input" value={x.status} onChange={(e) => upd(i, { status: e.target.value as Status })} aria-label="Status">
                          <option value="signerat">Signerat</option><option value="skickat">Väntar på svar</option><option value="utkast">Utkast</option>
                        </select>
                        {x.perYear !== null && <p className="col-span-2 text-xs text-muted-foreground sm:col-span-4">Pris i PDF: {fmtKr(x.perYear)} / år (sparas i loggen)</p>}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setItems([])}>Börja om</Button>
            <Button onClick={spara} disabled={!valda.length}>Spara {valda.length} avtal till registret</Button>
          </div>
        </>
      )}
    </section>
  );
}

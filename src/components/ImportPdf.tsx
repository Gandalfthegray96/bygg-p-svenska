import { useRef, useState } from "react";
import { FolderUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { classify, mergeKalkyler, pdfText, type ImportHit, type ImportKind, type Kalkyl } from "@/lib/pdf-import";
import { avtalNrOwner, fyllImport, type CustomerFolder, type Status } from "@/lib/avtal-store";
import { matchPosts, type Match } from "@/lib/import-match";
import { facilitiesOf, normalizeAvtal, fmtKr } from "@/lib/kalkyl";
import { automaticPost, customerDirectory, linkageIssues, sourceDocument } from "@/lib/import-links";
import { excelKalkyler } from "@/lib/kalkyl-import";
import { droppedImportFiles, supportedFile } from "@/lib/import-files";

type Item = ImportHit & { mod: number; on: boolean; status: Status; dup: string | null; kalk: string; post: string; cands: Match[]; facility: string; confirmed: boolean; related: string[] };

const kundDir = customerDirectory;
/** kalk = "källfilens path|index" eller "path|all" — vilken kalkyl som ska användas för avtalet. */
const kalkOf = (items: Item[], x: Item): Kalkyl | null => {
  const [p, k] = [x.kalk.slice(0, x.kalk.lastIndexOf("|")), x.kalk.slice(x.kalk.lastIndexOf("|") + 1)];
  const src = items.find((y) => y.path === p);
  if (!src?.kalkyler.length) return null;
  return k === "" || k === "all" ? null : src.kalkyler[Number(k)] ?? null;
};
const TABS: { id: ImportKind; label: string; cls: string }[] = [
  { id: "ok", label: "Klara", cls: "bg-success/15 text-success" },
  { id: "granska", label: "Granska", cls: "bg-primary/20 text-foreground" },
  { id: "ej", label: "Ej avtal", cls: "bg-muted text-muted-foreground" },
];

/** Importera en hel mapp (t.ex. SharePoint-synkad kundmapp): sållar avtal från andra PDF:er. */
export function ImportPdf({ store, onClose, onDone }: { store: Record<string, CustomerFolder>; onClose: () => void; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const singleInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState<{ n: number; of: number } | null>(null);
  const [tab, setTab] = useState<ImportKind>("ok");
  const [dropError, setDropError] = useState("");
  const [sok, setSok] = useState<Record<string, string>>({});
  const [avtalSok, setAvtalSok] = useState<Record<string, string>>({});

  const run = async (files: { file: File; path: string }[]) => {
    const out: Item[] = [];
    setBusy({ n: 0, of: files.length });
    for (const [i, { file, path }] of files.entries()) {
      const parts = path.split("/");
      const folder = parts.length > 1 ? parts[parts.length - 2] ?? "" : "";
      let text = "";
      let kalkyler: Kalkyl[] = [];
      const excel = /\.(xlsx|xls)$/i.test(file.name);
      try {
        const bytes = await file.arrayBuffer();
        if (excel) kalkyler = await excelKalkyler(bytes, path);
        else text = await pdfText(bytes);
      } catch { /* trasig eller oläsbar fil */ }
      const h = classify(text, file.name, path, folder);
      if (excel) {
        const k = mergeKalkyler(kalkyler);
        Object.assign(h, { kalkyler, objekt: k.objekt, besokPerAr: k.besokPerAr, perYear: k.perYear, kind: !kalkyler.length ? "ej" : k.perYear !== null ? "ok" : "granska", reason: !kalkyler.length ? "Ingen stödd kalkyltabell hittades i Excel" : k.perYear !== null ? "Excelkalkyl med pris" : "Excelkalkyl utan pris – fyll i pris" });
        const issues = kalkyler.flatMap((calculation) => calculation.evidence?.verification.unresolvedIssues ?? []);
        if (issues.length) { h.kind = "granska"; h.reason = [...new Set(issues)].join(" "); }
      }
      // Dubblettkontroll bara mot sparade avtal i registret – inte mot andra filer i importen.
      // Bara befintliga kunder i appen: utan träff hamnar filen under "Ej avtal".
      const cands = h.kind === "ej" && !h.kalkyler.length ? [] : matchPosts(store, h);
      const post = automaticPost(store, h, cands);
      if (h.kalkyler.length && h.kind === "ej" && post) { h.kind = "granska"; h.reason = "Kalkyl för befintligt avtal – kontrollera pris"; }
      if (h.kind === "ok" && (cands[0]?.score ?? 0) < 60) { h.kind = "granska"; h.reason = "Osäker kundträff – kontrollera avtal"; }
      if (!post && h.kalkyler.length) {
        h.kind = "granska"; h.reason = "Välj befintligt avtal – kunden kunde inte identifieras";
        cands.push(...Object.values(store).map((f) => ({ id: f.id, name: f.name, adress: f.versions.at(-1)?.data.customer.anlAdress ?? "", score: 0 })).sort((a, b) => a.name.localeCompare(b.name, "sv")));
      } else if (!post && h.kind !== "ej") { h.kind = "granska"; h.reason = "Välj befintligt avtal – kund, avtalsnummer eller adress är osäker"; }
      const dup = h.avtalNr && post ? avtalNrOwner(store, h.avtalNr, post) : null;
      const fac = post ? facilitiesOf(normalizeAvtal(store[post]?.versions.at(-1)?.data)) : [];
      const facility = fac.length === 1 ? fac[0]?.id ?? "" : "";
      if (h.kalkyler.length > 1 || fac.length > 1) { h.kind = "granska"; h.reason = "Flera kalkyler eller serviceadresser – välj koppling"; }
      out.push({ ...h, on: h.kind === "ok" && !!post && !dup, mod: file.lastModified || 0, status: "signerat", dup, kalk: h.kalkyler.length === 1 ? `${path}|0` : "", post, cands, facility, confirmed: false, related: [] });
      setBusy({ n: i + 1, of: files.length });
    }
    setBusy(null);
    setItems((prev) => {
      const merged = [...prev, ...out.filter((x) => !prev.some((old) => old.path === x.path))];
      // Linking a file must never erase a failed parser check.
      for (const x of merged) {
        const selected = kalkOf(merged, x);
        const issues = selected?.evidence?.verification.unresolvedIssues ?? x.evidence?.verification.unresolvedIssues ?? [];
        if (x.kind !== "ej" && issues.length) { x.kind = "granska"; x.reason = [...new Set(issues)].join(" "); x.on = false; }
      }
      if (!prev.length) setTab(merged.some((x) => x.kind === "ok") ? "ok" : "granska");
      return merged;
    });
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setDropError("");
    setBusy({ n: 0, of: 0 });
    try {
      const files = await droppedImportFiles(e.dataTransfer);
      if (!files.length) {
        setDropError("Inga PDF- eller Excelfiler hittades i det du släppte.");
        setBusy(null);
        return;
      }
      await run(files);
    } catch {
      setBusy(null);
      setDropError("Mappen kunde inte läsas. Kontrollera att filerna finns på datorn och försök igen med Välj mapp.");
    }
  };
  const onPick = (fl: FileList | null) => {
    if (!fl) return;
    void run(Array.from(fl).filter((f) => supportedFile(f.name)).map((f) => ({ file: f, path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name })));
  };

  const upd = (i: number, p: Partial<Item>) => setItems((l) => l.map((x, j) => {
    if (j !== i) return x;
    const next = { ...x, ...p };
    if (p.post !== undefined) {
      const fac = p.post ? facilitiesOf(normalizeAvtal(store[p.post]?.versions.at(-1)?.data)) : [];
      next.facility = fac.length === 1 ? fac[0]?.id ?? "" : "";
    }
    if (Object.keys(p).some((key) => !["on", "confirmed"].includes(key))) next.confirmed = false;
    return next;
  }));
  const valda = items.filter((x) => x.on && x.kind !== "ej" && !x.dup && x.post);
  const repeatedTarget = valda.some((x) => valda.filter((y) => y.post === x.post).length > 1);
  const pendingLink = valda.some((x) => !x.facility || !x.confirmed || (x.facility === "new" && !x.adress.trim()));
  const spara = () => {
    if (!valda.length || repeatedTarget || pendingLink) return;
    const n = fyllImport(valda.map((x) => {
      const k = kalkOf(items, x);
      const src = x.kalk.startsWith(`${x.path}|`) ? "" : x.kalk.slice(0, x.kalk.lastIndexOf("|"));
      const source = items.find((y) => y.path === (src || x.path));
      const documents = [sourceDocument(x, x.mod, /\.(xlsx|xls)$/i.test(x.file) ? "kalkyl" : "huvudavtal", x.facility === "new" ? undefined : x.facility, src ? null : k), ...(source && src ? [sourceDocument(source, source.mod, "kalkyl", x.facility === "new" ? undefined : x.facility, k)] : []), ...items.filter((y) => x.related.includes(y.path)).map((y) => sourceDocument(y, y.mod, y.kalkyler.length ? "kalkyl" : "annat"))];
      const base = { ...x, postId: x.post, facilityId: x.facility, documents };
      return k ? { ...base, objekt: k.objekt, besokPerAr: k.besokPerAr, perYear: k.perYear, path: src ? `${x.path} + kalkyl ${src}` : x.path } : { ...base, objekt: [], perYear: x.kalkyler.length ? null : x.perYear };
    }));
    alert(`${n} befintliga avtal uppdaterade med uppgifter från filerna.`);
    onDone();
  };

  return (
    <section className="ds-panel space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h2 className="font-display text-[15px] font-semibold text-foreground">Fyll i avtal från kundmapp</h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Stäng"><X size={16} /></Button>
      </div>
      <input ref={input} type="file" multiple accept=".pdf,.xlsx,.xls" className="hidden" {...{ webkitdirectory: "", directory: "" }} onChange={(e) => onPick(e.target.files)} />
      <input ref={singleInput} type="file" multiple accept=".pdf,.xlsx,.xls" className="hidden" onChange={(e) => onPick(e.target.files)} />
      <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border text-center ${items.length ? "p-3" : "p-6"}`}>
        {!items.length && <FolderUp size={28} className="text-muted-foreground" />}
        <p className="text-sm text-foreground">{items.length ? "Dra hit fler mappar – de läggs till i listan nedan" : "Dra hit en eller flera kundmappar (från SharePoint/OneDrive på datorn)"}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" disabled={!!busy} onClick={() => input.current?.click()}>Välj mapp</Button>
          <Button variant="outline" disabled={!!busy} onClick={() => singleInput.current?.click()}>Välj PDF eller Excel</Button>
        </div>
        {busy && <p className="text-xs text-muted-foreground">{busy.of ? `Läser ${busy.n} av ${busy.of} filer …` : "Letar efter PDF- och Excelfiler i mapparna …"}</p>}
        {dropError && <p role="alert" className="text-sm text-destructive">{dropError}</p>}
      </div>
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
                    <p className="text-xs"><span className={`rounded px-1.5 py-0.5 ${TABS.find((t) => t.id === x.kind)?.cls ?? ""}`}>{x.reason}</span>{x.dup && <span className="ml-2 text-destructive">Avtalsnr finns redan hos {x.dup}</span>}</p>
                    {x.kind !== "ej" && (
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <input className="ds-input col-span-2 sm:col-span-4" value={avtalSok[x.path] ?? ""} onChange={(e) => setAvtalSok((m) => ({ ...m, [x.path]: e.target.value }))} placeholder="Sök avtal (kund, adress, avtalsnr)" aria-label="Sök avtal" />
                        <select className="ds-input col-span-2 sm:col-span-4" value={x.post} onChange={(e) => upd(i, { post: e.target.value, on: !!e.target.value, dup: x.avtalNr ? avtalNrOwner(store, x.avtalNr, e.target.value) : null })} aria-label="Befintligt avtal">
                          <option value="">Välj befintligt avtal</option>
                          {(() => { const q = (avtalSok[x.path] ?? "").trim().toLowerCase(); const all = q ? Object.values(store).map((f) => ({ id: f.id, name: f.name, adress: f.versions.at(-1)?.data.customer.anlAdress ?? "", nr: f.versions.at(-1)?.data.customer.avtalNr ?? "" })).filter((c) => `${c.name} ${c.adress} ${c.nr}`.toLowerCase().includes(q)).slice(0, 50) : x.cands; return all.some((c) => c.id === x.post) || !x.post ? all : [...x.cands.filter((c) => c.id === x.post), ...all]; })().map((c) => <option key={c.id} value={c.id}>{c.name}{c.adress ? ` – ${c.adress}` : ""}</option>)}
                        </select>
                        <select className="ds-input col-span-2 sm:col-span-4" value={x.facility} onChange={(e) => upd(i, { facility: e.target.value, confirmed: false })} aria-label="Serviceadress">
                          <option value="">Välj serviceadress</option>
                          {x.post && facilitiesOf(normalizeAvtal(store[x.post]?.versions.at(-1)?.data)).map((f) => <option key={f.id} value={f.id}>{f.address || "Standardadress"}</option>)}
                          <option value="new">Ny serviceadress i detta avtal</option>
                        </select>
                        <input className="ds-input col-span-2 sm:col-span-4" value={x.adress} onChange={(e) => upd(i, { adress: e.target.value, confirmed: false })} placeholder="Serviceadress" aria-label="Adress från dokument" />
                        {!!Object.keys(x.info).length && <p className="col-span-2 text-xs text-muted-foreground sm:col-span-4">{[x.info.varRef && `Ansvarig: ${x.info.varRef}`, x.info.kontaktperson && `Kontakt: ${x.info.kontaktperson}`, x.info.telefon, x.info.epost, x.info.orgNr && `Org.nr ${x.info.orgNr}`].filter(Boolean).join(" · ")}</p>}
                        <input className="ds-input" value={x.kund} onChange={(e) => upd(i, { kund: e.target.value })} placeholder="Kund" aria-label="Kund" />
                        <input className="ds-input" value={x.avtalNr} onChange={(e) => upd(i, { avtalNr: e.target.value, dup: e.target.value ? avtalNrOwner(store, e.target.value, x.post) : null })} placeholder="Avtalsnr" aria-label="Avtalsnr" />
                        <input className="ds-input" value={x.datum} onChange={(e) => upd(i, { datum: e.target.value })} placeholder="Datum" aria-label="Datum" />
                        <select className="ds-input" value={x.status} onChange={(e) => upd(i, { status: e.target.value as Status })} aria-label="Status">
                          <option value="signerat">Signerat</option><option value="skickat">Väntar på svar</option><option value="utkast">Utkast</option>
                        </select>
                        <input className="ds-input col-span-2 sm:col-span-4" value={sok[x.path] ?? ""} onChange={(e) => setSok((m) => ({ ...m, [x.path]: e.target.value }))} placeholder="Sök kalkyl (filnamn, mapp) – tomt visar kalkyler i kundens mapp" aria-label="Sök kalkyl" />
                        <select className="ds-input col-span-2 sm:col-span-4" value={x.kalk} onChange={(e) => upd(i, { kalk: e.target.value, confirmed: false, kind: "granska" })} aria-label="Kalkyl">
                          <option value="">Ingen vald kalkyl – endast dokumentuppgifter</option>
                          {(() => { const q = (sok[x.path] ?? "").trim().toLowerCase(); const dir = kundDir(x.path); const list = items.filter((y) => y.kalkyler.length && (y.path === x.path || `${y.kalk}` === x.kalk || x.kalk.startsWith(`${y.path}|`) || (q ? `${y.path} ${y.kalkyler.map((k) => k.namn).join(" ")}`.toLowerCase().includes(q) : kundDir(y.path) === dir))); return list.length ? null : <option value="" disabled>{q ? "Ingen kalkyl matchar sökningen" : "Inga kalkyler i kundens mapp – sök för att visa fler"}</option>; })()}
                          {items.filter((y) => { const q = (sok[x.path] ?? "").trim().toLowerCase(); return y.kalkyler.length && (y.path === x.path || x.kalk.startsWith(`${y.path}|`) || (q ? `${y.path} ${y.kalkyler.map((k) => k.namn).join(" ")}`.toLowerCase().includes(q) : kundDir(y.path) === kundDir(x.path))); }).sort((a, b) => b.mod - a.mod).map((y) => (
                            <optgroup key={y.path} label={y.path === x.path ? "Kalkyl i denna fil" : `${y.file}${y.mod ? ` (ändrad ${new Date(y.mod).toLocaleDateString("sv-SE")})` : ""} – ${y.path.split("/").slice(0, -1).join("/")}`}>
                              {y.kalkyler.map((k, ki) => <option key={ki} value={`${y.path}|${ki}`}>{k.namn} – {k.objekt.reduce((s, o) => s + o.qty, 0)} objekt{k.perYear !== null ? `, ${fmtKr(k.perYear)}/år` : ""}</option>)}
                            </optgroup>
                          ))}
                          {!x.kalkyler.length && <option value={x.kalk}>Ingen kalkyl i filen{x.perYear !== null ? ` (pris ${fmtKr(x.perYear)}/år)` : ""}</option>}
                        </select>
                        {(() => { const k = kalkOf(items, x); return k && <p className="col-span-2 text-xs text-muted-foreground sm:col-span-4">{k.objekt.reduce((s, o) => s + o.qty, 0)} objekt ({k.objekt.length} typer) · {k.besokPerAr} besök/år{k.perYear !== null && <> · pris: {fmtKr(k.perYear)} / år (kalkylen justeras till detta)</>}</p>; })()}
                        {linkageIssues(x, items.find((y) => x.kalk.startsWith(`${y.path}|`)), kalkOf(items, x)).map((issue) => <p key={issue} className="col-span-2 text-xs text-destructive sm:col-span-4">{issue}</p>)}
                        {(x.facility === "new" || (x.post && facilitiesOf(normalizeAvtal(store[x.post]?.versions.at(-1)?.data)).length > 1)) && <p className="col-span-2 text-xs text-muted-foreground sm:col-span-4">Flera serviceadresser: källor och adresser sparas; befintliga objekt och priser behålls tills prisgranskningen i steg 4.</p>}
                        {!!kundDir(x.path) && items.filter((y) => y.path !== x.path && kundDir(y.path) === kundDir(x.path)).map((y) => <label key={y.path} className="col-span-2 flex min-w-0 gap-2 text-xs sm:col-span-4"><input type="checkbox" checked={x.related.includes(y.path)} onChange={(e) => upd(i, { related: e.target.checked ? [...x.related, y.path] : x.related.filter((p) => p !== y.path), confirmed: false })} /><span className="min-w-0 break-words">Historiskt underlag: {y.file}</span></label>)}
                        <label className="col-span-2 flex gap-2 text-xs sm:col-span-4"><input type="checkbox" checked={x.confirmed} onChange={(e) => upd(i, { confirmed: e.target.checked })} />Jag bekräftar avtal, serviceadress och valda dokument</label>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            {repeatedTarget && <p role="alert" className="w-full text-sm text-destructive">Flera filer är valda till samma avtal. Välj en huvudrad och koppla övriga som underlag.</p>}
            <Button variant="outline" onClick={() => setItems([])}>Börja om</Button>
            <Button onClick={spara} disabled={!valda.length || repeatedTarget || pendingLink}>Fyll i {valda.length} avtal</Button>
          </div>
        </>
      )}
    </section>
  );
}

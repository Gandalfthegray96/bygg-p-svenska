import { useRef, useState } from "react";
import { FolderUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { classify, mergeKalkyler, pdfText, type ImportHit, type ImportKind, type Kalkyl } from "@/lib/pdf-import";
import { avtalNrOwner, fyllImport, type CustomerFolder, type Status } from "@/lib/avtal-store";
import { matchPosts, type Match } from "@/lib/import-match";
import { fmtKr } from "@/lib/kalkyl";
import { excelKalkyler } from "@/lib/kalkyl-import";
import { droppedImportFiles, supportedFile } from "@/lib/import-files";

type Item = ImportHit & { mod: number; on: boolean; status: Status; dup: string | null; kalk: string; post: string; cands: Match[] };

/** Filer med samma avtalsnr blir ett avtal: bästa filen blir huvudpost, övriga ger kalkyler/uppgifter. */
function groupByAvtalNr(list: Item[]): Item[] {
  const groups = new Map<string, Item[]>();
  for (const x of list) if (x.avtalNr) { const k = x.avtalNr.toLowerCase(); groups.set(k, [...(groups.get(k) ?? []), x]); }
  const score = (x: Item) => (x.kind === "ok" ? 4 : x.kind === "granska" ? 2 : 0) + (x.kalkyler.length ? 1 : 0) + (x.adress ? 0.5 : 0);
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const main = [...g].sort((a, b) => score(b) - score(a))[0];
    if (!main) continue;
    const rest = g.filter((x) => x !== main);
    if (main.kind === "ej") main.kind = "granska";
    main.reason = `Sammanslaget av ${g.length} filer – välj kalkyl`;
    main.on = !!main.post && !main.dup;
    for (const r of rest) {
      main.kund ||= r.kund; main.adress ||= r.adress; main.datum ||= r.datum;
      r.kind = "ej"; r.on = false; r.reason = `Ingår i avtal ${main.avtalNr} (${main.file})`;
    }
    if (!main.kalkyler.length) {
      const src = rest.find((r) => r.kalkyler.length);
      if (src) main.kalk = `${src.path}|${src.kalkyler.length > 1 ? "all" : 0}`;
    }
  }
  return list;
}
/** Kundmapp för en fil: katalogen, utan avslutande AV/Avt/A/FU/Kalkyl-undermapp. */
const kundDir = (path: string) => { const d = path.split("/").slice(0, -1); while (d.length > 1 && /^(av|avt|avtal|a|fu|kalkyl(er)?|underhåll|serviceavtal)$/i.test(d.at(-1) ?? "")) d.pop(); return d.join("/").toLowerCase(); };
/** Avtal och lösa kalkyler i samma kundmapp hör ihop: senast ändrade kalkylen kopplas automatiskt till avtalet. */
function groupByFolder(list: Item[]): Item[] {
  const live = list.filter((x) => !x.reason.startsWith("Ingår i"));
  const dirs = new Map<string, Item[]>();
  for (const x of live) { const k = kundDir(x.path); if (k) dirs.set(k, [...(dirs.get(k) ?? []), x]); }
  for (const g of dirs.values()) {
    const kalk = g.filter((x) => x.kalkyler.length).sort((a, b) => b.mod - a.mod);
    const avtal = g.filter((x) => x.avtalNr && x.kind !== "ej" || (x.post && !x.kalkyler.length)).sort((a, b) => b.mod - a.mod);
    const latest = kalk[0];
    if (!latest) continue;
    const mains = avtal.length ? avtal : [latest];
    for (const m of mains) {
      if (m !== latest && !m.kalkyler.length) m.kalk = `${latest.path}|${latest.kalkyler.length > 1 ? "all" : 0}`;
      if (!m.post && latest.post) { m.post = latest.post; m.cands = latest.cands; }
      if (m.kind === "ej" && m.post) m.kind = "granska";
      m.on = !!m.post && !m.dup && m.kind !== "ej";
    }
    for (const k of kalk) if (!mains.includes(k)) {
      if (mains.length === 1 && mains[0] && !mains[0].post && k.post) { mains[0].post = k.post; mains[0].cands = k.cands; mains[0].on = !mains[0].dup; }
      k.kind = "ej"; k.on = false; k.reason = k === latest ? `Senaste kalkylen – kopplad till ${mains.map((m) => m.file).join(", ")}` : `Äldre kalkyl – ersatt av ${latest.file}`;
    }
    for (const m of mains) if (m !== latest && m.post) { m.kind = m.dup || kalkOf(list, m)?.perYear == null ? "granska" : "ok"; m.reason = `Avtal + senaste kalkyl (${latest.file}) från samma mapp`; }
  }
  return list;
}
/** kalk = "källfilens path|index" eller "path|all" — vilken kalkyl som ska användas för avtalet. */
const kalkOf = (items: Item[], x: Item): Kalkyl | null => {
  const [p, k] = [x.kalk.slice(0, x.kalk.lastIndexOf("|")), x.kalk.slice(x.kalk.lastIndexOf("|") + 1)];
  const src = items.find((y) => y.path === p);
  if (!src?.kalkyler.length) return null;
  return k === "all" ? mergeKalkyler(src.kalkyler) : src.kalkyler[Number(k)] ?? null;
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
        if (excel) kalkyler = await excelKalkyler(bytes);
        else text = await pdfText(bytes);
      } catch { /* trasig eller oläsbar fil */ }
      const h = classify(text, file.name, path, folder);
      if (excel) {
        const k = mergeKalkyler(kalkyler);
        Object.assign(h, { kalkyler, objekt: k.objekt, besokPerAr: k.besokPerAr, perYear: k.perYear, kind: !kalkyler.length ? "ej" : k.perYear !== null ? "ok" : "granska", reason: !kalkyler.length ? "Ingen stödd kalkyltabell hittades i Excel" : k.perYear !== null ? "Excelkalkyl med pris" : "Excelkalkyl utan pris – fyll i pris" : "Ingen stödd kalkyltabell hittades i Excel" });
      }
      // Dubblettkontroll bara mot sparade avtal i registret – inte mot andra filer i importen.
      // Bara befintliga kunder i appen: utan träff hamnar filen under "Ej avtal".
      const cands = h.kind === "ej" && !h.kalkyler.length ? [] : matchPosts(store, h);
      const post = cands[0]?.id ?? "";
      if (h.kalkyler.length && h.kind === "ej" && post) { h.kind = "granska"; h.reason = "Kalkyl för befintligt avtal – kontrollera pris"; }
      if (h.kind === "ok" && (cands[0]?.score ?? 0) < 60) { h.kind = "granska"; h.reason = "Osäker kundträff – kontrollera avtal"; }
      if (!post && h.kalkyler.length) {
        h.kind = "granska"; h.reason = "Välj befintligt avtal – kunden kunde inte identifieras";
        cands.push(...Object.values(store).map((f) => ({ id: f.id, name: f.name, adress: f.versions.at(-1)?.data.customer.anlAdress ?? "", score: 0 })).sort((a, b) => a.name.localeCompare(b.name, "sv")));
      } else if (!post && h.kind !== "ej") { h.kind = "ej"; h.reason = "Kunden finns inte i appen"; }
      const dup = h.avtalNr && post ? avtalNrOwner(store, h.avtalNr, post) : null;
      out.push({ ...h, on: h.kind !== "ej" && !!post && !dup, mod: file.lastModified || 0, status: "signerat", dup, kalk: `${path}|${h.kalkyler.length > 1 ? "all" : 0}`, post, cands });
      setBusy({ n: i + 1, of: files.length });
    }
    setBusy(null);
    setItems((prev) => {
      const merged = groupByFolder(groupByAvtalNr([...prev, ...out]));
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

  const upd = (i: number, p: Partial<Item>) => setItems((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const valda = items.filter((x) => x.on && x.kind !== "ej" && !x.dup && x.post);
  const spara = () => {
    if (!valda.length) return;
    const n = fyllImport(valda.map((x) => {
      const k = kalkOf(items, x);
      const src = x.kalk.startsWith(`${x.path}|`) ? "" : x.kalk.slice(0, x.kalk.lastIndexOf("|"));
      const base = { ...x, postId: x.post };
      return k ? { ...base, objekt: k.objekt, besokPerAr: k.besokPerAr, perYear: k.perYear, path: src ? `${x.path} + kalkyl ${src}` : x.path } : { ...base, objekt: [] };
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
                        <select className="ds-input col-span-2 sm:col-span-4" value={x.post} onChange={(e) => upd(i, { post: e.target.value, on: !!e.target.value, dup: x.avtalNr ? avtalNrOwner(store, x.avtalNr, e.target.value) : null })} aria-label="Befintligt avtal">
                          <option value="">Välj befintligt avtal</option>
                          {x.cands.map((c) => <option key={c.id} value={c.id}>{c.name}{c.adress ? ` – ${c.adress}` : ""}</option>)}
                        </select>
                        {!!Object.keys(x.info).length && <p className="col-span-2 text-xs text-muted-foreground sm:col-span-4">{[x.info.varRef && `Ansvarig: ${x.info.varRef}`, x.info.kontaktperson && `Kontakt: ${x.info.kontaktperson}`, x.info.telefon, x.info.epost, x.info.orgNr && `Org.nr ${x.info.orgNr}`].filter(Boolean).join(" · ")}</p>}
                        <input className="ds-input" value={x.kund} onChange={(e) => upd(i, { kund: e.target.value })} placeholder="Kund" aria-label="Kund" />
                        <input className="ds-input" value={x.avtalNr} onChange={(e) => upd(i, { avtalNr: e.target.value, dup: e.target.value ? avtalNrOwner(store, e.target.value, x.post) : null })} placeholder="Avtalsnr" aria-label="Avtalsnr" />
                        <input className="ds-input" value={x.datum} onChange={(e) => upd(i, { datum: e.target.value })} placeholder="Datum" aria-label="Datum" />
                        <select className="ds-input" value={x.status} onChange={(e) => upd(i, { status: e.target.value as Status })} aria-label="Status">
                          <option value="signerat">Signerat</option><option value="skickat">Väntar på svar</option><option value="utkast">Utkast</option>
                        </select>
                        <select className="ds-input col-span-2 sm:col-span-4" value={x.kalk} onChange={(e) => upd(i, { kalk: e.target.value })} aria-label="Kalkyl">
                          {items.filter((y) => y.kalkyler.length).map((y) => (
                            <optgroup key={y.path} label={y.path === x.path ? "Kalkyl i denna fil" : `Slå ihop med kalkyl från: ${y.file}`}>
                              {y.kalkyler.map((k, ki) => <option key={ki} value={`${y.path}|${ki}`}>{k.namn} – {k.objekt.reduce((s, o) => s + o.qty, 0)} objekt{k.perYear !== null ? `, ${fmtKr(k.perYear)}/år` : ""}</option>)}
                              {y.kalkyler.length > 1 && <option value={`${y.path}|all`}>Alla {y.kalkyler.length} sammanslagna</option>}
                            </optgroup>
                          ))}
                          {!x.kalkyler.length && <option value={x.kalk}>Ingen kalkyl i filen{x.perYear !== null ? ` (pris ${fmtKr(x.perYear)}/år)` : ""}</option>}
                        </select>
                        {(() => { const k = kalkOf(items, x); return k && <p className="col-span-2 text-xs text-muted-foreground sm:col-span-4">{k.objekt.reduce((s, o) => s + o.qty, 0)} objekt ({k.objekt.length} typer) · {k.besokPerAr} besök/år{k.perYear !== null && <> · pris: {fmtKr(k.perYear)} / år (kalkylen justeras till detta)</>}</p>; })()}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setItems([])}>Börja om</Button>
            <Button onClick={spara} disabled={!valda.length}>Fyll i {valda.length} avtal</Button>
          </div>
        </>
      )}
    </section>
  );
}

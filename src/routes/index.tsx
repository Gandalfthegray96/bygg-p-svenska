import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode, type CSSProperties } from "react";
import { CoverPreview, Preview } from "@/components/avtal/Preview";
import { type Avtal, type Customer, type ObjRow, calculate, emptyAvtal, fmtKr, fmtNum, newRow, normalizeAvtal, OBJEKT_TYPER } from "@/lib/kalkyl";
import { type CustomerFolder, type Status, deleteVersion, loadDraft, loadStore, saveDraft, saveVersion, setVersionStatus } from "@/lib/avtal-store";
import { Copy, FileSpreadsheet, FileText, FolderOpen, Mail, Plus, RotateCcw, Save, Search, Trash2, X } from "lucide-react";
import { downloadExcel, fileBase } from "@/lib/excel";
import { buildAvtalPdf } from "@/lib/pdf-avtal";
import { saveFile } from "@/lib/save-file";

function PdfPreview({ a }: { a: Avtal }) {
  const [pages, setPages] = useState<string[]>([]);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const bytes = await buildAvtalPdf(a);
        const pdfjs = await import("pdfjs-dist");
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
        const out: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
          out.push(canvas.toDataURL("image/jpeg", 0.85));
        }
        if (alive) { setPages(out); setErr(false); }
      } catch (e) { console.error(e); if (alive) setErr(true); }
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [a]);
  if (err) return <p className="text-sm text-destructive">Kunde inte visa avtalet. Använd PDF-knappen nedan.</p>;
  if (!pages.length) return <p className="text-sm text-muted-foreground">Skapar avtalet …</p>;
  return (
    <div className="space-y-3">
      {pages.map((src, i) => (
        <img key={i} src={src} alt={`Avtal sida ${i + 1}`} className="w-full rounded-xl border border-glass-border shadow-lg" />
      ))}
    </div>
  );
}


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Avtal & prisräknare – UK Portservice" },
      { name: "description", content: "Gör hela avtalet för förebyggande underhåll: kund, objekt, pris, försättsblad och avtal som PDF och kalkyl som Excel." },
      { property: "og:title", content: "Avtal & prisräknare – UK Portservice" },
      { property: "og:description", content: "Kund, objekt, pris och färdigt avtal som PDF och Excel – direkt i telefonen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
    ],
  }),
  component: App,
});

type Tab = "kund" | "forsatt" | "objekt" | "pris" | "avtal" | "sparade";
const TABS: { id: Tab; label: string }[] = [
  { id: "kund", label: "Kund" },
  { id: "forsatt", label: "Försätt" },
  { id: "objekt", label: "Objekt" },
  { id: "pris", label: "Pris" },
  { id: "avtal", label: "Avtal" },
  { id: "sparade", label: "Sparade" },
];

const inputCls = "w-full rounded-xl border border-input/70 bg-glass-strong px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/50 focus:bg-card focus:ring-4 focus:ring-ring/15";
const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-xl bg-primary shadow-lg shadow-primary/25 px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90";
const btnOutline = "inline-flex items-center justify-center gap-2 rounded-xl border border-glass-border bg-glass-strong px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent";

function defaultMailText(erRef: string) {
  return [
    `Hej${erRef ? " " + erRef : ""}!`,
    "",
    "Tack för att ni valt UK Portservice!",
    "",
    "Här kommer ert avtalsförslag för förebyggande underhåll. Avtalsförslaget finns bifogat i detta mejl.",
    "",
    "Återkom gärna om ni har frågor eller vill justera något.",
  ].join("\n");
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function TextField({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </label>
  );
}

function NumField({ label, value, onChange, min = 0, max }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((t) => (t === "" || Number(t) === value ? t : String(value)));
  }, [value]);
  const clamp = (n: number) => { if (max !== undefined) n = Math.min(max, n); return Math.max(min, n); };
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="number" min={min} max={max} inputMode="decimal" value={text}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (t === "") return;
          const n = Number(t);
          if (!Number.isNaN(n) && n >= min) onChange(clamp(n));
        }}
        onBlur={() => {
          const n = Number(text);
          const v = text === "" || Number.isNaN(n) ? min : clamp(n);
          setText(String(v));
          onChange(v);
        }}
        className={inputCls}
      />
    </label>
  );
}

const STATUS: Record<Status, { label: string; cls: string }> = {
  utkast: { label: "Utkast", cls: "bg-muted text-muted-foreground" },
  skickat: { label: "Skickat", cls: "bg-info/15 text-info" },
  signerat: { label: "Signerat", cls: "bg-success/15 text-success" },
};

function ConfirmDialog({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div role="dialog" aria-modal="true" className="glass w-full max-w-sm rounded-3xl bg-glass-strong p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><RotateCcw size={22} /></div>
        <h2 className="text-lg font-bold text-foreground">Vill du verkligen börja om?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Allt du fyllt i rensas. Osparade ändringar försvinner, men sparade versioner ligger kvar.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className={`${btnOutline} py-2.5`} onClick={onCancel}>Avbryt</button>
          <button className="rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground" onClick={onConfirm}>Ja, börja om</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [a, setA] = useState<Avtal>(emptyAvtal);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("kund");
  const [store, setStore] = useState<Record<string, CustomerFolder>>({});
  const [currentVersion, setCurrentVersion] = useState<number | undefined>();
  const [toast, setToast] = useState("");
  const [confirmNew, setConfirmNew] = useState(false);
  const [search, setSearch] = useState("");
  const startNew = () => { setA(emptyAvtal()); setCurrentVersion(undefined); setTab("kund"); setConfirmNew(false); setToast("Nytt tomt avtal"); };

  useEffect(() => {
    const d = loadDraft();
    if (d) setA(d);
    setStore(loadStore());
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) saveDraft(a); }, [a, hydrated]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2500); return () => clearTimeout(t); }, [toast]);

  const k = useMemo(() => calculate(a), [a]);
  const c = a.customer;
  const setC = (patch: Partial<Customer>) => setA((p) => ({ ...p, customer: { ...p.customer, ...patch } }));
  const updateRow = (id: string, patch: Partial<ObjRow>) => setA((p) => ({ ...p, rows: p.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  const onSave = () => {
    const v = saveVersion(a);
    setCurrentVersion(v);
    setStore(loadStore());
    setToast(`Sparat som v${v} under ${c.bestallare || "Namnlös kund"}`);
  };

  const onPdf = async () => {
    try {
      const bytes = await buildAvtalPdf(a);
      await saveFile(new Blob([bytes as BlobPart], { type: "application/pdf" }), `Avtal_${fileBase(a, currentVersion)}.pdf`, "application/pdf", ".pdf");
    } catch {
      setToast("Kunde inte skapa PDF:en");
    }
  };

  const openMail = () => {
    const subject = `Avtalsförslag ${c.avtalNr}`.trim();
    const body = (c.mejlText ?? "").trim() || defaultMailText(c.erRef);
    window.location.href = `mailto:${encodeURIComponent(c.epost)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setToast("Mejlprogrammet öppnas – glöm inte bifoga avtalet (PDF)");
  };

  return (
    <div className="min-h-screen">
      <div className="no-print pb-28">
        <header className="sticky top-0 z-10 px-3 pt-3">
          <div className="glass mx-auto max-w-2xl rounded-3xl">
          <div className="flex items-center gap-3 px-4 py-3">
            <img src="/icon-512.png" alt="" className="h-9 w-9 rounded-xl shadow" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold leading-tight text-foreground">{c.bestallare || "Nytt avtal"}</h1>
              <p className="text-xs text-muted-foreground">
                {c.avtalNr ? `Avtal ${c.avtalNr}` : "Inget avtalsnummer"}{currentVersion ? ` · v${currentVersion}` : ""}
              </p>
            </div>
            <div className="hidden shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold tabular-nums text-primary sm:block">
              {k.totalQty} objekt · {fmtKr(k.perYear)}/år
            </div>
            <button onClick={() => setConfirmNew(true)} aria-label="Nytt avtal" title="Nytt avtal"
              className="shrink-0 rounded-xl border border-glass-border bg-glass-strong p-2 text-muted-foreground transition hover:text-primary"><Plus size={18} /></button>
          </div>
          <nav className="mx-3 mb-3 flex gap-1 overflow-x-auto rounded-2xl bg-foreground/5 p-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition ${tab === t.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {t.label}
              </button>
            ))}
          </nav>
          </div>
          <p className="mt-2 text-center text-xs font-semibold tabular-nums text-muted-foreground sm:hidden">{k.totalQty} objekt · {fmtKr(k.perYear)}/år</p>
        </header>

        <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
          {tab === "kund" && (
            <>
              <Card title="Avtal">
                <div className="grid grid-cols-3 gap-2">
                  <TextField label="Avtal nr" value={c.avtalNr} onChange={(v) => setC({ avtalNr: v })} />
                  <TextField label="Datum" type="date" value={c.datum} onChange={(v) => setC({ datum: v })} />
                  <TextField label="Rev." value={c.rev} onChange={(v) => setC({ rev: v })} />
                </div>
              </Card>
              <Card title="Avtal mellan parter">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <TextField label="Beställare" value={c.bestallare} onChange={(v) => setC({ bestallare: v })} placeholder="T.ex. AB Exempel" />
                  <TextField label="Org.nr" value={c.orgNr} onChange={(v) => setC({ orgNr: v })} />
                  <TextField label="Vår referens" value={c.varRef} onChange={(v) => setC({ varRef: v })} />
                </div>
              </Card>
              <Card title="Kund- & fakturauppgifter">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <TextField label="Er referens" value={c.erRef} onChange={(v) => setC({ erRef: v })} />
                  <TextField label="Befattning" value={c.befattning} onChange={(v) => setC({ befattning: v })} />
                  <TextField label="Telefon" type="tel" value={c.telefon} onChange={(v) => setC({ telefon: v })} />
                  <TextField label="E-post (mejlas hit)" type="email" value={c.epost} onChange={(v) => setC({ epost: v })} />
                  <TextField label="Adress" value={c.adress} onChange={(v) => setC({ adress: v })} />
                  <TextField label="Postnummer/Ort" value={c.postort} onChange={(v) => setC({ postort: v })} />
                  <TextField label="Märkning faktura" value={c.markning} onChange={(v) => setC({ markning: v })} />
                  <TextField label="E-post faktura" type="email" value={c.epostFaktura} onChange={(v) => setC({ epostFaktura: v })} />
                </div>
              </Card>
              <Card title="Mejltext till kund">
                <textarea
                  className="min-h-40 w-full rounded-md border border-input bg-background p-2 text-sm text-foreground"
                  value={c.mejlText ?? defaultMailText(c.erRef)}
                  onChange={(e) => setC({ mejlText: e.target.value })}
                />
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Inga priser eller signatur – din egen signatur läggs till av mejlprogrammet.</span>
                  <button type="button" className="underline" onClick={() => setC({ mejlText: undefined })}>Återställ</button>
                </div>
              </Card>
              <Card title="Anläggning">
                <div className="grid grid-cols-1 gap-2">
                  <TextField label="Objekt" value={c.anlObjekt} onChange={(v) => setC({ anlObjekt: v })} />
                  <TextField label="Adress" value={c.anlAdress} onChange={(v) => setC({ anlAdress: v })} />
                  <TextField label="Kontaktperson" value={c.kontaktperson} onChange={(v) => setC({ kontaktperson: v })} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Antal objekt ({k.totalQty}) och servicebesök/år ({k.maxVisits}) fylls i automatiskt.</p>
              </Card>
            </>
          )}

          {tab === "forsatt" && (
            <>
              <Card title="Försättsblad">
                <div className="space-y-2">
                  <TextField label="Kundnamn" value={c.bestallare} onChange={(v) => setC({ bestallare: v })} placeholder="T.ex. AB Exempel" />
                  <TextField label="Adress" value={c.anlAdress} onChange={(v) => setC({ anlAdress: v })} placeholder="T.ex. Portgatan 1, Göteborg" />
                  <TextField label="Objekt" value={c.anlObjekt} onChange={(v) => setC({ anlObjekt: v })} placeholder="T.ex. Portar vid lastbrygga" />
                  <TextField label="Beskrivning" value={c.coverTitle} onChange={(v) => setC({ coverTitle: v })} placeholder="T.ex. Service av portar" />
                  <TextField label="Offertnummer" value={c.avtalNr} onChange={(v) => setC({ avtalNr: v })} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Slogan, loggor och rubriken ”Förebyggande Underhållsavtal” följer originalet och ändras inte.</p>
              </Card>
              <div className="-mx-4 overflow-x-auto">
                <div className="origin-top-left" style={{ zoom: "var(--doc-zoom, 0.45)" } as CSSProperties}>
                  <div className="doc-root"><CoverPreview a={a} /></div>
                </div>
              </div>
            </>
          )}

          {tab === "objekt" && (
            <Card title="Objekt">
              <div className="space-y-3">
                {a.rows.map((row, i) => (
                  <div key={row.id} className="rounded-2xl border border-glass-border bg-glass-strong p-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <input value={row.name} list="objekt-typer" onChange={(e) => updateRow(row.id, { name: e.target.value })} placeholder="Välj eller skriv, t.ex. Takskjutport" className={`min-w-0 flex-1 ${inputCls}`} />
                      <button onClick={() => setA((p) => { const idx = p.rows.findIndex((r) => r.id === row.id); const rows = [...p.rows]; rows.splice(idx + 1, 0, { ...row, id: newRow().id }); return { ...p, rows }; })}
                        aria-label={`Kopiera ${row.name || "objekt"}`} title="Kopiera objekt"
                        className="shrink-0 rounded-xl border border-input/70 bg-glass-strong p-2.5 text-muted-foreground transition hover:text-primary"><Copy size={16} /></button>
                      {a.rows.length > 1 && (
                        <button onClick={() => setA((p) => ({ ...p, rows: p.rows.filter((r) => r.id !== row.id) }))} aria-label={`Ta bort ${row.name || "objekt"}`}
                          className="shrink-0 rounded-xl border border-input/70 bg-glass-strong p-2.5 text-muted-foreground transition hover:text-destructive"><Trash2 size={16} /></button>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <NumField label="Antal" value={row.qty} onChange={(n) => updateRow(row.id, { qty: n })} />
                      <NumField label="Servicetid per st (min)" value={row.minutes} onChange={(n) => updateRow(row.id, { minutes: n })} />
                      <NumField label="Besök per år" value={row.visits} min={1} max={12} onChange={(n) => updateRow(row.id, { visits: n })} />
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <TextField label="Tillverkningsnummer" value={row.mfgNo} onChange={(v) => updateRow(row.id, { mfgNo: v })} />
                      <TextField label="Fabrikat" value={row.make} onChange={(v) => updateRow(row.id, { make: v })} />
                      <TextField label="Besiktningsnummer" value={row.inspNo} onChange={(v) => updateRow(row.id, { inspNo: v })} />
                    </div>
                    <label className="mt-2 block">
                      <span className="mb-1 block text-xs font-medium text-muted-foreground">Notering (intern – visas inte för kund)</span>
                      <textarea value={row.note} rows={2} onChange={(e) => updateRow(row.id, { note: e.target.value })} placeholder="T.ex. sitter mot godsmottagningen" className={inputCls} />
                    </label>
                    <p className="mt-2 text-xs text-muted-foreground">Styckespris: {fmtKr(Math.round((k.unitPrices[i] ?? 0) * 100) / 100)} per år</p>
                  </div>
                ))}
              </div>
              <datalist id="objekt-typer">{OBJEKT_TYPER.map((t) => <option key={t} value={t} />)}</datalist>
              <button onClick={() => setA((p) => ({ ...p, rows: [...p.rows, newRow()] }))} className={`mt-3 w-full ${btnPrimary}`}><Plus size={18} /> Lägg till objekt</button>
            </Card>
          )}

          {tab === "pris" && (
            <>
              <Card title="Rabatt & utjämning">
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="Rabatt på timpris (%)" value={a.discount} onChange={(n) => setA((p) => ({ ...p, discount: Math.min(100, n) }))} />
                  <TextField label="Utjämning per besök (kr)" value={a.adjust} placeholder="T.ex. 150 eller -893" onChange={(v) => setA((p) => ({ ...p, adjust: v }))} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Rabatten gäller bara arbetet, inte framkörningen. Skriv ett minus framför för att dra av, t.ex. -893 eller -1,50. Utjämningen läggs på varje servicebesök.</p>
              </Card>
              <Card title="Sammanställning per servicebesök">
                {k.visits.length === 0 && <p className="text-sm text-muted-foreground">Ange servicetid för objekten för att se priset.</p>}
                <div className="space-y-3">
                  {k.visits.map((v) => (
                    <div key={v.k} className="rounded-2xl border border-glass-border bg-glass-strong p-3">
                      <div className="flex items-baseline justify-between">
                        <h3 className="font-semibold text-foreground">{k.visits.length > 1 ? `Servicebesök ${v.k}` : "Servicebesök"}</h3>
                        <p className="text-lg font-bold tabular-nums text-primary">{fmtKr(v.perVisit)}</p>
                      </div>
                      <dl className="mt-2 space-y-1 text-sm">
                        {[
                          ["Total servicetid", `${fmtNum(v.hours)} h (${v.minutes} min)`],
                          [`Framkörning (${v.trips} × ${fmtKr(a.tripFee)})`, fmtKr(v.travel)],
                          ["Arbete brutto", fmtKr(v.laborGross)],
                          ...(a.discount > 0 ? [[`Rabatt ${fmtNum(a.discount)} %`, `−${fmtKr(v.laborGross - v.laborNet)}`]] : []),
                          ...(k.adjust !== 0 ? [["Utjämning", (k.adjust > 0 ? "+" : "−") + fmtKr(Math.abs(k.adjust))]] : []),
                        ].map(([l, val]) => (
                          <div key={l} className="flex items-baseline justify-between"><dt className="text-muted-foreground">{l}</dt><dd className="font-medium text-foreground">{val}</dd></div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-primary/10 p-4 text-center ring-1 ring-primary/20">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Per år exkl. moms</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-primary">{fmtKr(k.perYear)}</p>
                  <p className="mt-2 text-sm text-muted-foreground">5 år: <b className="text-foreground">{fmtKr(k.total5)}</b></p>
                </div>
              </Card>
              <Card title="Priser i avtalet (Bilaga 1)">
                <div className="space-y-2 text-sm">
                  {([["visit", "Per servicebesök"], ["year", "Per år"], ["total5", "Hela 5-årsperioden (används vid försäljning av port)"]] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input type="checkbox" checked={a.show[key]} onChange={(e) => setA((p) => ({ ...p, show: { ...p.show, [key]: e.target.checked } as Avtal["show"] }))} className="h-4 w-4 accent-primary" />
                      <span className="text-foreground">{label}</span>
                    </label>
                  ))}
                </div>
              </Card>
              <Card title="Prisuppgifter">
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="Timpeng (kr/h)" value={a.hourRate} onChange={(n) => setA((p) => ({ ...p, hourRate: n }))} />
                  <NumField label="Framkörning (kr)" value={a.tripFee} onChange={(n) => setA((p) => ({ ...p, tripFee: n }))} />
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Framkörning per 8 h</span>
                    <input value={1} readOnly className={`${inputCls} bg-muted`} />
                  </label>
                </div>
              </Card>
            </>
          )}

          {tab === "avtal" && <PdfPreview a={a} />}

          {tab === "sparade" && (
            <Card title="Sparade avtal per kund">
              <div className="relative mb-4">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sök kund eller avtalsnummer" className={`${inputCls} pl-9`} />
              </div>
              {Object.keys(store).length === 0 && <p className="text-sm text-muted-foreground">Inga sparade avtal ännu. Tryck "Spara version" nedan.</p>}
              <div className="space-y-4">
                {Object.values(store)
                  .map((f) => { const q = search.trim().toLowerCase(); return q && !f.name.toLowerCase().includes(q) ? { ...f, versions: f.versions.filter((v) => (v.data.customer.avtalNr || "").toLowerCase().includes(q)) } : f; })
                  .filter((f) => f.versions.length > 0)
                  .sort((x, y) => x.name.localeCompare(y.name, "sv")).map((f) => (
                  <div key={f.name}>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><FolderOpen size={16} className="text-primary" /> {f.name}</h3>
                    <ul className="space-y-1">
                      {[...f.versions].reverse().map((v) => (
                        <li key={v.version} className="flex flex-wrap items-center gap-2 rounded-2xl border border-glass-border bg-glass-strong px-3 py-2 text-sm">
                          <span className="font-semibold text-foreground">v{v.version}</span>
                          <span className="flex-1 truncate text-muted-foreground">
                            {new Date(v.savedAt).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })} · {fmtKr(calculate(normalizeAvtal(v.data)).perYear)} per år
                          </span>
                          <select value={v.status ?? "utkast"} aria-label="Status"
                            onChange={(e) => { setVersionStatus(f.name, v.version, e.target.value as Status); setStore(loadStore()); }}
                            className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold outline-none ${STATUS[v.status ?? "utkast"].cls}`}>
                            {(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                          </select>
                          <button className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
                            onClick={() => { setA(normalizeAvtal(v.data)); setCurrentVersion(v.version); setTab("kund"); setToast(`Öppnade ${f.name} v${v.version}`); }}>Öppna</button>
                          <button className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive" aria-label="Ta bort version"
                            onClick={() => { if (confirm(`Ta bort ${f.name} v${v.version}?`)) { deleteVersion(f.name, v.version); setStore(loadStore()); } }}><X size={14} /></button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <button className={`mt-4 w-full ${btnOutline}`} onClick={() => setConfirmNew(true)}>
                <RotateCcw size={16} /> Nytt avtal
              </button>
            </Card>
          )}
        </main>

        <div className="fixed inset-x-0 bottom-0 z-10 px-3 pb-3">
          <div className="glass mx-auto grid max-w-2xl grid-cols-4 gap-2 rounded-3xl p-2">
            <button onClick={onSave} className={`${btnOutline} flex-col gap-1 px-1 py-2 text-xs`}><Save size={18} />Spara</button>
            <button onClick={onPdf} className={`${btnOutline} flex-col gap-1 px-1 py-2 text-xs`}><FileText size={18} />PDF</button>
            <button onClick={() => downloadExcel(a, currentVersion)} className={`${btnOutline} flex-col gap-1 px-1 py-2 text-xs`}><FileSpreadsheet size={18} />Excel</button>
            <button onClick={openMail} className={`${btnPrimary} flex-col gap-1 px-1 py-2 text-xs`}><Mail size={18} />Mejla</button>
          </div>
        </div>
        <ConfirmDialog open={confirmNew} onCancel={() => setConfirmNew(false)} onConfirm={startNew} />
        {toast && <div className="fixed inset-x-4 bottom-28 z-20 mx-auto max-w-sm rounded-lg bg-foreground px-4 py-2 text-center text-sm text-background">{toast}</div>}
      </div>

      <div className="hidden print-only">
        <Preview a={a} />
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode, type CSSProperties } from "react";
import { CoverPreview, Preview } from "@/components/avtal/Preview";
import { type Avtal, type Customer, type ObjRow, calculate, emptyAvtal, fmtKr, fmtNum, newRow, normalizeAvtal, OBJEKT_TYPER } from "@/lib/kalkyl";
import { type CustomerFolder, type Status, deleteVersion, loadDraft, loadStore, saveDraft, saveVersion, setVersionStatus } from "@/lib/avtal-store";
import { Archive, Building2, ChevronDown, ChevronUp, Coins, Copy, Eye, FileCheck2, FileSpreadsheet, FileText, FolderOpen, Lock, Mail, Plus, RotateCcw, Save, Search, Trash2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lockApp } from "@/components/AppGate";
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
        <img key={i} src={src} alt={`Avtal sida ${i + 1}`} className="w-full rounded-md border border-border shadow-sm" />
      ))}
    </div>
  );
}


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Avtalskalkylator – UK Portservice" },
      { name: "description", content: "Gör hela avtalet för förebyggande underhåll: kund, objekt, pris, försättsblad och avtal som PDF och kalkyl som Excel." },
      { property: "og:title", content: "Avtalskalkylator – UK Portservice" },
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
const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: "kund", label: "Kund", icon: User },
  { id: "forsatt", label: "Försättsblad", icon: FileText },
  { id: "objekt", label: "Objekt", icon: Building2 },
  { id: "pris", label: "Pris", icon: Coins },
  { id: "avtal", label: "Avtal", icon: FileCheck2 },
  { id: "sparade", label: "Sparade", icon: Archive },
];

const inputCls = "ds-input";
const btnPrimary = "bg-primary text-primary-foreground hover:bg-primary/90";
const btnOutline = "border border-border bg-card text-info hover:bg-accent hover:text-info";

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
    <section className="ds-section">
      <h2 className="ds-section-title">{title}</h2>
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
      <div role="dialog" aria-modal="true" className="ds-dialog w-full max-w-sm rounded-lg border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><RotateCcw size={22} /></div>
        <h2 className="font-display text-lg font-bold text-foreground">Vill du verkligen börja om?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Allt du fyllt i rensas. Osparade ändringar försvinner, men sparade versioner ligger kvar.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="ghost" className={`${btnOutline} py-2.5`} onClick={onCancel}>Avbryt</Button>
          <Button variant="ghost" className="rounded-md bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground" onClick={onConfirm}>Ja, börja om</Button>
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
  const [openId, setOpenId] = useState<string | null>(null);
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

  const openMail = async () => {
    const subject = `Avtalsförslag ${c.avtalNr}`.trim();
    const body = (c.mejlText ?? "").trim() || defaultMailText(c.erRef);
    // Telefon/surfplatta: dela-menyn med PDF:en bifogad. Dator: vanligt mailto.
    const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (touch && nav.share) {
      try {
        const bytes = await buildAvtalPdf(a);
        const file = new File([bytes as BlobPart], `Avtal_${fileBase(a, currentVersion)}.pdf`, { type: "application/pdf" });
        if (nav.canShare?.({ files: [file] })) {
          await nav.share({ files: [file], title: subject, text: body });
          return;
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    window.location.href = `mailto:${encodeURIComponent(c.epost)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setToast("Mejlprogrammet öppnas – glöm inte bifoga avtalet (PDF)");
  };


  return (
    <div className="min-h-screen">
      <div className="no-print flex min-h-screen bg-background sm:p-3 sm:gap-3">
        {/* Sidomeny */}
        <nav aria-label="Avtalssteg" className="ds-glass-nav sticky top-0 z-20 flex h-screen w-14 shrink-0 flex-col items-center gap-4 py-6 sm:top-3 sm:h-[calc(100vh-1.5rem)] sm:w-[72px] sm:rounded-2xl">
          <img src="/icon-512.png" alt="UK Portservice" className="mb-4 h-10 w-10 shrink-0 object-contain" />
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <Button variant="glassNavigation"
                key={t.id}
                onClick={() => setTab(t.id)}
                title={t.label}
                aria-label={t.label}
                aria-current={active ? "page" : undefined}
                className="h-10 w-10 shrink-0 p-0 [&_svg]:size-5"
              >
                <Icon size={19} strokeWidth={active ? 2.3 : 1.9} />
              </Button>
            );
          })}
          <Button variant="glassNavigation"
            onClick={() => lockApp()}
            title="Lås appen"
            aria-label="Lås appen"
            className="mt-auto h-10 w-10 shrink-0 p-0 [&_svg]:size-5"
          >
            <Lock size={19} />
          </Button>
        </nav>

        {/* Innehåll */}
        <div className="flex min-w-0 flex-1 flex-col bg-card sm:rounded-2xl sm:border sm:border-border sm:shadow-[var(--shadow-panel)]">
          <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur sm:rounded-t-2xl">
            <div className="w-full px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{TABS.find((t) => t.id === tab)?.label}</span> · Avtal{c.avtalNr ? ` / ${c.avtalNr}` : ""}{currentVersion ? ` · v${currentVersion}` : ""}</p>
                  <h1 className="mt-1 break-words font-display text-xl font-semibold text-foreground sm:text-2xl">{c.bestallare || "Nytt avtal"}</h1>
                </div>
                <dl aria-label="Avtalssammanfattning" className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] gap-3 border-t border-border pt-3 tabular-nums sm:w-auto sm:grid-cols-[auto_auto_auto] sm:gap-8 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                  <div><dt className="text-xs font-semibold text-muted-foreground">Objekt</dt><dd className="mt-1 font-display text-base font-semibold text-foreground sm:text-lg">{fmtNum(k.totalQty)} st</dd></div>
                  <div><dt className="text-xs font-semibold text-muted-foreground">Servicetid</dt><dd className="mt-1 font-display text-base font-semibold text-foreground sm:text-lg">{fmtNum(k.totalMinutes / 60)} h</dd></div>
                  <div><dt className="text-xs font-semibold text-muted-foreground">Pris/år</dt><dd className="mt-1 break-words font-display text-base font-semibold text-info sm:text-lg">{fmtKr(k.perYear)}</dd></div>
                </dl>
              </div>
              <div className="mt-4 flex items-center justify-end gap-3">
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="ghost" onClick={() => setTab("avtal")} className="hidden h-9 gap-1.5 px-3 text-sm text-muted-foreground hover:text-foreground md:inline-flex"><Eye size={16} />Förhandsgranska</Button>
                  <Button variant="ghost" onClick={onSave} className="hidden h-9 gap-1.5 border border-border bg-card px-3 text-sm text-foreground hover:bg-muted sm:inline-flex"><Save size={16} />Spara</Button>
                  <Button variant="ghost" onClick={onPdf} className="hidden h-9 gap-1.5 border border-border bg-card px-3 text-sm text-foreground hover:bg-muted sm:inline-flex"><FileText size={16} />PDF</Button>
                  <Button variant="ghost" onClick={() => downloadExcel(a, currentVersion)} className="hidden h-9 gap-1.5 border border-border bg-card px-3 text-sm text-foreground hover:bg-muted sm:inline-flex"><FileSpreadsheet size={16} />Excel</Button>
                  <Button variant="ghost" onClick={openMail} className={`hidden h-9 gap-1.5 px-3 text-sm font-semibold sm:inline-flex ${btnPrimary}`}><Mail size={16} />Mejla</Button>
                  <Button variant="ghost" onClick={() => setConfirmNew(true)} aria-label="Nytt avtal" title="Nytt avtal"
                    className="h-9 w-9 border border-border bg-card p-0 text-foreground hover:bg-muted"><Plus size={18} /></Button>
                </div>
              </div>
            </div>
          </header>

          <main className="w-full flex-1 space-y-4 px-4 py-5 pb-28 sm:pb-8">
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
                    className="min-h-40 w-full rounded-md border border-input bg-card p-2 text-sm text-foreground"
                    value={c.mejlText ?? defaultMailText(c.erRef)}
                    onChange={(e) => setC({ mejlText: e.target.value })}
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Inga priser eller signatur – din egen signatur läggs till av mejlprogrammet.</span>
                    <Button variant="ghost" type="button" className="text-info underline" onClick={() => setC({ mejlText: undefined })}>Återställ</Button>
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
              <section className="ds-panel">
                <h2 className="font-display text-[15px] font-semibold text-foreground">Objekt</h2>
                <p className="mb-4 text-xs text-muted-foreground">Lägg till portar och utrustning som ingår i avtalet.</p>
                <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {a.rows.map((row, i) => {
                    const isOpen = (openId ?? a.rows[a.rows.length - 1]?.id) === row.id;
                    const rowPrice = Math.round((k.unitPrices[i] ?? 0) * row.qty * 100) / 100;
                    if (!isOpen) return (
                      <div key={row.id} className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-glass)] transition hover:border-ring/40 hover:shadow-[var(--shadow-panel)]">
                        <button type="button" onClick={() => setOpenId(row.id)} aria-expanded={false} aria-label={`Redigera ${row.name || "objekt"}`}
                          className="flex w-full flex-col items-start gap-1.5 text-left">
                          <span className="flex w-full items-center justify-between">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">{i + 1}</span>
                            <ChevronDown size={16} className="text-muted-foreground" />
                          </span>
                          <span className="block w-full truncate text-sm font-semibold text-foreground">{row.name || "Namnlöst objekt"}{row.qty > 1 && <span className="font-normal text-muted-foreground"> × {row.qty}</span>}</span>
                          <span className="block text-xs tabular-nums text-muted-foreground">{row.minutes} min/besök · {row.visits} besök/år</span>
                          <span className="rounded-md bg-accent px-2.5 py-1 text-sm font-semibold tabular-nums text-accent-foreground">{fmtKr(rowPrice)}</span>
                        </button>
                      </div>
                    );
                    return (
                    <div key={row.id} className="objekt-open col-span-full rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-glass)]">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setOpenId("")} aria-expanded aria-label="Fäll ihop objekt"
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground hover:bg-accent"><ChevronUp size={14} /></button>
                        <div className="relative min-w-0 flex-1">
                          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input value={row.name} list="objekt-typer" onChange={(e) => updateRow(row.id, { name: e.target.value })} placeholder="Välj eller skriv, t.ex. Takskjutport" className={`${inputCls} pl-9 font-medium`} />
                        </div>
                        <span className="hidden shrink-0 rounded-md bg-accent px-2.5 py-1.5 text-sm font-semibold tabular-nums text-accent-foreground sm:block">{fmtKr(Math.round((k.unitPrices[i] ?? 0) * 100) / 100)}/år</span>
                        <Button variant="ghost" onClick={() => setA((p) => { const idx = p.rows.findIndex((r) => r.id === row.id); const rows = [...p.rows]; rows.splice(idx + 1, 0, { ...row, id: newRow().id }); return { ...p, rows }; })}
                          aria-label={`Kopiera ${row.name || "objekt"}`} title="Kopiera objekt"
                          className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"><Copy size={16} /></Button>
                        {a.rows.length > 1 && (
                          <Button variant="ghost" onClick={() => setA((p) => ({ ...p, rows: p.rows.filter((r) => r.id !== row.id) }))} aria-label={`Ta bort ${row.name || "objekt"}`}
                            className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 size={16} /></Button>
                        )}
                      </div>
                      <div className="objekt-body">
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <NumField label="Antal" value={row.qty} onChange={(n) => updateRow(row.id, { qty: n })} />
                        <NumField label="Servicetid/st (min)" value={row.minutes} onChange={(n) => updateRow(row.id, { minutes: n })} />
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
                      <p className="mt-2 text-xs text-muted-foreground sm:hidden">Styckespris: {fmtKr(Math.round((k.unitPrices[i] ?? 0) * 100) / 100)} per år</p>
                      </div>
                    </div>
                  ); })}
                </div>
                <datalist id="objekt-typer">{OBJEKT_TYPER.map((t) => <option key={t} value={t} />)}</datalist>
                <button type="button" onClick={() => { const r = newRow(); setOpenId(r.id); setA((p) => ({ ...p, rows: [...p.rows, r] })); }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent py-2.5 text-sm font-medium text-accent-foreground transition hover:bg-accent/70">
                  <Plus size={16} /> Lägg till objekt
                </button>
                <dl className="mt-3 ml-auto max-w-sm divide-y divide-border overflow-hidden rounded-xl border border-border bg-card text-sm">
                  <div className="flex justify-between px-4 py-2.5"><dt className="text-muted-foreground">Antal objekt</dt><dd className="tabular-nums text-foreground">{k.totalQty}</dd></div>
                  <div className="flex justify-between px-4 py-2.5"><dt className="text-muted-foreground">Servicebesök per år</dt><dd className="tabular-nums text-foreground">{k.maxVisits}</dd></div>
                  <div className="flex justify-between px-4 py-3"><dt className="font-semibold text-foreground">Totalt per år</dt><dd className="font-semibold tabular-nums text-foreground">{fmtKr(k.perYear)}</dd></div>
                </dl>
              </section>
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
                      <div key={v.k} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                        <div className="flex items-baseline justify-between">
                          <h3 className="font-semibold text-foreground">{k.visits.length > 1 ? `Servicebesök ${v.k}` : "Servicebesök"}</h3>
                          <p className="text-lg font-bold tabular-nums text-foreground">{fmtKr(v.perVisit)}</p>
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
                  <div className="mt-4 rounded-xl border-t-4 border-primary bg-muted p-4 text-center">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Per år exkl. moms</p>
                    <p className="mt-1 font-display text-3xl font-bold tabular-nums text-foreground">{fmtKr(k.perYear)}</p>
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
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><FolderOpen size={16} className="text-info" /> {f.name}</h3>
                      <ul className="space-y-1">
                        {[...f.versions].reverse().map((v) => (
                          <li key={v.version} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm">
                            <span className="font-semibold text-foreground">v{v.version}</span>
                            <span className="flex-1 truncate text-muted-foreground">
                              {new Date(v.savedAt).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })} · {fmtKr(calculate(normalizeAvtal(v.data)).perYear)} per år
                            </span>
                            <select value={v.status ?? "utkast"} aria-label="Status"
                              onChange={(e) => { setVersionStatus(f.name, v.version, e.target.value as Status); setStore(loadStore()); }}
                              className={`ds-badge outline-none ${STATUS[v.status ?? "utkast"].cls}`}>
                              {(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                            </select>
                            <Button variant="ghost" className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-info"
                              onClick={() => { setA(normalizeAvtal(v.data)); setCurrentVersion(v.version); setTab("kund"); setToast(`Öppnade ${f.name} v${v.version}`); }}>Öppna</Button>
                            <Button variant="ghost" className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive" aria-label="Ta bort version"
                              onClick={() => { if (confirm(`Ta bort ${f.name} v${v.version}?`)) { deleteVersion(f.name, v.version); setStore(loadStore()); } }}><X size={14} /></Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" className={`mt-4 w-full ${btnOutline}`} onClick={() => setConfirmNew(true)}>
                  <RotateCcw size={16} /> Nytt avtal
                </Button>
              </Card>
            )}
          </main>

          {/* Fast åtgärdsrad */}
          <div className="fixed bottom-0 left-14 right-0 z-10 border-t border-border bg-card px-3 py-2 sm:hidden">
            <div className="mx-auto grid max-w-2xl grid-cols-4 gap-2">
              <Button variant="ghost" onClick={onSave} className={`${btnOutline} h-auto min-h-12 flex-col gap-1 px-1 py-2 text-xs`}><Save size={18} />Spara</Button>
              <Button variant="ghost" onClick={onPdf} className={`${btnOutline} h-auto min-h-12 flex-col gap-1 px-1 py-2 text-xs`}><FileText size={18} />PDF</Button>
              <Button variant="ghost" onClick={() => downloadExcel(a, currentVersion)} className={`${btnOutline} h-auto min-h-12 flex-col gap-1 px-1 py-2 text-xs`}><FileSpreadsheet size={18} />Excel</Button>
              <Button variant="ghost" onClick={openMail} className={`${btnPrimary} h-auto min-h-12 flex-col gap-1 px-1 py-2 text-xs`}><Mail size={18} />Mejla</Button>
            </div>
          </div>
        </div>

        <ConfirmDialog open={confirmNew} onCancel={() => setConfirmNew(false)} onConfirm={startNew} />
        {toast && <div className="fixed inset-x-4 bottom-24 z-20 mx-auto max-w-sm rounded-lg bg-foreground px-4 py-2 text-center text-sm text-background">{toast}</div>}
      </div>

      <div className="hidden print-only">
        <Preview a={a} />
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode, type CSSProperties } from "react";
import { CoverPreview, Preview } from "@/components/avtal/Preview";
import { type Avtal, type Customer, type ObjRow, calculate, emptyAvtal, fmtKr, fmtNum, newRow, normalizeAvtal } from "@/lib/kalkyl";
import { type CustomerFolder, deleteVersion, loadDraft, loadStore, saveDraft, saveVersion } from "@/lib/avtal-store";
import { downloadExcel, fileBase } from "@/lib/excel";

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

const inputCls = "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";
const btnPrimary = "rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90";
const btnOutline = "rounded-lg border border-input px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 font-semibold text-foreground">{title}</h2>
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
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input type="number" min={min} max={max} inputMode="decimal" value={value} onChange={(e) => { let n = Number(e.target.value) || 0; if (max !== undefined) n = Math.min(max, n); onChange(Math.max(min, n)); }} className={inputCls} />
    </label>
  );
}

function App() {
  const [a, setA] = useState<Avtal>(emptyAvtal);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("kund");
  const [store, setStore] = useState<Record<string, CustomerFolder>>({});
  const [currentVersion, setCurrentVersion] = useState<number | undefined>();
  const [toast, setToast] = useState("");

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

  const onPdf = () => {
    const prev = document.title;
    document.title = `Avtal_${fileBase(a, currentVersion)}`;
    setTab("avtal");
    setTimeout(() => { window.print(); document.title = prev; }, 150);
  };

  const openMail = () => {
    const subject = `Avtalsförslag ${c.avtalNr}`.trim();
    const lines = [
      `Hej${c.erRef ? " " + c.erRef : ""}!`,
      "",
      "Tack för att ni valt UK Portservice!",
      "",
      "Här kommer ert avtalsförslag för förebyggande underhåll. Avtalet och kalkylen finns bifogade i detta mejl.",
      "",
      `Avtalet omfattar ${k.totalQty} objekt med ${k.maxVisits} servicebesök per år.`,
      ...k.visits.map((v) => `${k.visits.length > 1 ? `Servicebesök ${v.k}` : "Kostnad per servicebesök"}: ${fmtKr(v.perVisit)} exkl. moms.`),
      `Kostnad per år: ${fmtKr(k.perYear)} exkl. moms.`,
      "",
      "Återkom gärna om ni har frågor eller vill justera något.",
      "",
      "Med vänliga hälsningar,",
      c.varRef || "",
      "UK Portservice AB",
      "Tel 031-23 08 60 · info@ukportservice.se",
    ];
    window.location.href = `mailto:${encodeURIComponent(c.epost)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="no-print pb-28">
        <header className="sticky top-0 z-10 border-b border-border bg-card">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
            <img src="/icon-512.png" alt="" className="h-8 w-8 rounded-lg" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-foreground">{c.bestallare || "Nytt avtal"}</h1>
              <p className="text-xs text-muted-foreground">
                {c.avtalNr ? `Avtal ${c.avtalNr}` : "Inget avtalsnummer"}{currentVersion ? ` · v${currentVersion}` : ""}
              </p>
            </div>
          </div>
          <nav className="mx-auto flex max-w-2xl overflow-x-auto px-2">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
                {t.label}
              </button>
            ))}
          </nav>
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
                  <div key={row.id} className="rounded-xl border border-border bg-background/60 p-3">
                    <div className="flex items-center gap-2">
                      <input value={row.name} onChange={(e) => updateRow(row.id, { name: e.target.value })} placeholder="Objektnamn, t.ex. Port A1" className={`min-w-0 flex-1 ${inputCls}`} />
                      {a.rows.length > 1 && (
                        <button onClick={() => setA((p) => ({ ...p, rows: p.rows.filter((r) => r.id !== row.id) }))} aria-label={`Ta bort ${row.name || "objekt"}`}
                          className="shrink-0 rounded-lg border border-input px-2.5 py-2 text-sm text-muted-foreground hover:text-destructive">✕</button>
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
                    <p className="mt-2 text-xs text-muted-foreground">Styckespris: {fmtKr(Math.round((k.unitPrices[i] ?? 0) * 100) / 100)} per år</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setA((p) => ({ ...p, rows: [...p.rows, newRow()] }))} className={`mt-3 w-full ${btnPrimary}`}>+ Lägg till objekt</button>
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
                    <div key={v.k} className="rounded-xl border border-border p-3">
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
                <div className="mt-4 rounded-xl bg-primary/10 p-4 text-center ring-1 ring-primary/20">
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

          {tab === "avtal" && (
            <div className="-mx-4 overflow-x-auto">
              <div className="origin-top-left" style={{ zoom: "var(--doc-zoom, 0.45)" } as CSSProperties}>
                <Preview a={a} />
              </div>
            </div>
          )}

          {tab === "sparade" && (
            <Card title="Sparade avtal per kund">
              {Object.keys(store).length === 0 && <p className="text-sm text-muted-foreground">Inga sparade avtal ännu. Tryck "Spara version" nedan.</p>}
              <div className="space-y-4">
                {Object.values(store).sort((x, y) => x.name.localeCompare(y.name, "sv")).map((f) => (
                  <div key={f.name}>
                    <h3 className="mb-1 text-sm font-semibold text-foreground">📁 {f.name}</h3>
                    <ul className="space-y-1">
                      {[...f.versions].reverse().map((v) => (
                        <li key={v.version} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                          <span className="font-semibold text-foreground">v{v.version}</span>
                          <span className="flex-1 truncate text-muted-foreground">
                            {new Date(v.savedAt).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })} · {fmtKr(calculate(normalizeAvtal(v.data)).perYear)} per år
                          </span>
                          <button className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
                            onClick={() => { setA(normalizeAvtal(v.data)); setCurrentVersion(v.version); setTab("kund"); setToast(`Öppnade ${f.name} v${v.version}`); }}>Öppna</button>
                          <button className="rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => { if (confirm(`Ta bort ${f.name} v${v.version}?`)) { deleteVersion(f.name, v.version); setStore(loadStore()); } }}>✕</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <button className={`mt-4 w-full ${btnOutline}`} onClick={() => { if (confirm("Börja på ett nytt tomt avtal? Osparade ändringar försvinner.")) { setA(emptyAvtal()); setCurrentVersion(undefined); setTab("kund"); } }}>
                + Nytt avtal
              </button>
            </Card>
          )}
        </main>

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto grid max-w-2xl grid-cols-4 gap-2 px-3 py-2">
            <button onClick={onSave} className={`${btnOutline} px-1 py-2 text-xs`}>💾 Spara version</button>
            <button onClick={onPdf} className={`${btnOutline} px-1 py-2 text-xs`}>📄 PDF</button>
            <button onClick={() => downloadExcel(a, currentVersion)} className={`${btnOutline} px-1 py-2 text-xs`}>📊 Excel</button>
            <button onClick={openMail} className={`${btnPrimary} px-1 py-2 text-xs`}>✉ Mejla</button>
          </div>
        </div>
        {toast && <div className="fixed inset-x-4 bottom-20 z-20 mx-auto max-w-sm rounded-lg bg-foreground px-4 py-2 text-center text-sm text-background">{toast}</div>}
      </div>

      <div className="hidden print-only">
        <Preview a={a} />
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Mail, Phone, Plus, Trash2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculate, fmtKr, normalizeAvtal } from "@/lib/kalkyl";
import { addNote, customerKey, deleteNote, setCustomerContacts, type Contact, type CustomerFolder, type Version } from "@/lib/avtal-store";
import { Tidslinje, type LogItem } from "./Aktivitet";

const STATUS: Record<"signerat" | "skickat" | "utkast", { t: string; cls: string }> = {
  signerat: { t: "Signerat", cls: "bg-success/15 text-success" },
  skickat: { t: "Väntar på svar", cls: "bg-info/15 text-info" },
  utkast: { t: "Utkast", cls: "bg-muted text-muted-foreground" },
};

/** 360°-vy av en kund: alla avtal, kontaktpersoner och samlad tidslinje. */
export function KundKort({ name, store, onClose, onOpen, onChanged }: {
  name: string; store: Record<string, CustomerFolder>; onClose: () => void;
  onOpen: (id: string, name: string, v: Version) => void; onChanged: () => void;
}) {
  const folders = useMemo(() => Object.values(store).filter((f) => f.versions.length && customerKey(f.name) === customerKey(name)), [store, name]);
  const avtal = folders.map((f) => {
    const v = f.versions.at(-1)!;
    const a = normalizeAvtal(v.data);
    return { f, v, a, perYear: calculate(a).perYear, status: v.status ?? "utkast" };
  });
  const signedSum = avtal.filter((x) => x.status === "signerat").reduce((t, x) => t + x.perYear, 0);
  const totalSum = avtal.reduce((t, x) => t + x.perYear, 0);

  // Kontakter: sparade, annars förslag från avtalets kontaktuppgifter.
  const saved = folders.find((f) => f.contacts?.length)?.contacts;
  const suggested = useMemo<Contact[]>(() => {
    const seen = new Set<string>(); const out: Contact[] = [];
    for (const { a } of avtal) {
      const c = a.customer; const n = (c.erRef || c.kontaktperson || "").trim();
      if (!n || seen.has(n.toLowerCase())) continue;
      seen.add(n.toLowerCase());
      out.push({ id: crypto.randomUUID(), name: n, roll: c.befattning ?? "", tel: c.telefon ?? "", epost: c.epost ?? "" });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders]);
  const [contacts, setContacts] = useState<Contact[]>(saved ?? suggested);
  const [dirty, setDirty] = useState(!saved && suggested.length > 0);
  const upd = (id: string, p: Partial<Contact>) => { setContacts((l) => l.map((c) => (c.id === id ? { ...c, ...p } : c))); setDirty(true); };
  const saveContacts = () => { setCustomerContacts(name, contacts.filter((c) => c.name.trim() || c.tel.trim() || c.epost.trim())); setDirty(false); onChanged(); };

  const log: LogItem[] = folders.flatMap((f) => {
    const nr = normalizeAvtal(f.versions.at(-1)!.data).customer.avtalNr;
    return (f.log ?? []).map((x) => ({ ...x, postId: f.id, avtal: nr ? `Avtal ${nr}` : undefined }));
  });
  const newest = [...avtal].sort((x, y) => y.v.savedAt.localeCompare(x.v.savedAt))[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/30 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Kundkort ${name}`}>
      <div onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-background shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kundkort</p>
            <h2 className="truncate font-display text-xl font-bold text-foreground">{name}</h2>
          </div>
          <button onClick={onClose} aria-label="Stäng" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={18} /></button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-2">
            {[["Avtal", String(avtal.length)], ["Signerat / år", fmtKr(signedSum)], ["Totalt / år", fmtKr(totalSum)]].map(([l, v]) => (
              <div key={l} className="min-w-0 rounded-xl border border-border bg-card p-3">
                <p className="truncate text-xs font-semibold text-muted-foreground">{l}</p>
                <p className="truncate font-display text-lg font-bold tabular-nums text-foreground">{v}</p>
              </div>
            ))}
          </div>

          <section className="ds-panel space-y-2">
            <h3 className="font-display text-[15px] font-semibold text-foreground">Avtal</h3>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {avtal.map(({ f, v, a, perYear, status }) => (
                <li key={f.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3">
                  <button className="min-w-0 text-left" onClick={() => onOpen(f.id, f.name, v)}>
                    <p className="truncate text-sm font-medium text-foreground">{a.customer.avtalNr ? `Nr ${a.customer.avtalNr}` : "Inget avtalsnr"} <span className="text-xs text-muted-foreground">v{v.version}</span></p>
                    <p className="truncate text-xs text-muted-foreground">{a.customer.anlAdress || "Ingen adress"} · {fmtKr(perYear)}/år</p>
                  </button>
                  <span className={`ds-badge ${STATUS[status].cls}`}>{STATUS[status].t}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="ds-panel space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-[15px] font-semibold text-foreground">Kontaktpersoner</h3>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => { setContacts((l) => [...l, { id: crypto.randomUUID(), name: "", roll: "", tel: "", epost: "" }]); setDirty(true); }}><Plus size={14} />Lägg till</Button>
            </div>
            {contacts.length === 0 && <p className="text-sm text-muted-foreground">Inga kontaktpersoner ännu.</p>}
            {contacts.map((c) => (
              <div key={c.id} className="space-y-2 rounded-lg border border-border bg-card p-3">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                  <UserRound size={16} className="text-muted-foreground" />
                  <input className="ds-input" placeholder="Namn" value={c.name} onChange={(e) => upd(c.id, { name: e.target.value })} aria-label="Namn" />
                  <button onClick={() => { setContacts((l) => l.filter((x) => x.id !== c.id)); setDirty(true); }} aria-label="Ta bort kontakt" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 size={14} /></button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input className="ds-input" placeholder="Roll, t.ex. Fastighetschef" value={c.roll} onChange={(e) => upd(c.id, { roll: e.target.value })} aria-label="Roll" />
                  <input className="ds-input" type="tel" placeholder="Telefon" value={c.tel} onChange={(e) => upd(c.id, { tel: e.target.value })} aria-label="Telefon" />
                  <input className="ds-input" type="email" placeholder="E-post" value={c.epost} onChange={(e) => upd(c.id, { epost: e.target.value })} aria-label="E-post" />
                </div>
                {(c.tel || c.epost) && (
                  <div className="flex flex-wrap gap-2">
                    {c.tel && <a href={`tel:${c.tel.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 rounded-lg bg-success/15 px-3 py-1.5 text-xs font-semibold text-success"><Phone size={13} />Ring</a>}
                    {c.epost && <a href={`mailto:${c.epost}`} className="inline-flex items-center gap-1.5 rounded-lg bg-info/15 px-3 py-1.5 text-xs font-semibold text-info"><Mail size={13} />Mejla</a>}
                  </div>
                )}
              </div>
            ))}
            {dirty && <Button onClick={saveContacts} className="w-full">Spara kontaktpersoner</Button>}
          </section>

          <section className="ds-panel space-y-2">
            <h3 className="font-display text-[15px] font-semibold text-foreground">Aktivitetslogg</h3>
            <Tidslinje items={log}
              onAdd={newest ? (t) => { addNote(newest.f.id, t); onChanged(); } : undefined}
              onDelete={(pid, id) => { deleteNote(pid, id); onChanged(); }} />
          </section>
        </div>
      </div>
    </div>
  );
}

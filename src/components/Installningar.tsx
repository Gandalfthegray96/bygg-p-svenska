import { useEffect, useState } from "react";
import { Bell, Hash, Info, Phone, KeyRound, LogOut, Settings, User, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { enablePush, pushSupported } from "@/lib/push";
import { loadLastNr, nextAvtalNr, saveLastNr } from "@/lib/avtalsnr";
import { lockApp } from "./AppGate";
import { loadKontakt, saveKontakt } from "@/lib/kontakt";
import { Bilagor } from "./Bilagor";
import { Calculator } from "lucide-react";
import { getSettings, saveSettings, fmtPct } from "@/lib/foretag-settings";
import type { CustomerFolder } from "@/lib/avtal-store";

function Sektion({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-2 flex items-center gap-2 font-semibold text-foreground"><Icon size={17} />{title}</h3>
      {children}
    </section>
  );
}

export function Installningar({ open, onClose, isAdmin, onToast, onOpenUsers, onNameChange, store, onAttachmentsChanged }: {
  store: Record<string, CustomerFolder>; onAttachmentsChanged: () => void;
  open: boolean; onClose: () => void; isAdmin: boolean; onToast: (s: string) => void; onOpenUsers: () => void; onNameChange?: (n: string) => void;
}) {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [nr, setNr] = useState("");
  const [perm, setPerm] = useState<string>("default");
  const [busy, setBusy] = useState(false);
  const [tel, setTel] = useState("");
  const [kEpost, setKEpost] = useState("");
  const [version, setVersion] = useState("");
  const [sk, setSk] = useState({ timme: "", fk: "", idx: "" });

  useEffect(() => {
    if (!open) return;
    setNr(loadLastNr());
    { const g = getSettings(); setSk({ timme: String(g.kostnadTimme), fk: String(g.kostnadFramkorning), idx: fmtPct(g.indexPct) }); }
    { const k = loadKontakt(); setTel(k.telefon); setKEpost(k.epost); }
    fetch("/changelog.json", { cache: "no-store" }).then((r) => r.json()).then((j) => { const e = Array.isArray(j) ? j[0] : j?.entries?.[0] ?? j; setVersion(e?.datum ?? ""); }).catch(() => {});
    setPerm(pushSupported() ? Notification.permission : "unsupported");
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUid(data.user.id); setEmail(data.user.email ?? "");
      const { data: p } = await supabase.from("profiles").select("name").eq("id", data.user.id).maybeSingle();
      setName(p?.name ?? "");
    });
  }, [open]);

  const saveName = async () => {
    if (!uid || !name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ name: name.trim() }).eq("id", uid);
    setBusy(false);
    if (!error) { onNameChange?.(name.trim()); saveKontakt({ ...loadKontakt(), namn: name.trim() }); }
    onToast(error ? "Kunde inte spara namnet" : "Ditt namn är sparat");
  };
  const saveKontaktInfo = () => {
    saveKontakt({ namn: name.trim(), telefon: tel.trim(), epost: kEpost.trim() });
    onToast("Dina kontaktuppgifter är sparade");
  };
  const savePw = async () => {
    if (pw.length < 6) return onToast("Lösenordet måste ha minst 6 tecken");
    if (pw !== pw2) return onToast("Lösenorden matchar inte");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (!error) { setPw(""); setPw2(""); }
    onToast(error ? "Kunde inte byta lösenord: " + error.message : "Lösenordet är bytt");
  };
  const aktivera = async () => {
    setBusy(true);
    const ok = await enablePush(true).catch(() => false);
    setBusy(false);
    setPerm(Notification.permission);
    onToast(ok ? "Notiser är aktiverade på den här enheten" : "Notiser kunde inte aktiveras – kontrollera webbläsarens inställningar");
  };
  const testa = async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification("Testnotis", { body: "Notiserna fungerar på den här enheten 🎉", icon: "/icon-192.png" });
    else new Notification("Testnotis", { body: "Notiserna fungerar på den här enheten 🎉", icon: "/icon-192.png" });
  };
  const saveSk = async () => {
    const n = (x: string) => Number(x.replace(",", ".").replace(/\s/g, ""));
    const v = { kostnadTimme: n(sk.timme), kostnadFramkorning: n(sk.fk), indexPct: n(sk.idx) };
    if (![v.kostnadTimme, v.kostnadFramkorning, v.indexPct].every((x) => Number.isFinite(x) && x >= 0)) return onToast("Fyll i giltiga siffror");
    setBusy(true); const err = await saveSettings(v); setBusy(false);
    onToast(err ? "Kunde inte spara: " + err.message : "Sparat – gäller för alla användare");
  };
  const saveNr = () => {
    if (!nr.trim()) return;
    saveLastNr(nr);
    onToast(`Nästa nya avtal får nummer ${nextAvtalNr(nr) || "–"}`);
  };

  const permText: Record<string, string> = { granted: "Aktiverade på den här enheten", denied: "Blockerade i webbläsaren – tillåt notiser i webbläsarens inställningar", default: "Inte aktiverade ännu", unsupported: "Stöds inte av den här webbläsaren" };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings size={20} />Inställningar</DialogTitle>
          <DialogDescription>{email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Sektion icon={User} title="Mitt namn">
            <p className="mb-2 text-sm text-muted-foreground">Visas i chatten, notiser och när någon pingar dig.</p>
            <div className="flex gap-2">
              <input className="ds-input min-w-0 flex-1" value={name} placeholder="För- och efternamn" onChange={(e) => setName(e.target.value)} />
              <Button disabled={busy || !name.trim()} onClick={saveName}>Spara</Button>
            </div>
          </Sektion>
          <Sektion icon={Phone} title="Mina kontaktuppgifter">
            <p className="mb-2 text-sm text-muted-foreground">Ditt namn fylls i automatiskt under "Vår referens" när du skapar ett nytt avtal.</p>
            <div className="grid gap-2">
              <input className="ds-input" type="tel" placeholder="Direkttelefon" value={tel} onChange={(e) => setTel(e.target.value)} />
              <input className="ds-input" type="email" placeholder="E-post" value={kEpost} onChange={(e) => setKEpost(e.target.value)} />
              <Button variant="outline" onClick={saveKontaktInfo} className="justify-self-end">Spara</Button>
            </div>
          </Sektion>
          <Sektion icon={KeyRound} title="Byt lösenord">
            <div className="grid gap-2">
              <input type="password" className="ds-input" placeholder="Nytt lösenord" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
              <input type="password" className="ds-input" placeholder="Upprepa nytt lösenord" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
              <Button disabled={busy || !pw} onClick={savePw} className="justify-self-end">Byt lösenord</Button>
            </div>
          </Sektion>
          <Sektion icon={Bell} title="Notiser på den här enheten">
            <p className="mb-2 text-sm text-muted-foreground">{permText[perm] ?? perm}</p>
            <div className="flex flex-wrap gap-2">
              {perm !== "granted" && perm !== "unsupported" && <Button disabled={busy} onClick={aktivera}>Aktivera notiser</Button>}
              {perm === "granted" && <Button variant="outline" onClick={testa}>Skicka testnotis</Button>}
            </div>
          </Sektion>
          <Sektion icon={Hash} title="Mitt senaste avtalsnummer">
            <p className="mb-2 text-sm text-muted-foreground">Nästa nya avtal får nästa nummer automatiskt{nr && nextAvtalNr(nr) ? ` (${nextAvtalNr(nr)})` : ""}.</p>
            <div className="flex gap-2">
              <input className="ds-input min-w-0 flex-1" value={nr} placeholder="t.ex. ALS_A0114" onChange={(e) => setNr(e.target.value)} />
              <Button variant="outline" disabled={!nr.trim()} onClick={saveNr}>Spara</Button>
            </div>
          </Sektion>
          {isAdmin && (
            <Button variant="outline" className="w-full gap-2" onClick={() => { onClose(); onOpenUsers(); }}><Users size={16} />Hantera användare och roller</Button>
          )}
          {isAdmin && (
            <Sektion icon={Calculator} title="Självkostnad och indexreglering (admin)">
              <p className="mb-2 text-sm text-muted-foreground">Interna siffror för täckningsbidrag. Syns aldrig för kund.</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-xs text-muted-foreground">Kr per timme<input inputMode="decimal" className="ds-input mt-1" value={sk.timme} onChange={(e) => setSk({ ...sk, timme: e.target.value })} /></label>
                <label className="text-xs text-muted-foreground">Kr per framkörning<input inputMode="decimal" className="ds-input mt-1" value={sk.fk} onChange={(e) => setSk({ ...sk, fk: e.target.value })} /></label>
                <label className="text-xs text-muted-foreground">Standardindex %<input inputMode="decimal" className="ds-input mt-1" value={sk.idx} onChange={(e) => setSk({ ...sk, idx: e.target.value })} /></label>
              </div>
              <Button disabled={busy} onClick={saveSk} className="mt-2 w-full sm:w-auto">Spara</Button>
            </Sektion>
          )}
          {isAdmin && open && <Bilagor store={store} onChanged={onAttachmentsChanged} />}
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Info size={14} />UK Portservice Avtal{version ? ` · version ${version}` : ""}</p>
          <Button variant="outline" className="w-full gap-2 text-destructive hover:text-destructive" onClick={() => lockApp()}><LogOut size={16} />Logga ut</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

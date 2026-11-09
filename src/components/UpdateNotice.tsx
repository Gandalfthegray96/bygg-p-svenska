import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Nyhet = { datum: string; rubrik: string; punkter: string[] };

const SEEN_KEY = "uc-sedda-nyheter";

/** Hämtar startsidan och plockar ut appens skriptfiler – ändras vid varje ny publicering. */
async function fetchSignature(): Promise<string | null> {
  try {
    const res = await fetch(`/?_v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const html = await res.text();
    const scripts = html.match(/\/assets\/[^"'\s]+\.js/g);
    return scripts ? [...new Set(scripts)].sort().join("|") : null;
  } catch {
    return null;
  }
}

/** Nyhetslistan ligger utanför appens kod så att en öppen gammal version kan läsa den nya listan. */
async function fetchNyheter(): Promise<Nyhet[]> {
  try {
    const res = await fetch(`/changelog.json?_v=${Date.now()}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as Nyhet[]) : [];
  } catch {
    return [];
  }
}

/**
 * Visar "Appen har uppdaterats" med nyheterna sedan sist, första gången man öppnar en ny version.
 * Om en ny version publiceras medan appen är öppen visas bara en diskret rad.
 */
export function UpdateNotice() {
  const [open, setOpen] = useState(false);
  const [nyheter, setNyheter] = useState<Nyhet[]>([]);
  const [nyFinns, setNyFinns] = useState(false);

  // Välkomstruta: nyheter man inte sett ännu.
  useEffect(() => {
    fetchNyheter().then((lista) => {
      if (!lista.length) return;
      const senaste = lista[0].datum;
      const sett = localStorage.getItem(SEEN_KEY);
      if (!sett) { localStorage.setItem(SEEN_KEY, senaste); return; }
      if (sett === senaste) return;
      const idx = lista.findIndex((n) => n.datum === sett);
      setNyheter(lista.slice(0, idx === -1 ? 3 : Math.min(idx, 5)));
      setOpen(true);
    });
  }, []);

  const stang = () => {
    if (nyheter[0]) localStorage.setItem(SEEN_KEY, nyheter[0].datum);
    setOpen(false);
  };

  // Diskret rad om en ny version publiceras medan appen är öppen.
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let start: string | null = null;
    let stopped = false;
    const check = async () => {
      const sig = await fetchSignature();
      if (stopped || !sig) return;
      if (start === null) start = sig;
      else if (sig !== start) setNyFinns(true);
    };
    check();
    const t = window.setInterval(check, 5 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stopped = true; window.clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  return (
    <>
      {nyFinns && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-primary px-3 py-1.5 text-xs text-primary-foreground">
          <Sparkles size={14} /> En ny version finns – den laddas nästa gång du laddar om appen.
          <button className="underline" onClick={() => setNyFinns(false)}>Stäng</button>
        </div>
      )}
      <Dialog open={open} onOpenChange={(o) => { if (!o) stang(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles size={18} className="text-primary" /> Appen har uppdaterats!</DialogTitle>
            <DialogDescription>Här är vad som är nytt sedan sist.</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-4 overflow-y-auto">
            {nyheter.map((n) => (
              <div key={n.datum + n.rubrik}>
                <p className="text-sm font-semibold text-foreground">{n.rubrik}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {n.punkter.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={stang}>Uppfattat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

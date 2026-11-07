import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Nyhet = { datum: string; rubrik: string; punkter: string[] };

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

/** Visar en popup när en ny version av appen har publicerats, med vad som är nytt. */
export function UpdateNotice() {
  const [open, setOpen] = useState(false);
  const [nyheter, setNyheter] = useState<Nyhet[]>([]);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let start: string | null = null;
    let stopped = false;
    let shown = false;
    const check = async () => {
      const sig = await fetchSignature();
      if (stopped || !sig) return;
      if (start === null) start = sig;
      else if (sig !== start && !shown) {
        shown = true;
        setNyheter((await fetchNyheter()).slice(0, 2));
        setOpen(true);
      }
    };
    check();
    const t = window.setInterval(check, 5 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stopped = true; window.clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles size={18} className="text-primary" /> Ny version av appen finns</DialogTitle>
          <DialogDescription>Spara ditt arbete och uppdatera när det passar.</DialogDescription>
        </DialogHeader>
        {nyheter.length > 0 && (
          <div className="max-h-72 space-y-4 overflow-y-auto">
            {nyheter.map((n) => (
              <div key={n.datum + n.rubrik}>
                <p className="text-sm font-semibold text-foreground">{n.rubrik} <span className="font-normal text-muted-foreground">· {n.datum}</span></p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {n.punkter.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Senare</Button>
          <Button onClick={() => window.location.reload()}>Uppdatera nu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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

/** Visar en notis när en ny version av appen har publicerats, istället för att appen byts ut mitt i arbetet. */
export function UpdateNotice() {
  const [nyVersion, setNyVersion] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let start: string | null = null;
    let stopped = false;
    const check = async () => {
      const sig = await fetchSignature();
      if (stopped || !sig) return;
      if (start === null) start = sig;
      else if (sig !== start) setNyVersion(true);
    };
    check();
    const t = window.setInterval(check, 5 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stopped = true; window.clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  if (!nyVersion) return null;
  return (
    <div role="status" className="no-print fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-lg">
      <RefreshCw size={18} className="shrink-0 text-info" />
      <div className="flex-1">
        <p className="font-semibold">Ny version av appen finns</p>
        <p className="text-xs text-muted-foreground">Spara ditt arbete och uppdatera när det passar.</p>
      </div>
      <Button variant="ghost" onClick={() => setNyVersion(false)} className="h-9 px-2 text-xs text-muted-foreground">Senare</Button>
      <Button onClick={() => window.location.reload()} className="h-9 px-3 text-xs">Uppdatera</Button>
    </div>
  );
}

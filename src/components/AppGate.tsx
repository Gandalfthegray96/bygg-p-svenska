import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Lock } from "lucide-react";

const UNLOCK_KEY = "ukp-gate";
const envPw = import.meta.env['VITE_APP_PASSWORD'] as string | undefined;
const isPreview = typeof window !== "undefined" && /(^|\.)id-preview--|localhost|lovableproject\.com/.test(window.location.hostname);
const PASSWORD = isPreview || import.meta.env.DEV ? "admin" : envPw || "";

async function hash(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ukp-gate:" + s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function lockApp() {
  localStorage.removeItem(UNLOCK_KEY);
  window.dispatchEvent(new Event("ukp-lock"));
}

export function AppGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = async () => {
      const saved = localStorage.getItem(UNLOCK_KEY);
      const ok = !!PASSWORD && !!saved && saved === (await hash(PASSWORD));
      setState(ok ? "open" : "locked");
      setPw(""); setError("");
    };
    sync();
    window.addEventListener("ukp-lock", sync);
    return () => window.removeEventListener("ukp-lock", sync);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!PASSWORD) return;
    setBusy(true);
    if (pw === PASSWORD) {
      localStorage.setItem(UNLOCK_KEY, await hash(PASSWORD));
      setState("open");
    } else {
      setError("Fel lösenord, försök igen");
      setPw("");
    }
    setBusy(false);
  };

  if (state === "open") return <>{children}</>;
  if (state === "checking") return <div className="min-h-screen bg-background" />;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <form onSubmit={submit} className="ds-dialog relative w-full max-w-sm rounded-lg border border-border bg-card p-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Lock size={28} />
        </div>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary">UK Portservice</p>
        <h1 className="mt-1 text-center text-2xl font-bold text-foreground">Avtalskalkylator</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Logga in för att fortsätta</p>

        {!PASSWORD ? (
          <p className="mt-6 rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
            Inget lösenord är inställt för appen. Kontakta den som administrerar appen.
          </p>
        ) : (
          <>
            <label className="mt-6 block text-sm font-medium text-foreground" htmlFor="gate-pw">Lösenord</label>
            <div className="relative mt-1.5">
              <input
                id="gate-pw" type={show ? "text" : "password"} autoFocus autoComplete="current-password"
                value={pw} onChange={(e) => { setPw(e.target.value); setError(""); }}
                className="ds-input h-12 pr-12"
                placeholder="Skriv lösenordet"
              />
              <Button variant="ghost" type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Dölj lösenord" : "Visa lösenord"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:text-primary">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </Button>
            </div>
            <p className="mt-2 h-5 text-sm text-destructive">{error}</p>
            <Button variant="ghost" type="submit" disabled={!pw || busy}
              className="mt-2 h-12 w-full rounded-md bg-primary font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50">
              Logga in
            </Button>
          </>
        )}
      </form>
    </div>
  );
}

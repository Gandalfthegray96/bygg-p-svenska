import { useEffect, useState, type ReactNode } from "react";
import { Delete, Lock } from "lucide-react";

const HASH_KEY = "ukp-pin-hash";
const UNLOCK_KEY = "ukp-unlocked";
const LEN = 4;

async function hash(pin: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ukp:" + pin));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function lockApp() {
  localStorage.removeItem(UNLOCK_KEY);
  window.dispatchEvent(new Event("ukp-lock"));
}

export function resetPin() {
  localStorage.removeItem(HASH_KEY);
  lockApp();
}

export function PinLock({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const sync = () => {
      setHasPin(!!localStorage.getItem(HASH_KEY));
      setUnlocked(localStorage.getItem(UNLOCK_KEY) === "1" && !!localStorage.getItem(HASH_KEY));
      setPin(""); setFirst(null); setError("");
    };
    sync(); setReady(true);
    window.addEventListener("ukp-lock", sync);
    return () => window.removeEventListener("ukp-lock", sync);
  }, []);

  const fail = (msg: string) => {
    setError(msg); setShake(true); setPin("");
    setTimeout(() => setShake(false), 400);
  };

  useEffect(() => {
    if (pin.length !== LEN) return;
    (async () => {
      if (hasPin) {
        if ((await hash(pin)) === localStorage.getItem(HASH_KEY)) {
          localStorage.setItem(UNLOCK_KEY, "1"); setUnlocked(true); setPin("");
        } else fail("Fel kod, försök igen");
      } else if (first === null) {
        setFirst(pin); setPin(""); setError("");
      } else if (first === pin) {
        localStorage.setItem(HASH_KEY, await hash(pin));
        localStorage.setItem(UNLOCK_KEY, "1");
        setHasPin(true); setUnlocked(true); setPin(""); setFirst(null);
      } else { setFirst(null); fail("Koderna matchade inte – börja om"); }
    })();
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (unlocked || !ready) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < LEN ? p + e.key : p));
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unlocked, ready]);

  if (!ready) return null;
  if (unlocked) return <>{children}</>;

  const title = hasPin ? "Ange din kod" : first === null ? "Välj en PIN-kod" : "Bekräfta koden";
  const sub = hasPin ? "Appen är låst" : "4 siffror – används för att låsa upp appen på den här enheten";
  const press = (d: string) => setPin((p) => (p.length < LEN ? p + d : p));

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="glass w-full max-w-xs rounded-3xl p-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Lock size={26} /></div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">UK Portservice</p>
        <h1 className="mt-1 text-xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
        <div className={`my-6 flex justify-center gap-3 ${shake ? "animate-pulse" : ""}`}>
          {Array.from({ length: LEN }).map((_, i) => (
            <span key={i} className={`h-4 w-4 rounded-full border-2 border-primary transition ${i < pin.length ? "bg-primary" : ""}`} />
          ))}
        </div>
        <p className="mb-3 h-5 text-sm text-destructive">{error}</p>
        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} onClick={() => press(d)} className="h-16 rounded-2xl bg-foreground/5 text-2xl font-semibold text-foreground transition active:scale-95 active:bg-primary/15">{d}</button>
          ))}
          <span />
          <button onClick={() => press("0")} className="h-16 rounded-2xl bg-foreground/5 text-2xl font-semibold text-foreground transition active:scale-95 active:bg-primary/15">0</button>
          <button onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Radera" className="flex h-16 items-center justify-center rounded-2xl text-muted-foreground active:scale-95"><Delete size={24} /></button>
        </div>
      </div>
    </div>
  );
}

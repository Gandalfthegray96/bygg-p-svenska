import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { pullAll, stopSync } from "@/lib/cloud-sync";

export async function lockApp() {
  stopSync();
  await supabase.auth.signOut();
}

type Mode = "login" | "signup" | "forgot";

export function AppGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | "open" | "pending">("checking");
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const isReset = typeof window !== "undefined" && window.location.pathname === "/reset-password";

  useEffect(() => {
    let current: string | null | undefined = undefined;
    const open = async (uid: string | null) => {
      if (uid === current) return;
      current = uid;
      if (!uid) { stopSync(); setState("locked"); return; }
      setState("checking");
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (!roles?.length) { setState("pending"); return; }
      try { await pullAll(uid); } catch (e) { console.error(e); }
      setState("open");
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setTimeout(() => open(session?.user.id ?? null), 0);
    });
    supabase.auth.getUser().then(({ data }) => open(data.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(""); setInfo("");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: window.location.origin, data: { name: email.split("@")[0] } } });
        if (error) throw error;
        if (!data.session) { setInfo("Kontot är skapat. Öppna mejlet vi skickade och bekräfta adressen, logga sedan in."); setMode("login"); }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
        if (error) throw error;
        setInfo("Om adressen finns har vi skickat en länk för att välja nytt lösenord.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(/invalid login/i.test(msg) ? "Fel e-post eller lösenord" : /not confirmed/i.test(msg) ? "Bekräfta din e-postadress först" : /already registered/i.test(msg) ? "Det finns redan ett konto med den adressen" : /password/i.test(msg) ? "Lösenordet är för svagt (minst 6 tecken)" : "Något gick fel, försök igen");
      setPw("");
    }
    setBusy(false);
  };

  if (isReset || state === "open") return <>{children}</>;
  if (state === "pending") return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="ds-dialog w-full max-w-sm rounded-3xl border border-border bg-card p-8 text-center">
        <img src="/icon-512.png" alt="UK Portservice Avtal" className="mx-auto mb-4 h-20 w-20 rounded-2xl shadow-md" />
        <h1 className="text-xl font-bold text-foreground">Väntar på godkännande</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ditt konto är skapat. En administratör behöver ge dig behörighet innan du kan använda appen.</p>
        <Button variant="outline" className="mt-5 w-full" onClick={() => lockApp()}>Logga ut</Button>
      </div>
    </div>
  );
  if (state === "checking") return <div className="min-h-screen bg-background" />;

  const title = mode === "login" ? "Logga in på ditt konto" : mode === "signup" ? "Skapa ett konto" : "Glömt lösenord";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <form onSubmit={submit} className="ds-dialog relative w-full max-w-sm rounded-3xl border border-border bg-card p-8">
        <img src="/icon-512.png" alt="UK Portservice Avtal" className="mx-auto mb-4 h-20 w-20 rounded-2xl shadow-md" />
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary">UK Portservice</p>
        <h1 className="mt-1 text-center text-2xl font-bold text-foreground">Avtalskalkylator</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">{title}</p>

        <label className="mt-6 block text-sm font-medium text-foreground" htmlFor="gate-email">E-post</label>
        <input id="gate-email" type="email" autoFocus autoComplete="email" required value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }} className="ds-input mt-1.5 h-12" placeholder="namn@foretag.se" />

        {mode !== "forgot" && (
          <>
            <label className="mt-4 block text-sm font-medium text-foreground" htmlFor="gate-pw">Lösenord</label>
            <div className="relative mt-1.5">
              <input id="gate-pw" type={show ? "text" : "password"} required minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={pw} onChange={(e) => { setPw(e.target.value); setError(""); }}
                className="ds-input h-12 pr-12" placeholder="Skriv lösenordet" />
              <Button variant="ghost" type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Dölj lösenord" : "Visa lösenord"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:text-primary">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </Button>
            </div>
          </>
        )}

        <p className="mt-2 min-h-5 text-sm text-destructive">{error}</p>
        {info && <p className="mb-2 rounded-md bg-muted p-3 text-sm text-foreground">{info}</p>}

        <Button variant="ghost" type="submit" disabled={busy || !email || (mode !== "forgot" && !pw)}
          className="mt-2 h-12 w-full rounded-md bg-primary font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50">
          {mode === "login" ? "Logga in" : mode === "signup" ? "Skapa konto" : "Skicka länk"}
        </Button>

        <div className="mt-4 flex flex-col items-center gap-1 text-sm">
          {mode === "login" ? (
            <>
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setMode("forgot"); setError(""); setInfo(""); }}>Glömt lösenord?</button>
              <button type="button" className="font-medium text-foreground hover:underline" onClick={() => { setMode("signup"); setError(""); setInfo(""); }}>Skapa konto</button>
            </>
          ) : (
            <button type="button" className="font-medium text-foreground hover:underline" onClick={() => { setMode("login"); setError(""); }}>Tillbaka till inloggning</button>
          )}
        </div>
      </form>
    </div>
  );
}

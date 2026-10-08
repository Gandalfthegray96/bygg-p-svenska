import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nytt lösenord – Avtalskalkylator" },
      { name: "description", content: "Välj ett nytt lösenord för ditt konto i UK Portservice Avtalskalkylator." },
      { property: "og:title", content: "Nytt lösenord – Avtalskalkylator" },
      { property: "og:description", content: "Välj ett nytt lösenord för ditt konto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setMsg("Det gick inte att byta lösenord. Be om en ny länk och försök igen.");
    else setDone(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <form onSubmit={submit} className="ds-dialog w-full max-w-sm rounded-3xl border border-border bg-card p-8">
        <h1 className="text-center text-2xl font-bold text-foreground">Nytt lösenord</h1>
        {done ? (
          <>
            <p className="mt-4 text-center text-sm text-muted-foreground">Lösenordet är bytt.</p>
            <Button type="button" className="mt-6 h-12 w-full" onClick={() => (window.location.href = "/")}>Till appen</Button>
          </>
        ) : (
          <>
            <label className="mt-6 block text-sm font-medium text-foreground" htmlFor="new-pw">Nytt lösenord</label>
            <input id="new-pw" type="password" required minLength={6} autoComplete="new-password" value={pw}
              onChange={(e) => setPw(e.target.value)} className="ds-input mt-1.5 h-12" />
            <p className="mt-2 min-h-5 text-sm text-destructive">{msg}</p>
            <Button type="submit" disabled={busy || pw.length < 6} className="mt-2 h-12 w-full">Spara lösenord</Button>
          </>
        )}
      </form>
    </div>
  );
}

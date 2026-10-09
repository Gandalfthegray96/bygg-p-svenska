import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listUsers, setUserRole, type AppRole } from "@/lib/users.functions";

export const ROLE_LABEL: Record<AppRole, string> = { admin: "Admin", saljare: "Säljare", tekniker: "Tekniker" };
type U = Awaited<ReturnType<typeof listUsers>>[number];

export function Anvandare({ onToast }: { onToast: (s: string) => void }) {
  const list = useServerFn(listUsers);
  const setRole = useServerFn(setUserRole);
  const [users, setUsers] = useState<U[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const reload = () => list().then((u) => { setUsers(u); setLoaded(true); }).catch((e) => setErr(e.message));
  useEffect(() => { reload(); }, []);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setErr(""); setBusy(true);
    try { await fn(); onToast(ok); await reload(); } catch (e) { setErr(e instanceof Error ? e.message : "Något gick fel"); }
    setBusy(false);
  };

  const pending = users.filter((u) => !u.role);

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">Användare</h2>

      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <p className="mb-1 flex items-center gap-2 font-semibold text-foreground"><UserCheck size={18} />Så lägger du till en kollega</p>
        Be kollegan öppna appen och välja <b>Skapa konto</b> på inloggningssidan. Kontot dyker då upp här som
        <b> Väntar på godkännande</b> — välj en roll så får kollegan tillgång. Välj <b>Ingen behörighet</b> för att spärra ett konto.
      </div>

      {pending.length > 0 && <p className="text-sm font-medium text-foreground">{pending.length} konto väntar på godkännande</p>}
      {err && <p className="text-sm text-destructive">{err}</p>}

      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{u.name || u.email}{u.self && <span className="ml-2 text-xs text-muted-foreground">(du)</span>}</p>
              <p className="truncate text-sm text-muted-foreground">{u.email} · skapad {new Date(u.createdAt).toLocaleDateString("sv-SE")}{!u.role && " · Väntar på godkännande"}</p>
            </div>
            <select className="ds-input w-44" value={u.role ?? ""} disabled={busy || u.self}
              onChange={(e) => run(() => setRole({ data: { userId: u.id, role: (e.target.value || null) as AppRole | null } }), "Behörigheten ändrades")}>
              <option value="">Ingen behörighet</option>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Button variant="outline" size="sm" disabled={busy} title="Skicka länk för nytt lösenord" onClick={() =>
              run(async () => {
                const { error } = await supabase.auth.resetPasswordForEmail(u.email, { redirectTo: window.location.origin + "/reset-password" });
                if (error) throw error;
              }, `Länk för nytt lösenord skickad till ${u.email}`)
            }><KeyRound size={16} /></Button>
          </div>
        ))}
        {!loaded && !err && <p className="p-4 text-sm text-muted-foreground">Hämtar användare …</p>}
      </div>
    </div>
  );
}

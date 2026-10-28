import { useEffect, useState } from "react";
import { KeyRound, Trash2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { TeamLogg } from "./TeamLogg";
import { deleteUser, listUsers, setUserRole, type AppRole } from "@/lib/users.functions";

export const ROLE_LABEL: Record<AppRole, string> = { admin: "Admin", saljare: "Säljare", tekniker: "Tekniker" };
function senast(t: string | null) {
  if (!t) return "aldrig";
  const min = Math.round((Date.now() - +new Date(t)) / 60000);
  if (min < 15) return "nu";
  if (min < 60) return `för ${min} min sedan`;
  const d = new Date(t), idag = new Date().toDateString() === d.toDateString();
  const tid = d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  return idag ? `idag ${tid}` : `${d.toLocaleDateString("sv-SE")} ${tid}`;
}
type U = Awaited<ReturnType<typeof listUsers>>[number];

export function Anvandare({ onToast }: { onToast: (s: string) => void }) {
  const list = listUsers;
  const setRole = setUserRole;
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
          <div key={u.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 p-4 sm:flex sm:gap-3">
            <div className="col-span-2 min-w-0 sm:flex-1">
              <p className="flex items-center gap-2 break-all font-medium text-foreground">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${u.lastSeen && Date.now() - +new Date(u.lastSeen) < 15 * 60000 ? "bg-success" : "bg-muted-foreground/30"}`} />
                {u.email}{u.self && <span className="text-xs text-muted-foreground">(du)</span>}
              </p>
              <p className="text-sm text-muted-foreground">{u.name && u.name !== u.email.split("@")[0] ? u.name + " · " : ""}{u.role ? ROLE_LABEL[u.role] : "Ingen behörighet"} · skapad {new Date(u.createdAt).toLocaleDateString("sv-SE")}{!u.role && " · Väntar på godkännande"}</p>
              <p className="text-xs text-muted-foreground">Senast aktiv: {senast(u.lastSeen)}</p>
            </div>
            <select className="ds-input w-full sm:w-44" value={u.role ?? ""} disabled={busy || u.self}
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
            {!u.self && (
              <Button variant="outline" size="sm" disabled={busy} title="Ta bort användare" aria-label={`Ta bort ${u.email}`}
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (!window.confirm(`Vill du verkligen ta bort ${u.email}? Kontot och dess sparade data raderas permanent.`)) return;
                  run(() => deleteUser(u.id), `${u.email} togs bort`);
                }}><Trash2 size={16} /></Button>
            )}
          </div>
        ))}
        {!loaded && !err && <p className="p-4 text-sm text-muted-foreground">Hämtar användare …</p>}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4"><TeamLogg /></div>
    </div>
  );
}

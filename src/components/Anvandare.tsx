import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createUser, deleteUser, listUsers, setUserPassword, setUserRole, type AppRole } from "@/lib/users.functions";

export const ROLE_LABEL: Record<AppRole, string> = { admin: "Admin", saljare: "Säljare", tekniker: "Tekniker" };
type U = Awaited<ReturnType<typeof listUsers>>[number];

export function Anvandare({ onToast }: { onToast: (s: string) => void }) {
  const list = useServerFn(listUsers);
  const create = useServerFn(createUser);
  const setRole = useServerFn(setUserRole);
  const setPw = useServerFn(setUserPassword);
  const del = useServerFn(deleteUser);
  const [users, setUsers] = useState<U[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "saljare" as AppRole });
  const [confirmDel, setConfirmDel] = useState<U | null>(null);

  const reload = () => list().then(setUsers).catch((e) => setErr(e.message));
  useEffect(() => { reload(); }, []);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setErr(""); setBusy(true);
    try { await fn(); onToast(ok); await reload(); } catch (e) { setErr(e instanceof Error ? e.message : "Något gick fel"); }
    setBusy(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => { await create({ data: form }); setForm({ name: "", email: "", password: "", role: "saljare" }); }, `Användaren ${form.email} skapades`);
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">Användare</h2>

      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 flex items-center gap-2 font-semibold text-foreground"><UserPlus size={18} />Lägg till användare</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input className="ds-input" placeholder="Namn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="ds-input" type="email" required placeholder="E-post" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="ds-input" type="text" required minLength={6} placeholder="Startlösenord (minst 6)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="ds-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <Button type="submit" disabled={busy} className="mt-3">Skapa användare</Button>
      </form>

      {err && <p className="text-sm text-destructive">{err}</p>}

      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{u.name || u.email}{u.self && <span className="ml-2 text-xs text-muted-foreground">(du)</span>}</p>
              <p className="truncate text-sm text-muted-foreground">{u.email} · senast inloggad {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString("sv-SE") : "aldrig"}</p>
            </div>
            <select className="ds-input w-36" value={u.role ?? ""} disabled={busy || u.self}
              onChange={(e) => run(() => setRole({ data: { userId: u.id, role: e.target.value as AppRole } }), "Rollen ändrades")}>
              {!u.role && <option value="">Ingen roll</option>}
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Button variant="outline" size="sm" disabled={busy} title="Nytt lösenord" onClick={() => {
              const p = window.prompt(`Nytt lösenord för ${u.email} (minst 6 tecken)`);
              if (p) run(() => setPw({ data: { userId: u.id, password: p } }), "Lösenordet ändrades");
            }}><KeyRound size={16} /></Button>
            {!u.self && <Button variant="outline" size="sm" disabled={busy} title="Ta bort" onClick={() => setConfirmDel(u)}><Trash2 size={16} className="text-destructive" /></Button>}
          </div>
        ))}
        {!users.length && !err && <p className="p-4 text-sm text-muted-foreground">Hämtar användare …</p>}
      </div>

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setConfirmDel(null)}>
          <div className="ds-dialog w-full max-w-sm rounded-2xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-semibold text-foreground">Ta bort användare?</p>
            <p className="mt-1 text-sm text-muted-foreground">{confirmDel.email} och kontots sparade avtal tas bort permanent.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDel(null)}>Avbryt</Button>
              <Button variant="destructive" onClick={() => { const u = confirmDel; setConfirmDel(null); run(() => del({ data: { userId: u.id } }), "Användaren togs bort"); }}>Ta bort</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

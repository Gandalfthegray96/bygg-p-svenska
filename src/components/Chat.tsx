import { useEffect, useMemo, useRef, useState, type PointerEvent as RPE } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CustomerFolder } from "@/lib/avtal-store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, MessageCircle, Send, Smile, Users, X } from "lucide-react";

type Msg = { id: string; sender_id: string; recipient_id: string | null; body: string; avtal_id: string | null; avtal_label: string | null; created_at: string };
type ChatUser = { id: string; name: string; email: string };

const EMOJIS = "😀😂😊😍👍👎🙏👏💪🔥✅❌⚠️🎉🚀📞📅🔧🛠️🚚☕😅🤔😎🙌💯⏰📍".match(/\p{Extended_Pictographic}\uFE0F?/gu) ?? [];
const POS_KEY = "chat-pos";
const READ_KEY = "chat-read";

export function initials(name: string, email = "") {
  const parts = (name || email.split("@")[0].replace(/[._-]+/g, " ")).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const f = parts[0][0] ?? "";
  const l = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (f + l).toUpperCase();
}

const convOf = (m: Msg, me: string) => (m.recipient_id === null ? "team" : m.sender_id === me ? m.recipient_id : m.sender_id);

function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return <>{parts.map((p, i) => (/^https?:\/\//.test(p)
    ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all underline">{p}</a>
    : <span key={i}>{p}</span>))}</>;
}

function Avatar({ u, size = 32 }: { u?: ChatUser; size?: number }) {
  return (
    <span style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
      {u ? initials(u.name, u.email) : <Users size={size * 0.5} />}
    </span>
  );
}

export function Chat({ store, onOpenAvtal }: { store: Record<string, CustomerFolder>; onOpenAvtal: (id: string) => void }) {
  const [me, setMe] = useState<string | null>(null);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [open, setOpen] = useState(false);
  const [conv, setConv] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAvtal, setShowAvtal] = useState(false);
  const [avtalRef, setAvtalRef] = useState<{ id: string; label: string } | null>(null);
  const [read, setRead] = useState<Record<string, string>>({});
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const openRef = useRef({ open, conv });
  openRef.current = { open, conv };

  useEffect(() => {
    try { setRead(JSON.parse(localStorage.getItem(READ_KEY) || "{}")); } catch { /* */ }
    try { const p = JSON.parse(localStorage.getItem(POS_KEY) || "null"); if (p) setPos(p); } catch { /* */ }
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!me) return;
    supabase.rpc("chat_users").then(({ data }) => setUsers((data as ChatUser[]) ?? []));
    supabase.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(1000)
      .then(({ data }) => setMsgs(((data as Msg[]) ?? []).reverse()));
    const ch = supabase.channel(`chat-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (p) => {
        const m = p.new as Msg;
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.sender_id !== me) notify(m);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, (p) => {
        const id = (p.old as { id?: string }).id;
        setMsgs((prev) => prev.filter((x) => x.id !== id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const usersRef = useRef(users); usersRef.current = users;
  function notify(m: Msg) {
    const c = me ? convOf(m, me) : "team";
    const viewing = openRef.current.open && openRef.current.conv === c && !document.hidden;
    if (viewing || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const u = usersRef.current.find((x) => x.id === m.sender_id);
    const n = new Notification(`${u?.name || u?.email || "Kollega"}${m.recipient_id ? " (privat)" : " i Teamchatt"}`, { body: m.body.slice(0, 140), icon: "/icon-192.png", tag: m.id });
    n.onclick = () => { window.focus(); setOpen(true); setConv(c); n.close(); };
  }

  const userById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const unreadBy = useMemo(() => {
    const out: Record<string, number> = {};
    if (!me) return out;
    for (const m of msgs) {
      if (m.sender_id === me) continue;
      const c = convOf(m, me);
      if (!read[c] || m.created_at > read[c]) out[c] = (out[c] ?? 0) + 1;
    }
    return out;
  }, [msgs, read, me]);
  const totalUnread = Object.values(unreadBy).reduce((s, n) => s + n, 0);

  const convMsgs = useMemo(() => (me && conv ? msgs.filter((m) => convOf(m, me) === conv) : []), [msgs, conv, me]);

  useEffect(() => {
    if (!open || !conv || !convMsgs.length) return;
    const last = convMsgs[convMsgs.length - 1].created_at;
    if (read[conv] !== last) {
      const next = { ...read, [conv]: last };
      setRead(next); localStorage.setItem(READ_KEY, JSON.stringify(next));
    }
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
  }, [open, conv, convMsgs, read]);

  const openPanel = () => {
    setOpen((o) => !o);
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
  };

  const send = async () => {
    const body = text.trim();
    if (!body || !me || !conv) return;
    setText(""); setShowEmoji(false);
    const ref = avtalRef; setAvtalRef(null);
    const { data, error } = await supabase.from("chat_messages").insert({
      body, recipient_id: conv === "team" ? null : conv, avtal_id: ref?.id ?? null, avtal_label: ref?.label ?? null,
    }).select().single();
    if (error) { setText(body); alert("Kunde inte skicka meddelandet."); return; }
    setMsgs((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Msg]));
  };

  // Drag
  const onDown = (e: RPE<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPE<HTMLButtonElement>) => {
    if (!drag.current) return;
    const x = Math.min(Math.max(4, e.clientX - drag.current.dx), window.innerWidth - 60);
    const y = Math.min(Math.max(4, e.clientY - drag.current.dy), window.innerHeight - 60);
    if (!drag.current.moved && pos && Math.abs(pos.x - x) + Math.abs(pos.y - y) < 6) return;
    drag.current.moved = true; setPos({ x, y });
  };
  const onUp = () => {
    const d = drag.current; drag.current = null;
    if (d?.moved) { if (pos) localStorage.setItem(POS_KEY, JSON.stringify(pos)); } else openPanel();
  };

  if (!me) return null;
  const meUser = userById[me];
  const fabStyle = pos ? { left: pos.x, top: pos.y } : undefined;
  const avtalList = Object.values(store).filter((f) => !f.uppsagd).sort((a, b) => a.name.localeCompare(b.name, "sv"));
  const convTitle = conv === "team" ? "Teamchatt" : conv ? (userById[conv]?.name || userById[conv]?.email || "Privat") : "Chatt";

  return (
    <>
      <button type="button" aria-label={`Chatt${totalUnread ? `, ${totalUnread} olästa` : ""}`}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        style={fabStyle}
        className={`fixed z-40 flex h-14 w-14 touch-none select-none items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground shadow-lg ring-4 ring-background transition-shadow hover:shadow-xl ${pos ? "" : "bottom-20 right-4 sm:bottom-6 sm:right-6"}`}>
        {meUser ? initials(meUser.name, meUser.email) : <MessageCircle size={22} />}
        {totalUnread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground ring-2 ring-background">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-2 bottom-2 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[560px] sm:w-[380px]">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            {conv && <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Tillbaka" onClick={() => setConv(null)}><ArrowLeft size={16} /></Button>}
            <p className="flex-1 truncate font-semibold">{convTitle}</p>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Stäng chatten" onClick={() => setOpen(false)}><X size={16} /></Button>
          </div>

          {!conv ? (
            <div className="flex-1 overflow-y-auto p-2">
              <ConvRow label="Teamchatt" sub="Alla i teamet" unread={unreadBy.team} onClick={() => setConv("team")} />
              <p className="px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Privat</p>
              {users.filter((u) => u.id !== me).map((u) => (
                <ConvRow key={u.id} u={u} label={u.name || u.email} sub={u.email} unread={unreadBy[u.id]} onClick={() => setConv(u.id)} />
              ))}
              {users.length <= 1 && <p className="px-2 text-sm text-muted-foreground">Inga andra användare ännu.</p>}
              <p className="px-2 pt-4 text-[11px] text-muted-foreground">Endast text, emojis och länkar. Meddelanden äldre än 12 månader raderas automatiskt.</p>
            </div>
          ) : (
            <>
              <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto bg-muted/40 p-3">
                {!convMsgs.length && <p className="pt-8 text-center text-sm text-muted-foreground">Inga meddelanden ännu. Säg hej 👋</p>}
                {convMsgs.map((m) => {
                  const mine = m.sender_id === me; const u = userById[m.sender_id];
                  return (
                    <div key={m.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                      {!mine && <Avatar u={u} size={28} />}
                      <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
                        {!mine && conv === "team" && <p className="mb-0.5 text-[11px] font-semibold opacity-70">{u?.name || u?.email || "Okänd"}</p>}
                        <p className="whitespace-pre-wrap break-words"><Linkify text={m.body} /></p>
                        {m.avtal_id && (
                          <button type="button" onClick={() => { if (store[m.avtal_id!]) { onOpenAvtal(m.avtal_id!); setOpen(false); } else alert("Avtalet finns inte längre i appen."); }}
                            className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-background/80 px-2 py-1 text-xs font-medium text-foreground">
                            <FileText size={13} /> {m.avtal_label || "Öppna avtal"}
                          </button>
                        )}
                        <p className="mt-0.5 text-right text-[10px] opacity-60">{new Date(m.created_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {showEmoji && (
                <div className="grid grid-cols-8 gap-1 border-t border-border p-2">
                  {EMOJIS.map((e) => <button key={e} type="button" className="rounded p-1 text-xl hover:bg-muted" onClick={() => setText((t) => t + e)}>{e}</button>)}
                </div>
              )}
              {showAvtal && (
                <div className="max-h-48 overflow-y-auto border-t border-border p-2">
                  {!avtalList.length && <p className="text-sm text-muted-foreground">Inga sparade avtal.</p>}
                  {avtalList.map((f) => {
                    const nr = f.versions[f.versions.length - 1]?.data?.customer?.avtalNr;
                    const label = nr ? `${f.name} · ${nr}` : f.name;
                    return <button key={f.id} type="button" className="block w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                      onClick={() => { setAvtalRef({ id: f.id, label }); setShowAvtal(false); }}>{label}</button>;
                  })}
                </div>
              )}
              {avtalRef && (
                <div className="flex items-center gap-2 border-t border-border px-3 py-1.5 text-xs">
                  <FileText size={13} /> <span className="flex-1 truncate">{avtalRef.label}</span>
                  <button type="button" aria-label="Ta bort avtalskoppling" onClick={() => setAvtalRef(null)}><X size={13} /></button>
                </div>
              )}
              <form className="flex items-end gap-1 border-t border-border p-2" onSubmit={(e) => { e.preventDefault(); send(); }}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); }}>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Emojis" onClick={() => { setShowEmoji((s) => !s); setShowAvtal(false); }}><Smile size={18} /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Koppla avtal" onClick={() => { setShowAvtal((s) => !s); setShowEmoji(false); }}><FileText size={18} /></Button>
                <textarea value={text} rows={1} maxLength={4000} placeholder="Skriv ett meddelande…"
                  onChange={(e) => setText(e.target.value)}
                  onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); alert("Filer och bilder kan inte skickas i chatten."); } }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  className="max-h-28 min-h-9 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                <Button type="submit" size="icon" className="h-9 w-9 shrink-0" aria-label="Skicka" disabled={!text.trim()}><Send size={16} /></Button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}

function ConvRow({ u, label, sub, unread, onClick }: { u?: ChatUser; label: string; sub: string; unread?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted">
      <Avatar u={u} size={36} />
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{label}</span><span className="block truncate text-xs text-muted-foreground">{sub}</span></span>
      {!!unread && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">{unread}</span>}
    </button>
  );
}

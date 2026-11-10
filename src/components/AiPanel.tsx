import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useServerFn } from "@tanstack/react-start";
import { askAi, type AiMsg } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Bot, Copy, Loader2, RotateCcw, Send } from "lucide-react";

export function AiPanel({ getContext, quick, placeholder = "Fråga UK-assistenten…", className = "" }:
  { getContext: () => string; quick?: { label: string; prompt: string }[]; placeholder?: string; className?: string }) {
  const ask = useServerFn(askAi);
  const [msgs, setMsgs] = useState<AiMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scroll = () => requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }));

  async function send(q: string) {
    const body = q.trim(); if (!body || busy) return;
    const next: AiMsg[] = [...msgs, { role: "user", content: body }];
    setMsgs(next); setText(""); setErr(null); setBusy(true); scroll();
    try {
      const r = await ask({ data: { messages: next, context: getContext() } });
      if (r.error) setErr(r.error);
      else setMsgs([...next, { role: "assistant", content: r.text }]);
    } catch { setErr("AI:n kunde inte nås. Kontrollera att du är inloggad och uppkopplad."); }
    finally { setBusy(false); scroll(); }
  }

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {!msgs.length && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar text-sidebar-primary"><Bot size={15} /></span>
            <p className="pt-1">Hej! Jag känner till era priser, kalkylregler och avtal. Fråga vad du vill eller välj ett snabbval.</p>
          </div>
        )}
        {msgs.map((m, i) => m.role === "user" ? (
          <div key={i} className="flex justify-end"><p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">{m.content}</p></div>
        ) : (
          <div key={i} className="flex items-start gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar text-sidebar-primary"><Bot size={15} /></span>
            <div className="min-w-0 flex-1 text-sm text-foreground [&_li]:ml-4 [&_ol]:list-decimal [&_p]:my-1.5 [&_strong]:font-semibold [&_ul]:list-disc [&_h3]:mt-2 [&_h3]:font-semibold">
              <ReactMarkdown>{m.content}</ReactMarkdown>
              <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => void navigator.clipboard?.writeText(m.content)}><Copy size={12} /> Kopiera</button>
            </div>
          </div>
        ))}
        {busy && <p className="flex items-center gap-2 pl-9 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Tänker…</p>}
        {err && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{err}</p>}
      </div>
      {quick && !busy && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {quick.map((q) => <button key={q.label} type="button" onClick={() => void send(q.prompt)} className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-muted">{q.label}</button>)}
        </div>
      )}
      <form className="flex items-end gap-1 border-t border-border p-2" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        {msgs.length > 0 && <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Ny konversation" onClick={() => { setMsgs([]); setErr(null); }}><RotateCcw size={16} /></Button>}
        <textarea value={text} rows={1} maxLength={4000} placeholder={placeholder} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }}
          className="max-h-28 min-h-9 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" aria-label="Skicka" disabled={!text.trim() || busy}><Send size={16} /></Button>
      </form>
    </div>
  );
}

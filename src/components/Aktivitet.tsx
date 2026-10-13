import { useState } from "react";
import { CheckCircle2, FilePen, MessageSquare, MessagesSquare, Plus, XCircle, Send, Trash2, Undo2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Activity, ActivityKind } from "@/lib/avtal-store";

const ICON: Record<ActivityKind, { icon: typeof Send; cls: string }> = {
  skapat: { icon: Plus, cls: "bg-muted text-muted-foreground" },
  version: { icon: FilePen, cls: "bg-muted text-muted-foreground" },
  skickat: { icon: Send, cls: "bg-info/15 text-info" },
  signerat: { icon: CheckCircle2, cls: "bg-success/15 text-success" },
  utkast: { icon: Undo2, cls: "bg-muted text-muted-foreground" },
  forhandling: { icon: MessagesSquare, cls: "bg-primary/20 text-foreground" },
  forlorat: { icon: XCircle, cls: "bg-destructive/15 text-destructive" },
  nedladdat: { icon: Download, cls: "bg-muted text-muted-foreground" },
  notering: { icon: MessageSquare, cls: "bg-primary/15 text-foreground" },
};

export type LogItem = Activity & { avtal?: string | undefined; postId: string };

/** Tidslinje med automatiska händelser och manuella anteckningar (nyast först). */
export function Tidslinje({ items, onAdd, onDelete, canWrite = true }: {
  items: LogItem[]; onAdd?: ((text: string) => void) | undefined; onDelete?: (postId: string, id: string) => void; canWrite?: boolean;
}) {
  const [text, setText] = useState("");
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at));
  const submit = () => { if (!text.trim() || !onAdd) return; onAdd(text); setText(""); };
  return (
    <div className="space-y-3">
      {onAdd && canWrite && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Skriv en anteckning, t.ex. Ringde kunden om förlängning…"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
            className="ds-input resize-none" aria-label="Ny anteckning" />
          <Button onClick={submit} disabled={!text.trim()} className="self-end">Lägg till</Button>
        </div>
      )}
      {sorted.length === 0 && <p className="text-sm text-muted-foreground">Inga aktiviteter ännu. Händelser som "Avtal skickat" och "Avtal signerat" dyker upp här automatiskt.</p>}
      <ol className="space-y-2">
        {sorted.map((x) => {
          const { icon: I, cls } = ICON[x.kind] ?? ICON.notering;
          return (
            <li key={x.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-border bg-card p-3">
              <span className={`mt-0.5 grid h-8 w-8 place-items-center rounded-full ${cls}`}><I size={15} /></span>
              <div className="min-w-0">
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">{x.text}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {new Date(x.at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })} · {x.by}{x.avtal ? ` · ${x.avtal}` : ""}
                </p>
              </div>
              {x.kind === "notering" && onDelete && canWrite ? (
                <button onClick={() => onDelete(x.postId, x.id)} aria-label="Ta bort anteckning" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 size={14} /></button>
              ) : <span />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

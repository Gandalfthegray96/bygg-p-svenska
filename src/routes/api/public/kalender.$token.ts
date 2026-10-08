import { createFileRoute } from "@tanstack/react-router";

type Ev = { id: string; title: string; start: string; end?: string; place?: string; note?: string; source?: string };

const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\r?\n/g, "\\n");

// Prenumerationsflöde för Outlook: appens egna besök som ICS. Skyddas av en hemlig slumpad token per konto.
export const Route = createFileRoute("/api/public/kalender/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token.replace(/\.ics$/i, "");
        if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: feed } = await supabaseAdmin.from("user_data").select("user_id")
          .eq("key", "uc-kalender-feed").eq("value->>token", token).maybeSingle();
        if (!feed) return new Response("Not found", { status: 404 });
        const { data: row } = await supabaseAdmin.from("user_data").select("value")
          .eq("user_id", feed.user_id).eq("key", "uc-kalender").maybeSingle();
        const events = (Array.isArray(row?.value) ? row.value : []) as Ev[];
        const now = fmt(new Date().toISOString());
        const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//UK Portservice//Avtalskalkylator//SV",
          "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:UKPS Servicebesök", "REFRESH-INTERVAL;VALUE=DURATION:PT1H"];
        for (const e of events) {
          if (e.source !== "app" || !e.start || isNaN(Date.parse(e.start))) continue;
          const end = e.end && !isNaN(Date.parse(e.end)) ? e.end : new Date(Date.parse(e.start) + 3600000).toISOString();
          lines.push("BEGIN:VEVENT", `UID:${e.id}@ukportservice`, `DTSTAMP:${now}`, `DTSTART:${fmt(e.start)}`, `DTEND:${fmt(end)}`,
            `SUMMARY:${esc(e.title || "Besök")}`);
          if (e.place) lines.push(`LOCATION:${esc(e.place)}`);
          if (e.note) lines.push(`DESCRIPTION:${esc(e.note)}`);
          lines.push("BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Påminnelse", "END:VALARM", "END:VEVENT");
        }
        lines.push("END:VCALENDAR");
        return new Response(lines.join("\r\n"), {
          headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Hämtar en publicerad Outlook-kalender (ICS-länk) – webbläsaren kan inte göra det direkt p.g.a. CORS.
export const fetchIcs = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ url: z.string().url().max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const url = data.url.replace(/^webcal:/i, "https:");
    if (!/^https:\/\//i.test(url)) throw new Error("Länken måste börja med https://");
    const res = await fetch(url, { headers: { Accept: "text/calendar" } });
    if (!res.ok) throw new Error(`Kunde inte hämta kalendern (${res.status})`);
    const text = await res.text();
    if (!text.includes("BEGIN:VCALENDAR")) throw new Error("Länken är inte en kalender (ICS)");
    return { text: text.slice(0, 3_000_000) };
  });

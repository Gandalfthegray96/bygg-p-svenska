import { createServerFn } from "@tanstack/react-start";
import { buildPushHTTPRequest } from "@pushforge/builder";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { userIds: string[] | "all"; title: string; body: string; url?: string; tag?: string };

/** Skickar bakgrundsnotis (Web Push) till mottagarnas alla registrerade enheter. */
export const sendPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input) => ({
    userIds: d.userIds === "all" ? "all" as const : d.userIds.slice(0, 50),
    title: String(d.title).slice(0, 120),
    body: String(d.body).slice(0, 300),
    url: d.url ? String(d.url).slice(0, 300) : "/",
    tag: d.tag ? String(d.tag).slice(0, 80) : undefined,
  }))
  .handler(async ({ data, context }) => {
    const raw = process.env["VAPID_PRIVATE_JWK"];
    if (!raw) return { sent: 0, error: "VAPID-nyckel saknas" };
    const privateJWK = JSON.parse(raw);
    let ids: string[];
    if (data.userIds === "all") {
      const { data: users } = await context.supabase.rpc("chat_users");
      ids = ((users as { id: string }[]) ?? []).map((u) => u.id);
    } else ids = data.userIds;
    const { data: subs } = await context.supabase.rpc("push_targets", { _user_ids: ids });
    let sent = 0;
    for (const s of (subs as { endpoint: string; p256dh: string; auth: string }[]) ?? []) {
      try {
        const req = await buildPushHTTPRequest({
          privateJWK,
          subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message: { payload: { title: data.title, body: data.body, url: data.url, tag: data.tag }, adminContact: "mailto:info@ukportservice.se", options: { ttl: 86400 } },
        });
        const r = await fetch(req.endpoint, { method: "POST", headers: req.headers, body: req.body });
        if (r.status === 404 || r.status === 410) await context.supabase.rpc("push_drop", { _endpoint: s.endpoint });
        else if (r.ok) sent++;
      } catch (e) { console.error("push", e); }
    }
    return { sent };
  });

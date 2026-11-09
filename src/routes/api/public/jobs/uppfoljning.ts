import { createFileRoute } from "@tanstack/react-router";
import { buildPushHTTPRequest } from "@pushforge/builder";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { canSee, isStale } from "@/lib/uppfoljning";
import type { CustomerFolder } from "@/lib/avtal-store";

/** Morgonkoll: avtal som väntat på svar i över 14 dagar → push till ansvarig säljare och admin. */
export const Route = createFileRoute("/api/public/jobs/uppfoljning")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const raw = process.env["VAPID_PRIVATE_JWK"];
        if (!raw) return Response.json({ sent: 0, error: "VAPID saknas" });
        const privateJWK = JSON.parse(raw);
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

        const [{ data: reg }, { data: roles }, { data: profs }] = await Promise.all([
          db.from("avtal_register").select("folder"),
          db.from("user_roles").select("user_id, role"),
          db.from("profiles").select("id, name"),
        ]);
        const stale = (reg ?? []).map((r) => r.folder as unknown as CustomerFolder).filter((f) => f?.versions && isStale(f));
        if (!stale.length) return Response.json({ sent: 0, stale: 0 });

        const nameOf = new Map((profs ?? []).map((p) => [p.id, p.name ?? ""]));
        const users = (roles ?? []).filter((r) => r.role === "admin" || r.role === "saljare")
          .map((r) => ({ id: r.user_id, role: r.role as string, name: nameOf.get(r.user_id) ?? "" }));

        let sent = 0;
        for (const u of users) {
          const mine = stale.filter((f) => canSee(f.versions.at(-1)!.data.customer?.varRef ?? "", u));
          if (!mine.length) continue;
          const body = mine.length === 1 ? `${mine[0]?.name ?? ""} har väntat på svar i över 14 dagar.` : `${mine.length} avtal har väntat på svar i över 14 dagar: ${mine.slice(0, 3).map((f) => f.name).join(", ")}${mine.length > 3 ? " …" : ""}`;
          const { data: subs } = await db.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", u.id);
          for (const s of subs ?? []) {
            try {
              const req = await buildPushHTTPRequest({
                privateJWK,
                subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                message: { payload: { title: "Avtal att följa upp", body, url: "/", tag: "uppfoljning" }, adminContact: "mailto:info@ukportservice.se", options: { ttl: 43200 } },
              });
              const r = await fetch(req.endpoint, { method: "POST", headers: req.headers, body: req.body });
              if (r.status === 404 || r.status === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
              else if (r.ok) sent++;
            } catch (e) { console.error("push", e); }
          }
        }
        return Response.json({ sent, stale: stale.length });
      },
    },
  },
});

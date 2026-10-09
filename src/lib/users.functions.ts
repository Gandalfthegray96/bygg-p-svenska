import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Works without the service-role key (e.g. on Vercel): everything runs as the
// signed-in user and RLS + has_role() decide what an admin may do.
const Role = z.enum(["admin", "saljare", "tekniker"]);
export type AppRole = z.infer<typeof Role>;

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Endast administratörer får göra detta");
}

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role as AppRole);
    const role: AppRole | null = roles.includes("admin") ? "admin" : roles[0] ?? null;
    return { role };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("profiles").select("id, email, name, created_at").order("created_at");
    if (error) throw new Error(error.message);
    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    return (data ?? []).map((u) => {
      const mine = (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role as AppRole);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.created_at,
        role: (mine.includes("admin") ? "admin" : mine[0] ?? null) as AppRole | null,
        self: u.id === context.userId,
      };
    });
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role: Role.nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("Du kan inte ändra din egen roll");
    const { error: delErr } = await context.supabase.from("user_roles").delete().eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);
    if (data.role) {
      const { error } = await context.supabase.from("user_roles").insert({ user_id: data.userId, role: data.role });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

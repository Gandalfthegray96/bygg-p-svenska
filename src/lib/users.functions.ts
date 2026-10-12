import { supabase } from "@/integrations/supabase/client";

// Runs directly in the browser against the existing database: RLS + has_role()
// decide what an admin may do, so no server environment variables are needed (Vercel).
export type AppRole = "admin" | "saljare" | "tekniker";

async function me() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Inte inloggad");
  return data.user.id;
}

async function assertAdmin(uid: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
  if (error || !data) throw new Error("Endast administratörer får göra detta");
}

export async function getMyRole() {
  const uid = await me();
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
  const roles = (data ?? []).map((r) => r.role as AppRole);
  const role: AppRole | null = roles.includes("admin") ? "admin" : roles[0] ?? null;
  return { role };
}

export async function listUsers() {
  const uid = await me();
  await assertAdmin(uid);
  const { data, error } = await supabase.from("profiles").select("id, email, name, created_at").order("created_at");
  if (error) throw new Error(error.message);
  const { data: roles } = await supabase.from("user_roles").select("user_id, role");
  return (data ?? []).map((u) => {
    const mine = (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role as AppRole);
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.created_at,
      role: (mine.includes("admin") ? "admin" : mine[0] ?? null) as AppRole | null,
      self: u.id === uid,
    };
  });
}

export async function setUserRole({ data }: { data: { userId: string; role: AppRole | null } }) {
  const uid = await me();
  await assertAdmin(uid);
  if (data.userId === uid) throw new Error("Du kan inte ändra din egen roll");
  const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", data.userId);
  if (delErr) throw new Error(delErr.message);
  if (data.role) {
    const { error } = await supabase.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function deleteUser(userId: string) {
  const uid = await me();
  await assertAdmin(uid);
  if (userId === uid) throw new Error("Du kan inte ta bort ditt eget konto");
  const { error } = await supabase.rpc("admin_delete_user", { _user_id: userId });
  if (error) throw new Error(error.message);
}

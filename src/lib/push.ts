import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY = "BJ9AFQNYdcafOnXuZ1KxDJauomteiQS1yzGuWAn_TfT0E6zEtfZKk4SesMECqz_sXNWilfMZnffsA2KfKt10Ihw";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";

function keyBytes(b64: string) {
  const p = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
}

/** Registrerar den här enheten för bakgrundsnotiser. ask=true visar webbläsarens fråga. */
export async function enablePush(ask: boolean): Promise<boolean> {
  if (!pushSupported()) return false;
  if (Notification.permission === "default" && ask) await Notification.requestPermission();
  if (Notification.permission !== "granted") return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await supabase.from("push_subscriptions").delete().eq("endpoint", j.endpoint);
  await supabase.from("push_subscriptions").insert({ user_id: user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
  return true;
}

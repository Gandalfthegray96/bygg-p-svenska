import { PDFDocument } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { type Attachments, type AttachmentSlot, type AttachmentFile, withUpdatedPriceList } from "./bilagor-model";
import { normalizeAvtal } from "./kalkyl";
import { normalizeFolder } from "./avtal-store";

const BUCKET = "avtal-bilagor";
const CACHE_KEY = "uc-bilaga-defaults";

export function cachedAttachments(): Attachments {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
}

export async function fetchAttachments(): Promise<Attachments> {
  const { data, error } = await supabase.from("agreement_attachment_templates").select("slot, file");
  if (error) throw new Error("Kunde inte hämta bilagorna. Försök igen.");
  const files: Attachments = {};
  for (const row of data ?? []) {
    if (row.slot !== "cost" && row.slot !== "price") continue;
    const f = row.file as unknown as AttachmentFile;
    if (f?.path && f?.name) files[row.slot] = f;
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(files));
  return files;
}

export async function uploadAttachment(slot: AttachmentSlot, file: File): Promise<Attachments> {
  if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error("Välj en PDF-fil.");
  const bytes = await file.arrayBuffer();
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(bytes); } catch { throw new Error("PDF-filen kan inte läsas. Välj en PDF utan lösenord."); }
  if (!doc.getPageCount()) throw new Error("PDF-filen saknar sidor.");
  const path = `${slot}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw new Error("Kunde inte ladda upp PDF-filen. Kontrollera din anslutning och försök igen.");
  const value: AttachmentFile = { path, name: file.name, uploadedAt: new Date().toISOString() };
  const { error } = await supabase.from("agreement_attachment_templates").upsert({ slot, file: value as unknown as Json, updated_at: value.uploadedAt });
  if (error) throw new Error("Filen laddades upp men kunde inte väljas som bilaga. Försök igen.");
  return fetchAttachments();
}

export async function resetAttachment(slot: AttachmentSlot): Promise<Attachments> {
  const { error } = await supabase.from("agreement_attachment_templates").delete().eq("slot", slot);
  if (error) throw new Error("Kunde inte återställa bilagan.");
  return fetchAttachments();
}

export async function attachmentBytes(file: AttachmentFile): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(file.path);
  if (error || !data) throw new Error(`Kunde inte hämta bilagan ${file.name}. Kontrollera anslutningen.`);
  return data.arrayBuffer();
}

/** Read fresh rows and append versions, never mutate historical documents. RLS enforces admin. */
export async function updateOldPriceLists(ids: string[], price: AttachmentFile): Promise<number> {
  if (!ids.length) return 0;
  const { data: role, error: roleError } = await supabase.rpc("has_role", { _user_id: (await supabase.auth.getUser()).data.user?.id ?? "", _role: "admin" });
  if (roleError || !role) throw new Error("Endast admin kan uppdatera prislistor.");
  const { data, error } = await supabase.from("avtal_register").select("name, folder").in("name", ids);
  if (error) throw new Error("Kunde inte hämta avtalen.");
  const { data: user } = await supabase.auth.getUser();
  const { data: profile } = user.user ? await supabase.from("profiles").select("name").eq("id", user.user.id).maybeSingle() : { data: null };
  const at = new Date().toISOString();
  const updates = [];
  for (const row of data ?? []) {
    const folder = normalizeFolder(row.name, row.folder as unknown as Parameters<typeof normalizeFolder>[1]);
    const last = folder.versions.at(-1);
    if (!last || folder.uppsagd || last.data.attachments?.price?.path === price.path) continue;
    const version = last.version + 1;
    folder.versions.push({ version, savedAt: at, status: last.status, data: withUpdatedPriceList(normalizeAvtal(last.data), price) });
    (folder.log ??= []).push({ id: crypto.randomUUID(), at, by: profile?.name || "Admin", kind: "version", text: `Prislista uppdaterad: ${price.name} (v${version}). Övriga bilagor och avtalsuppgifter oförändrade.` });
    updates.push({ name: row.name, folder: folder as unknown as Json, updated_at: at, updated_by: user.user?.id });
  }
  if (!updates.length) return 0;
  const { error: writeError } = await supabase.from("avtal_register").upsert(updates);
  if (writeError) throw new Error("Kunde inte spara uppdateringen av prislistorna.");
  return updates.length;
}
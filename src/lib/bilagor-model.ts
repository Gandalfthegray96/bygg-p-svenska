import type { Avtal } from "./kalkyl";

export type AttachmentSlot = "cost" | "price" | "cover" | "contract";
export type AttachmentFile = { path: string; name: string; uploadedAt: string };
export type Attachments = Partial<Record<AttachmentSlot, AttachmentFile>>;
export const ATTACHMENT_SLOTS: AttachmentSlot[] = ["cover", "contract", "cost", "price"];
export const ATTACHMENT_LABELS: Record<AttachmentSlot, string> = {
  cover: "Försättsblad",
  contract: "Huvudavtal (villkorssidor inkl. signatursida)",
  cost: "Bilaga 1 – Kostnad",
  price: "Bilaga 2 – Prislista",
};
export const ATTACHMENT_DEFAULTS: Record<AttachmentSlot, string> = {
  cover: "Originalförsättsblad (fylls i automatiskt)",
  contract: "Originalavtal (fylls i automatiskt)",
  cost: "Automatisk kostnadsbilaga",
  price: "Originalprislista",
};

/** Older agreements may receive only the price list; all other content is preserved. */
export function withUpdatedPriceList(a: Avtal, price: AttachmentFile): Avtal {
  return { ...a, attachments: { ...a.attachments, price } };
}

import type { Avtal } from "./kalkyl";

export type AttachmentSlot = "cost" | "price";
export type AttachmentFile = { path: string; name: string; uploadedAt: string };
export type Attachments = Partial<Record<AttachmentSlot, AttachmentFile>>;
export const ATTACHMENT_LABELS: Record<AttachmentSlot, string> = { cost: "Bilaga 1 – Kostnad", price: "Bilaga 2 – Prislista" };

/** Older agreements may receive only the price list; all other content is preserved. */
export function withUpdatedPriceList(a: Avtal, price: AttachmentFile): Avtal {
  return { ...a, attachments: { ...a.attachments, price } };
}
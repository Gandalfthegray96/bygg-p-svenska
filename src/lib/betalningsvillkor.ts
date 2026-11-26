import type { Avtal } from "./kalkyl";

export const BETALNINGSDAGAR = [14, 30, 45, 60] as const;
export const STANDARD_BETALNINGSTID = "30 dagar netto";

export function betalningstid(a: Pick<Avtal, "betalningstid">): string {
  return a.betalningstid?.replace(/\s+/g, " ").trim() || STANDARD_BETALNINGSTID;
}

export function betalningsrad(a: Pick<Avtal, "betalningstid">): string {
  const text = betalningstid(a);
  return `Betalningstid: ${text}${/[.!?]$/.test(text) ? "" : "."}`;
}
import { describe, it, expect } from "vitest";
import { isStale, canSee } from "./uppfoljning";
const f = (days: number, status = "skickat") => ({ id: "x", name: "K", versions: [{ version: 1, savedAt: new Date(Date.now() - days * 864e5).toISOString(), status, data: { customer: { varRef: "Anna Berg" } } }] }) as never;
describe("uppföljning", () => {
  it("flaggar skickat efter 14 dagar", () => { expect(isStale(f(14))).toBe(true); expect(isStale(f(13))).toBe(false); });
  it("flaggar inte andra statusar", () => { expect(isStale(f(30, "signerat"))).toBe(false); });
  it("admin ser alla, säljare egna, tekniker inga", () => {
    expect(canSee("Anna Berg", { role: "admin", name: "X" })).toBe(true);
    expect(canSee("Anna Berg", { role: "saljare", name: "Anna Berg" })).toBe(true);
    expect(canSee("Anna Berg", { role: "saljare", name: "Per Ek" })).toBe(false);
    expect(canSee("Anna Berg", { role: "tekniker", name: "Anna Berg" })).toBe(false);
  });
});

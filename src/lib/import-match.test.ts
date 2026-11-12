import { describe, expect, it } from "vitest";
import { matchPosts } from "./import-match";
import type { CustomerFolder } from "./avtal-store";

const post = (id: string, name: string, anlAdress: string, avtalNr = ""): CustomerFolder =>
  ({ id, name, versions: [{ version: 1, savedAt: "", data: { customer: { anlAdress, avtalNr } } as never }] });
const store = { a: post("a", "Tingstad Papper 5067", "Marieholmsgatan 1-3, Göteborg"), b: post("b", "Tingstad Papper 5067", "Tagenevägen 80, Hisings Kärra"), c: post("c", "Saltex AB", "Gråbovägen 19", "GS_1234") };

describe("matchPosts", () => {
  it("avtalsnr ger säker träff", () => expect(matchPosts(store, { kund: "", avtalNr: "gs_1234", adress: "", path: "x.pdf" })[0]?.id).toBe("c"));
  it("adressen väljer rätt anläggning hos samma kund", () =>
    expect(matchPosts(store, { kund: "Tingstad Papper", avtalNr: "", adress: "Tagenevägen 80, Hisings Kärra", path: "x.pdf" })[0]?.id).toBe("b"));
  it("kundmappens namn räcker", () => expect(matchPosts(store, { kund: "", avtalNr: "", adress: "", path: "Kunder/Saltex/AV/a.pdf" })[0]?.id).toBe("c"));
  it("okänd kund ger ingen träff", () => expect(matchPosts(store, { kund: "Volvo Cars", avtalNr: "", adress: "", path: "Volvo/a.pdf" })).toHaveLength(0));
});

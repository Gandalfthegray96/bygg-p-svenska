import { describe, expect, test } from "bun:test";
import { calculate, emptyAvtal, facilitiesOf, normalizeAvtal, rowsByFacility } from "./kalkyl";

describe("serviceadresser", () => {
  test("äldre avtal utan adresslista får en standardadress från kunduppgifterna", () => {
    const a = normalizeAvtal({ ...emptyAvtal(), customer: { ...emptyAvtal().customer, anlAdress: "Storgatan 1" } });
    expect(a.facilities).toBeUndefined();
    const f = facilitiesOf(a);
    expect(f).toHaveLength(1);
    expect(f[0].address).toBe("Storgatan 1");
  });
  test("normalisering ändrar inte priset för befintliga avtal", () => {
    const a = emptyAvtal();
    expect(calculate(normalizeAvtal(a))).toEqual(calculate(a));
  });
  test("objekt fördelas per adress, okänd adress hamnar på första", () => {
    const a = normalizeAvtal({
      ...emptyAvtal(),
      facilities: [
        { id: "g", name: "Göteborg", address: "A", pricingType: "gemensam" },
        { id: "k", name: "Kungsbacka", address: "B", pricingType: "gemensam" },
      ],
      rows: [{ ...emptyAvtal().rows[0], id: "1", facilityId: "k" }, { ...emptyAvtal().rows[0], id: "2", facilityId: "x" }],
    });
    const by = rowsByFacility(a);
    expect(by.k.map((r) => r.id)).toEqual(["1"]);
    expect(by.g.map((r) => r.id)).toEqual(["2"]);
  });
});

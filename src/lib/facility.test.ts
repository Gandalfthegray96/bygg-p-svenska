import { test, expect } from "bun:test";
import { calculate, emptyAvtal, facilitiesOf, newRow, normalizeAvtal, rowsByFacility } from "./kalkyl";

test("äldre avtal utan adresslista får en standardadress från kunduppgifterna", () => {
  const a = normalizeAvtal({ ...emptyAvtal(), customer: { ...emptyAvtal().customer, anlAdress: "Storgatan 1" } });
  expect(a.facilities === undefined).toBe(true);
  const f = facilitiesOf(a);
  expect(f.length).toBe(1);
  expect(f[0]?.address).toBe("Storgatan 1");
});

test("normalisering ändrar inte priset för befintliga avtal", () => {
  const a = emptyAvtal();
  expect(JSON.stringify(calculate(normalizeAvtal(a)))).toBe(JSON.stringify(calculate(a)));
});

test("objekt fördelas per adress, okänd adress hamnar på första", () => {
  const a = normalizeAvtal({
    ...emptyAvtal(),
    facilities: [
      { id: "g", name: "Göteborg", address: "A", pricingType: "gemensam" },
      { id: "k", name: "Kungsbacka", address: "B", pricingType: "gemensam" },
    ],
    rows: [{ ...newRow(), id: "1", facilityId: "k" }, { ...newRow(), id: "2", facilityId: "x" }],
  });
  const by = rowsByFacility(a);
  expect((by["k"] ?? []).map((r) => r.id).join()).toBe("1");
  expect((by["g"] ?? []).map((r) => r.id).join()).toBe("2");
});

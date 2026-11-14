import { expect, test } from "bun:test";
import { applyPriceChoice, reviewPrice, withImportedRows } from "./price-review";
import { calculate, emptyAvtal } from "./kalkyl";

const base = () => withImportedRows(emptyAvtal(), [{ name: "Takskjutport", qty: 3 }], 2, 3730);
test("avvikelse visas utan att priset ändras", () => {
  const a = base();
  const r = reviewPrice(a, 3730);
  expect(r.document).toBe(3730);
  expect(r.diff).toBe(3730 - r.calculated);
  expect(a.adjust).toBe("");
});
test("valt avtalspris ger exakt dokumentets årspris", () => {
  expect(Math.round(calculate(applyPriceChoice(base(), 3730, "avtal")).perYear)).toBe(3730);
});
test("valt kalkylpris tar bort all utjämning", () => {
  const a = applyPriceChoice(base(), 3730, "kalkyl");
  expect(a.adjust).toBe("");
});
test("utan dokumentpris skrivs inga objekt", () => {
  const a = withImportedRows(emptyAvtal(), [{ name: "Port", qty: 9 }], 2, null);
  expect(a.rows).toEqual(emptyAvtal().rows);
  expect(reviewPrice(a, null).level).toBe("saknas");
});

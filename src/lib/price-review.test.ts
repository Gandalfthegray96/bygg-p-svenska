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
  expect(a.rows.some((r) => r.name === "Port")).toBe(false);
  expect(reviewPrice(a, null).level).toBe("saknas");
});
test("document-only import preserves the original adjustment", () => {
  const a = emptyAvtal(); a.adjust = "150";
  expect(withImportedRows(a, [], 2, 8062).adjust).toBe("150");
  expect(withImportedRows(a, [{ name: "Port", qty: 9 }], 2, null).adjust).toBe("150");
});
test("Herbert explicit agreement choice yields 4031 per visit and 8062 per year", () => {
  const a = withImportedRows(emptyAvtal(), [{ name: "Takskjutport", qty: 2 }, { name: "Snabbrullport", qty: 2 }, { name: "Lastbrygga/lyftbord", qty: 2 }], 2, 8062);
  const calculated = calculate(applyPriceChoice(a, 8062, "avtal"));
  expect(calculated.perYear).toBe(8062);
  expect(calculated.visits[0]?.perVisit).toBe(4031);
});

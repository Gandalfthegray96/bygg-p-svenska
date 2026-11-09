import { expect, test } from "bun:test";
import { emptyAvtal } from "./kalkyl";
import { withUpdatedPriceList } from "./bilagor-model";

test("gamla avtal uppdaterar endast prislistan, inte kostnadsbilagan eller kalkylen", () => {
  const cost = { path: "cost/old.pdf", name: "Kostnad.pdf", uploadedAt: "2026-11-01" };
  const a = { ...emptyAvtal(), attachments: { cost } };
  const price = { path: "price/new.pdf", name: "Prislista.pdf", uploadedAt: "2026-11-09" };
  const updated = withUpdatedPriceList(a, price);
  expect(updated.attachments?.price).toEqual(price);
  expect(updated.attachments?.cost).toEqual(cost);
  expect(updated.hourRate).toBe(975);
  expect(a.attachments).toEqual({ cost });
});
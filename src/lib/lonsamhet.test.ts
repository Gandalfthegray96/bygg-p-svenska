import { expect, test } from "bun:test";
import { lonsamhet, normalizeAvtal } from "./kalkyl";

test("självkostnad 508 kr/h och 350 kr per framkörning", () => {
  const a = normalizeAvtal({ hourRate: 975, tripFee: 745, discount: 0, adjust: "0", rows: [{ qty: 1, minutes: 60, visits: 1 }] } as never);
  const l = lonsamhet(a);
  expect(l.kostnad).toBe(508 + 350);
  expect(l.tb).toBe(975 + 745 - 858);
});

test("admin-ändrad självkostnad används i TB", () => {
  const a = normalizeAvtal({ hourRate: 975, tripFee: 745, discount: 0, adjust: "0", rows: [{ qty: 1, minutes: 60, visits: 1 }] } as never);
  expect(lonsamhet(a, { kostnadTimme: 600, kostnadFramkorning: 400 }).kostnad).toBe(1000);
});

import { expect, test } from "bun:test";
import { emptyAvtal, indexera } from "./kalkyl";

test("indexreglering 2,5 % räknar upp timpeng och framkörning", () => {
  const n = indexera(emptyAvtal(), 2.5);
  expect(n.hourRate).toBe(999.38);
  expect(n.tripFee).toBe(763.63);
});

test("indexreglering räknar upp utjämningen", () => {
  expect(indexera({ ...emptyAvtal(), adjust: "100" }, 10).adjust).toBe("110");
});

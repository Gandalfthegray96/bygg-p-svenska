import { expect, test } from "bun:test";
import { foreslaVeckor, kvartal } from "./planering";

test("veckor mappas till kvartal som i Excel", () => {
  expect([kvartal(1), kvartal(13), kvartal(14), kvartal(26), kvartal(27), kvartal(39), kvartal(40), kvartal(52)].join()).toBe("1,1,2,2,3,3,4,4");
});
test("två besök från v4 hamnar v4 och v30", () => {
  expect(foreslaVeckor(2, 4).join()).toBe("4,30");
});

import { gissaFilial as gf } from "./planering";
test("Borås-adress ger filial Borås, annars Göteborg", () => {
  expect(gf("Storgatan 1, 503 30 Borås")).toBe("BORAS");
  expect(gf("Hamngatan 2, Göteborg")).toBe("GBG");
});

import { filialFor } from "./planering";
test("Skene räknas till Borås och sparad filial vinner", () => {
  expect(gf("Gränevägen 7, Skene")).toBe("BORAS");
  expect(filialFor(undefined, "Ekenleden 2, Göteborg")).toBe("GBG");
  expect(filialFor("BORAS", "Ekenleden 2, Göteborg")).toBe("BORAS");
});

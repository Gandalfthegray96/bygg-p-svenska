import { expect, test } from "vitest";
import { nextAvtalNr } from "./avtalsnr";

test("nästa avtalsnummer behåller prefix och nollor", () => {
  expect(nextAvtalNr("ALS_A0114")).toBe("ALS_A0115");
  expect(nextAvtalNr("ALS_A0999")).toBe("ALS_A1000");
});

test("utan siffror föreslås inget nummer", () => {
  expect(nextAvtalNr("ABC")).toBe("");
});

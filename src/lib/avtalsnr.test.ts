import { expect, test } from "bun:test";
import { nextAvtalNr, nextFromRegister, shouldUpdateLast } from "./avtalsnr";

test("nästa avtalsnummer behåller prefix och nollor", () => {
  expect(nextAvtalNr("ALS_A0114")).toBe("ALS_A0115");
  expect(nextAvtalNr("ALS_A0999")).toBe("ALS_A1000");
});

test("utan siffror föreslås inget nummer", () => {
  expect(nextAvtalNr("ABC")).toBe("");
});

test("nästa nummer fortsätter efter högsta i registret i samma serie", () => {
  expect(nextFromRegister("ALS_A0114", ["ALS_A0119", "DANE_C0200", "G------"])).toBe("ALS_A0120");
});

test("gamla avtal utan siffror eller annan serie skriver inte över senaste numret", () => {
  expect(shouldUpdateLast("ALS_A0119", "G------")).toBe(false);
  expect(shouldUpdateLast("ALS_A0119", "DANE_C0033")).toBe(false);
  expect(shouldUpdateLast("ALS_A0119", "ALS_A0110")).toBe(false);
  expect(shouldUpdateLast("ALS_A0119", "ALS_A0120")).toBe(true);
});

test("utan vald serie får sparande av ett äldre avtal inte välja serie", () => {
  expect(shouldUpdateLast("G------", "ALS_A0120")).toBe(false);
  expect(shouldUpdateLast("", "DANE_C0033")).toBe(false);
});

test("redan högre personligt nummer sänks inte av registret", () => {
  expect(nextFromRegister("ALS_A0120", ["ALS_A0119"])).toBe("ALS_A0121");
});

import { expect, test } from "bun:test";
import { betalningstid, BETALNINGSDAGAR } from "./betalningsvillkor";
import { calculate, emptyAvtal, normalizeAvtal } from "./kalkyl";
import { diffAvtal } from "./avtal-diff";

test("äldre avtal och tomma villkor använder 30 dagar netto", () => {
  expect(betalningstid({})).toBe("30 dagar netto");
  expect(betalningstid({ betalningstid: "  " })).toBe("30 dagar netto");
});

test("snabbvalen är 14, 30, 45 och 60 dagar", () => {
  expect(JSON.stringify(BETALNINGSDAGAR)).toBe("[14,30,45,60]");
});

test("egna betalningsvillkor behålls mellan serialiserade versioner", () => {
  const a = { ...emptyAvtal(), betalningstid: "45 dagar efter godkänd faktura" };
  expect(betalningstid(normalizeAvtal(JSON.parse(JSON.stringify(a))))).toBe("45 dagar efter godkänd faktura");
});

test("betalningstid ändrar inga kalkylvärden och registreras som en ändring", () => {
  const a = emptyAvtal(), b = { ...a, betalningstid: "60 dagar netto" };
  expect(JSON.stringify(calculate(b))).toBe(JSON.stringify(calculate(a)));
  expect(diffAvtal(a, b).length).toBe(1);
  expect(diffAvtal(a, { ...a, betalningstid: "30 dagar netto" }).length).toBe(0);
});
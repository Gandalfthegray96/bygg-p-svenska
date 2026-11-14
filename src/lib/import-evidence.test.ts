import { expect, test } from "bun:test";
import { importNumber, priceLabel, verifyKalkyl, type ReadPrice } from "./import-evidence";
import { classify, parseKalkyler, textPrices } from "./pdf-import";
import { parseGsMall, parseLegacyRows, parseLegacyText } from "./kalkyl-import";

const source = { file: "kund.pdf", location: "Sida 2" };
const price = (type: ReadPrice["type"], value: number, years?: number): ReadPrice => ({ type, value, ...(years === undefined ? {} : { years }), source });
const check = (prices: ReadPrice[], declaredObjects = 7) => verifyKalkyl({ source, prices, objects: 7, declaredObjects, visits: 2, visitsExplicit: true });

test("1865 kr per besök ger 3730 per år, inte standardkalkyl", () => {
  expect(check([price("besok", 1865)]).perYear).toBe(3730);
  expect(check([price("besok", 1865)]).evidence.perVisit).toBe(1865);
});
test("årspris multipliceras inte med besök", () => {
  expect(check([price("ar", 3730)]).perYear).toBe(3730);
});
test("5-årsbelopp bevaras och divideras endast en gång", () => {
  expect(check([price("period", 18650, 5)]).perYear).toBe(3730);
  expect(check([price("period", 18650, 5)]).evidence.periodTotal).toBe(18650);
  expect(priceLabel("Totalsumma 5 år")?.years).toBe(5);
});
test("motstridiga priser lämnar årspriset olöst", () => {
  const result = check([price("besok", 1865), price("ar", 4344)]);
  expect(result.perYear).toBe(null);
  expect(result.evidence.verification.checks.some((c) => c.check === "prismodell" && !c.passed)).toBe(true);
});
test("7 objekt mot dokumentets 9 ger konkret avvikelse", () => {
  const result = check([price("ar", 3730)], 9);
  expect(result.evidence.verification.checks.find((c) => c.check === "objektantal")?.passed).toBe(false);
  expect(result.evidence.verification.confidence).toBe("lag");
});
test("saknat besöksantal markeras som antagande", () => {
  const result = verifyKalkyl({ source, prices: [price("besok", 1865)], objects: 7, declaredObjects: 7, visits: 2, visitsExplicit: false });
  expect(result.evidence.visitsExplicit).toBe(false);
  expect(result.evidence.verification.confidence).toBe("lag");
});
test("svenska och historiska belopp läses utan tusentalsfel", () => {
  expect(importNumber("4,600 : -")).toBe(4600);
  expect(importNumber("1.865,50 kr")).toBe(1865.5);
  expect(importNumber("1 865,50 kr")).toBe(1865.5);
  expect(importNumber("okänt")).toBe(null);
});
test("PDF-källa har rätt sida och rad för 5-årspriset", () => {
  const prices = textPrices("Avtal\n\f\nTotalsumma 5 år: 18 650 kr", "original.pdf");
  expect(prices[0]?.type).toBe("period");
  expect(prices[0]?.value).toBe(18650);
  expect(prices[0]?.source.location.startsWith("Sida 2,")).toBe(true);
  expect(classify("Underhållsavtal\nAvt.nr 1234\nTotalsumma 5 år: 18 650 kr", "a.pdf", "a.pdf", "Kund").perYear).toBe(3730);
});
test("lika tabeller vid olika serviceadresser bevaras var för sig", () => {
  const table = "Objekt Antal\nTakskjutport 3\nTotalt antal objekt 3\nAntal service per år 2\nPris per besök 1 865 kr";
  const ks = parseKalkyler(`Serviceadress: Gatan 1\n${table}\nServiceadress: Gatan 2\n${table}`, "avtal.pdf");
  expect(ks.length).toBe(2);
  expect(ks[0]?.adress).toBe("Gatan 1");
  expect(ks[1]?.adress).toBe("Gatan 2");
  expect(ks[1]?.perYear).toBe(3730);
});
test("prislista på nästa PDF-sida blir inte objekt", () => {
  const ks = parseKalkyler("Objekt Antal\nTakskjutport 3\nTotalt antal objekt 3\nAntal service per år 2\nPris per besök 1 865 kr\n\f\nTimdebitering 975\nMaterial 350", "avtal.pdf");
  expect(ks[0]?.objekt.reduce((s, o) => s + o.qty, 0)).toBe(3);
});
test("FU GS hittar namngiven totalkolumn när den flyttats från E till F", () => {
  const k = parseGsMall({ Kalkyl: [["Produkt", "Antal", "Tid"], ["Vikport", 3, 30], ["Summa", 3], ["Kostnad/tillfälle", "Framkörning", "Arbete", "Övrigt", "Notering", "Totalt"], [null, 745, 1462, 0, null, 2207]], Utskrift: [["Antal servicetillfälle", 2]] }, "gs.xlsx");
  expect(k?.perYear).toBe(4414);
  expect(k?.evidence?.prices[0]?.source.location).toBe("Kalkyl!F5");
});
test("äldre Excel kontrollerar totalsumman och behåller prisets cellreferens", () => {
  const k = parseLegacyRows([["Objekt/typ", "Antal objekt"], ["Takskjutport", 7], ["Totalt antal objekt", 9], ["Antal service per år", 2], ["Pris per besök", 1865]], "Blad1", "fu.xlsx");
  expect(k?.evidence?.verification.checks.find((c) => c.check === "objektantal")?.passed).toBe(false);
  expect(k?.evidence?.prices[0]?.source.location).toBe("Blad1!B5");
});

test("äldre PDF får riktig sidreferens och stannar före nästa sida", () => {
  const k = parseLegacyText("Avtal\n\f\nObjekt/typ Antal objekt\nTakskjutport 3 x 350 kr = 1050 kr\nTotalt antal objekt 3\nAntal service per år 2\nSumma per servicetillfälle 1 865 kr\n\f\nMaterial 900", "kund.pdf")[0];
  expect(k?.objekt.reduce((s, o) => s + o.qty, 0)).toBe(3);
  expect(k?.perYear).toBe(3730);
  expect(k?.evidence?.prices[0]?.source.location.startsWith("Sida 2, rad")).toBe(true);
});
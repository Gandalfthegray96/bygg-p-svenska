import { expect, test } from "bun:test";
import { excelKalkyler, parseLegacyRows, parseLegacyText } from "./kalkyl-import";

const rows = [
  ["Objekt/typ", "Antal objekt", null, "Pris/st.", null, "Summa"],
  ["Takskjutport", 1, "x", 350, "=", 350],
  ["Vikport", null, "x", 350, "=", 0],
  ["Totalt antal objekt", 1],
  ["Extra för eldrifter", 1, "x", 175, "=", 175],
  ["Framkörning", null, null, null, null, 650],
  ["Antal servicetillfällen per år", null, null, 2],
  ["TOTAL SUMMA per servicetillfälle", null, null, null, null, 1000],
];
test("äldre FU: bara faktiska objekt, inte summering eller eldriftstillägg", () => {
  expect(JSON.stringify(parseLegacyRows(rows, "Blad1")?.objekt)).toBe(JSON.stringify([{ name: "Takskjutport", qty: 1 }]));
});
test("äldre FU: 1000 kr per besök med 2 besök ger 2000 kr per år", () => {
  expect(parseLegacyRows(rows, "Blad1")?.perYear).toBe(2000);
  expect(parseLegacyRows(rows, "Blad1")?.besokPerAr).toBe(2);
});
test("okänt pris lämnas tomt, räknas inte från gissade styckpriser", () => {
  expect(parseLegacyRows(rows.slice(0, -1), "Blad1")?.perYear).toBe(null);
});
test("äldre FU som PDF-utskrift läser antal utan styckpriser som objekt", () => {
  const k = parseLegacyText("Objekt/typ Antal objekt Pris/st. Summa\nTakskjutport 1 x 350 kr = 350 kr\nVikport x 350 kr = 0 kr\nTotalt antal objekt 1\nFramkörning 650 kr\nAntal servicetillfällen per år 2\nTOTAL SUMMA per servicetillfälle 1 000 kr");
  expect(JSON.stringify(k[0]?.objekt)).toBe(JSON.stringify([{ name: "Takskjutport", qty: 1 }]));
  expect(k[0]?.perYear).toBe(2000);
});
test("Excel läses inklusive sparade formelresultat", async () => {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["F8"] = { t: "n", f: "SUM(F2:F6)", v: 1000 };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Blad1");
  const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" });
  expect((await excelKalkyler(bytes))[0]?.perYear).toBe(2000);
});
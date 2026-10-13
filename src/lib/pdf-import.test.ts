import { expect, test } from "bun:test";
import { classify, parseObjekt } from "./pdf-import";

test("dagens avtal blir grönt", () => {
    const t = "FÖREBYGGANDE UNDERHÅLLSAVTAL\nAvtal nr: FU-1234\nBeställare: Bygg AB\n2025-03-01\nKostnad per år (exkl. moms): 12 345,00 kr";
    const h = classify(t, "a.pdf", "x/a.pdf", "Bygg AB");
    expect(h.kind).toBe("ok");
    expect(h.avtalNr).toBe("FU-1234");
    expect(h.perYear).toBe(12345);
});
test("faktura sorteras bort", () => {
    expect(classify("Faktura nr 55\nAtt betala 900 kr", "f.pdf", "f.pdf", "K").kind).toBe("ej");
});
test("gammalt avtal utan avtalsnr ska granskas, kund från mappen", () => {
    const h = classify("Serviceavtal portar\nPris enligt överenskommelse", "gammal.pdf", "Kund X/gammal.pdf", "Kund X");
    expect(h.kind).toBe("granska");
    expect(h.kund).toBe("Kund X");
});

test("objekttabellen i Bilaga 1 läses in", () => {
  const t = "Bilaga 1\nObjekt Antal\nTakskjutport 3\nLastbrygga 2\nTotalt antal objekt: 5\nAntal servicetillfällen per år: 2\nKostnad per år (exkl. moms): 12 000,00 kr";
  const r = parseObjekt(t);
  expect(JSON.stringify(r.objekt)).toBe(JSON.stringify([{ name: "Takskjutport", qty: 3 }, { name: "Lastbrygga", qty: 2 }]));
  expect(r.besokPerAr).toBe(2);
});

test("formulärfält och 'E-post Faktura' ger inte fel klassning, flera kalkyler hittas", () => {
  const t = "[[Fält Kund 2: Essity AB]]\n[[Fält Dokument beteckning: LIH_C0157]]\nAvtal mellan parter\nE-post Faktura:\nLilla Edet\nObjekt Antal\nPort el 71\nAntal servicetillfällen per år: 2\nKostnad per år (exkl. moms): 81 400,00 kr\nMölnlycke\nObjekt Antal\nRullport 16 Lyftbord 2\nKostnad per år (exkl. moms): 26 200,00 kr";
  const h = classify(t, "a.pdf", "a.pdf", "X");
  expect(h.kind).toBe("granska");
  expect(h.kund).toBe("Essity AB");
  expect(h.avtalNr).toBe("LIH_C0157");
  expect(h.kalkyler.length).toBe(2);
  expect(h.kalkyler[1]!.objekt.length).toBe(2);
  expect(h.perYear).toBe(107600);
});

test("avtalsnr ur filnamn och korta mappnamn ignoreras", () => {
  const { avtalNrFromFile: f } = require("./pdf-import");
  expect(f("OF LIH_C0157-1.pdf")).toBe("LIH_C0157");
  const h = classify("Kalkyl utan rubrik", "OF LIH_C0157.pdf", "OF/A/OF LIH_C0157.pdf", "A");
  expect(h.avtalNr).toBe("LIH_C0157");
  expect(h.kund).toBe("");
});

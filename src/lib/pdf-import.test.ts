import { expect, test } from "bun:test";
import { classify, parseInfo, parseObjekt } from "./pdf-import";

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

test("läser ansvarig och kunduppgifter", () => {
  const i = parseInfo("Vår Referens: Andre Linder\nEr Referens: Kalle Ek\nTelefon: 070-123 45 67\nE-post: kalle@ek.se\nOrg.nr: 556737-5026");
  expect(JSON.stringify(i)).toBe(JSON.stringify({ varRef: "Andre Linder", erRef: "Kalle Ek", telefon: "070-123 45 67", epost: "kalle@ek.se", orgNr: "556737-5026" }));
});

import { classify as classify2, perVisitOf } from "./pdf-import";
test("historical company field and delivery address identify Herbert, not signature labels", () => {
  const h = classify("FU - AVTAL\nAvser förebyggande underhåll\nBESTÄLLARE\nFöretag: AB Herbert Karlssons Charkuterifabrik\nLeveransadress: Industrivägen 4, Härryda\nBeställare UK Portservice AB\nBeställare: Leverantör: Daniel", "AV_Förslag_DANE_C0033.pdf", "avtal.pdf", "");
  expect(h.kund).toBe("AB Herbert Karlssons Charkuterifabrik");
  expect(h.adress).toBe("Industrivägen 4, Härryda");
});
test("CO_BE166 uses the customer form field rather than the supplier signature", () => {
  const h = classify("[[Fält Kund: Gäsene Mejeriförening]]\n[[Fält Projekt: Alingsåsvägen 32 Ljung]]\nSERVICEAVTAL\nBeställare: Leverantör: Conny Berntsson", "Avtal.CO_BE166.pdf", "avtal.pdf", "");
  expect(h.kund).toBe("Gäsene Mejeriförening");
  expect(h.adress).toBe("Alingsåsvägen 32 Ljung");
});
test("Mobigo checklist is not an agreement despite preventive maintenance wording", () => {
  expect(classify("Checklista/Protokoll\nX Förebyggande underhåll\nOrdernr\nKund Herbert", "2410_Herbert.pdf", "2410.pdf", "Herbert").kind).toBe("ej");
});
test("scanned signed agreement remains for review instead of discarded", () => {
  expect(classify("\f\n", "Sig.Avtal_DANE_C0033.pdf", "scan.pdf", "").kind).toBe("granska");
});
test("besökspris läses och räknas om till årspris", () => {
  expect(perVisitOf("Summa per servicetillfälle exkl moms 1 865:-")).toBe(1865);
  expect(perVisitOf("Pris: 1865 kr/besök")).toBe(1865);
  const h = classify2("Förebyggande underhåll\nAvt.nr 5266\nAntal service per år 2\nPris per besök: 1 865 kr", "avtal.pdf", "Montano/avtal.pdf", "Montano");
  expect(h.avtalNr).toBe("5266");
  expect(h.perYear).toBe(3730);
});

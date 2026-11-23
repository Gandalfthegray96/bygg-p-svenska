import { expect, test } from "bun:test";
import { emptyAvtal, newRow } from "./kalkyl";
import { diffAvtal, diffPlanering, sentence } from "./avtal-diff";

  test("tillagd port beskrivs med namn", () => {
    const a = emptyAvtal();
    const b = structuredClone(a);
    b.rows.push({ ...newRow(), name: "Takskjutport", qty: 1, visits: 2 });
    expect(sentence("Alexsander Östrand", diffAvtal(a, b)).startsWith("Alexsander Östrand lade till 1 st Takskjutport")).toBe(true);
  });
  test("ändrad rabatt loggas", () => {
    const a = emptyAvtal(); const b = { ...structuredClone(a), discount: 10 };
    expect(diffAvtal(a, b).some((x) => x.includes("rabatt på arbete") && x.includes("10 %"))).toBe(true);
  });
  test("ändrad planeringsvecka loggas", () => {
    expect(diffPlanering({ besok: [{ vecka: 10 }] }, { besok: [{ vecka: 12 }] })[0]).toBe("ändrade besök 1 från v 10 till v 12");
  });
  test("oförändrat avtal ger inga rader", () => {
    const a = emptyAvtal();
    expect(diffAvtal(a, structuredClone(a)).length).toBe(0);
  });

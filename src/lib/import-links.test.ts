import { expect, test } from "bun:test";
import { attachImportSources, automaticPost, customerDirectory, linkageIssues, sourceDocument } from "./import-links";
import { emptyAvtal } from "./kalkyl";
import type { CustomerFolder } from "./avtal-store";
import type { ImportHit } from "./pdf-import";

const hit = (changes: Partial<ImportHit> = {}): ImportHit => ({ file: "avtal.pdf", path: "Kunder/Test/AV/avtal.pdf", kind: "ok", reason: "", kund: "Test", avtalNr: "A123", datum: "2020-01-01", adress: "Gatan 1", perYear: 3730, objekt: [], besokPerAr: 2, kalkyler: [], info: {}, ...changes });
const post = (id: string, address: string): CustomerFolder => {
  const data = emptyAvtal(); data.customer.avtalNr = "A123"; data.customer.anlAdress = address;
  return { id, name: "Test", versions: [{ version: 1, savedAt: "", data }] };
};
test("same agreement number never selects a conflicting address", () => {
  expect(automaticPost({ a: post("a", "Gatan 2") }, hit(), [{ id: "a", score: 100 }])).toBe("");
});
test("multiple posts with same number require explicit selection", () => {
  expect(automaticPost({ a: post("a", "Gatan 1"), b: post("b", "Gatan 1") }, hit(), [{ id: "a", score: 100 }, { id: "b", score: 100 }])).toBe("");
});
test("unique matching agreement and address may be suggested", () => {
  expect(automaticPost({ a: post("a", "Gatan 1") }, hit(), [{ id: "a", score: 100 }])).toBe("a");
});
test("different agreement numbers are not linked through customer alone", () => {
  expect(automaticPost({ a: post("a", "Gatan 1") }, hit({ avtalNr: "B456" }), [{ id: "a", score: 90 }])).toBe("");
});
test("separate calculation remains unconfirmed even in same folder", () => {
  const calculation = { namn: "Kalkyl", objekt: [], perYear: 3730, besokPerAr: 2 };
  expect(linkageIssues(hit(), hit({ path: "Kunder/Test/FU/kalkyl.xlsx" }), calculation).length).toBe(1);
  expect(linkageIssues(hit(), hit({ avtalNr: "B456", adress: "Gatan 2" }), calculation).length).toBe(2);
});
test("modification date never replaces agreement date", () => {
  expect(sourceDocument(hit(), Date.UTC(2026, 10, 14), "huvudavtal").datum).toBe("2020-01-01");
});
test("historical sources append without replacing originals or prices", () => {
  const agreement = emptyAvtal(); const original = structuredClone(agreement);
  const older = sourceDocument(hit(), 0, "kalkyl", "default");
  const newer = sourceDocument(hit({ path: "new.xlsx", file: "new.xlsx" }), 0, "kalkyl", "default");
  agreement.documents = [older];
  expect(attachImportSources(agreement, "default", "Gatan 1", [older, newer])).toBe(true);
  expect(agreement.documents).toEqual([older, newer]);
  expect(agreement.rows).toEqual(original.rows); expect(agreement.adjust).toBe(original.adjust);
});
test("new service addresses get unique identities without merging existing rows", () => {
  const agreement = emptyAvtal(); const rows = structuredClone(agreement.rows);
  expect(attachImportSources(agreement, "new", "Gatan 2", [])).toBe(true);
  expect(attachImportSources(agreement, "new", "Gatan 3", [])).toBe(true);
  expect(new Set(agreement.facilities?.map((facility) => facility.id)).size).toBe(3);
  expect(agreement.rows).toEqual(rows);
  expect(attachImportSources(agreement, "unknown", "Gatan 4", [])).toBe(false);
});
test("only named customer directories supply related document candidates", () => {
  expect(customerDirectory("loose.pdf")).toBe("");
  expect(customerDirectory("Kunder/Test/AV/avtal.pdf")).toBe(customerDirectory("Kunder/Test/FU/kalkyl.xlsx"));
});
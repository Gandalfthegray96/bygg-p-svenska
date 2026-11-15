import { expect, mock, test } from "bun:test";
import { calculate, emptyAvtal } from "./kalkyl";
import type { CustomerFolder } from "./avtal-store";

// No network and no shared-register writes in these regression tests.
mock.module("./cloud-sync", () => ({ pushShared: async () => {}, pushKey: () => {} }));
mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { fyllImport, loadStore } = await import("./avtal-store");
const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
} });

function seed(count = 798) {
  const store: Record<string, CustomerFolder> = {};
  for (let i = 0; i < count; i++) {
    const data = emptyAvtal(); data.customer.bestallare = `Kund ${i}`; data.customer.anlAdress = `Gatan ${i}`;
    store[String(i)] = { id: String(i), name: `Kund ${i}`, versions: [{ version: 1, savedAt: "2020-01-01", data, status: "signerat" }], planering: { besok: [{ vecka: 4 }, { vecka: 30 }] } };
  }
  memory.set("uc-avtal-store", JSON.stringify(store));
  return store;
}
const input = () => ({ postId: "0", facilityId: "default", avtalNr: "DANE_C0033", datum: "2022-10-12", adress: "Gatan 0", perYear: 8062, path: "Herbert/AV_Förslag_DANE_C0033.pdf", objekt: [{ name: "Takskjutport", qty: 2 }, { name: "Snabbrullport", qty: 2 }, { name: "Lastbrygga/lyftbord", qty: 2 }], besokPerAr: 2 });

test("import requires a price decision even outside the review UI", () => {
  const original = seed();
  expect(fyllImport([input()])).toBe(0);
  expect(JSON.stringify(loadStore())).toBe(JSON.stringify(original));
});
test("explicit Herbert price appends one version and preserves all 798 posts and planning", () => {
  const original = seed();
  expect(fyllImport([{ ...input(), priceChoice: "avtal" }])).toBe(1);
  const stored = loadStore(); const folder = stored["0"];
  expect(Object.keys(stored).length).toBe(798);
  expect(folder?.versions.length).toBe(2);
  expect(JSON.stringify(folder?.versions[0])).toBe(JSON.stringify(original["0"]?.versions[0]));
  expect(JSON.stringify(folder?.planering)).toBe(JSON.stringify(original["0"]?.planering));
  const latest = folder?.versions.at(-1)?.data;
  if (!latest) throw new Error("Imported version missing");
  expect(calculate(latest).perYear).toBe(8062);
  expect(calculate(latest).totalQty).toBe(6);
  expect(folder?.log?.some((entry) => entry.text.includes("Prisgranskning") && entry.text.includes("avtalspris"))).toBe(true);
  for (let i = 1; i < 798; i++) expect(JSON.stringify(stored[String(i)])).toBe(JSON.stringify(original[String(i)]));
});
test("two selected sources for one target do not merge or write versions", () => {
  const original = seed();
  expect(fyllImport([{ ...input(), priceChoice: "avtal" }, { ...input(), path: "new.xlsx", priceChoice: "avtal" }])).toBe(0);
  expect(JSON.stringify(loadStore())).toBe(JSON.stringify(original));
});
test("missing document price preserves existing objects and adjustment", () => {
  const original = seed(1); const folder = original["0"];
  if (!folder?.versions[0]) throw new Error("Missing fixture");
  folder.versions[0].data.adjust = "150";
  memory.set("uc-avtal-store", JSON.stringify(original));
  expect(fyllImport([{ ...input(), perYear: null }])).toBe(1);
  const latest = loadStore()["0"]?.versions.at(-1)?.data;
  expect(latest?.adjust).toBe("150");
  expect(JSON.stringify(latest?.rows)).toBe(JSON.stringify(folder.versions[0].data.rows));
});
test("new service address preserves the existing agreement price and objects", () => {
  const original = seed(1); const before = original["0"]?.versions[0]?.data;
  expect(fyllImport([{ ...input(), facilityId: "new", adress: "Gatan 2", priceChoice: "avtal" }])).toBe(1);
  const after = loadStore()["0"]?.versions.at(-1)?.data;
  if (!before || !after) throw new Error("Missing agreement");
  expect(after.facilities?.length).toBe(2);
  expect(JSON.stringify(after.rows)).toBe(JSON.stringify(before.rows));
  expect(calculate(after).perYear).toBe(calculate(before).perYear);
});
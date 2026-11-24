import { expect, test } from "bun:test";
import type { CustomerFolder } from "./avtal-store";
import { emptyAvtal } from "./kalkyl";
import { visibleInPipeline } from "./pipeline-visibility";

const now = Date.parse("2026-11-24T20:00:00Z");
const day = 86_400_000;
const at = (days: number) => new Date(now - days * day).toISOString();
const folder = (days: number): CustomerFolder => ({
  id: "test", name: "Testkund",
  versions: [{ version: 1, savedAt: at(days), status: "signerat", data: emptyAvtal() }],
  log: [{ id: "sign", at: at(days), by: "Alexsander Östrand", kind: "signerat", text: "Signerade avtalet" }],
});

test("signerat visas före 30 dagar och döljs exakt efter 30 dagar utan att ändra avtalet", () => {
  const f = folder(30);
  const original = JSON.stringify(f);
  expect(visibleInPipeline(f, now - 1)).toBe(true);
  expect(visibleInPipeline(f, now)).toBe(false);
  expect(visibleInPipeline(folder(29), now)).toBe(true);
  expect(JSON.stringify(f)).toBe(original);
});

test("en ny version eller anteckning återstartar inte de 30 dagarna", () => {
  const f = folder(40);
  f.versions.push({ version: 2, savedAt: at(1), status: "signerat", data: emptyAvtal() });
  f.log?.push({ id: "note", at: at(0), by: "Felix", kind: "notering", text: "Ny anteckning" });
  expect(visibleInPipeline(f, now)).toBe(false);
  delete f.log;
  expect(visibleInPipeline(f, now)).toBe(false);
});

test("en ny övergång till signerat startar en ny 30-dagarsperiod", () => {
  const f = folder(60);
  f.log?.push({ id: "resign", at: at(1), by: "Felix", kind: "signerat", text: "Flyttade till Signerat" });
  expect(visibleInPipeline(f, now)).toBe(true);
});

test("andra statusar döljs inte efter 30 dagar", () => {
  for (const status of ["offert", "utkast", "skickat", "forhandling", "forlorat"] as const) {
    const f = folder(60);
    const v = f.versions[0];
    if (!v) throw new Error("Testversion saknas");
    v.status = status;
    expect(visibleInPipeline(f, now)).toBe(true);
  }
});
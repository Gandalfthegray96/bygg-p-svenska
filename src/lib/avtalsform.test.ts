import { expect, test } from "bun:test";
import { garantiStatus } from "./avtalsform";
const Y = 365 * 86_400_000, t0 = Date.parse("2020-01-01");
test("löpande FU-avtal flaggas aldrig efter 5 år", () => { expect(garantiStatus({}, "2020-01-01", t0 + 6 * Y)).toBe(null); expect(garantiStatus({ avtalsform: "lopande" }, "2020-01-01", t0 + 6 * Y)).toBe(null); });
test("garantiservice flaggas inte före 4 år", () => { const s = garantiStatus({ avtalsform: "garanti" }, "2020-01-01", t0 + 3.9 * Y)!; expect(s.flagga).toBe(false); expect(s.ar).toBe(4); });
test("garantiservice flaggas efter 4 år, år 5 av 5", () => { const s = garantiStatus({ avtalsform: "garanti" }, "2020-01-01", t0 + 4.1 * Y)!; expect(s.flagga).toBe(true); expect(s.ar).toBe(5); expect(s.utgatt).toBe(false); });

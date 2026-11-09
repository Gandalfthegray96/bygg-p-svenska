import { test, expect } from "vitest";
import { KLAUSULER, sidaAndrad, klausulText } from "./klausuler";
test("ändring", () => {
  expect(sidaAndrad({}, 2)).toBe(false);
  expect(sidaAndrad({ ekonomi: "x" }, 2)).toBe(true);
  expect(sidaAndrad({ ekonomi: "x" }, 3)).toBe(false);
  expect(klausulText({ bilagor: "x" }, KLAUSULER.find(k=>k.id==="bilagor")!)).toContain("Bilaga 1");
});

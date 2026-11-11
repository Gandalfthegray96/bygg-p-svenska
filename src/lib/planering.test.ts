import { describe, expect, test } from "bun:test";
import { foreslaVeckor, kvartal } from "./planering";

describe("planering", () => {
  test("veckor mappas till kvartal som i Excel", () => {
    expect([kvartal(1), kvartal(13), kvartal(14), kvartal(26), kvartal(27), kvartal(39), kvartal(40), kvartal(52)]).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
  test("två besök från v4 hamnar v4 och v30", () => {
    expect(foreslaVeckor(2, 4)).toEqual([4, 30]);
  });
});

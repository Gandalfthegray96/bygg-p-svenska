import { expect, test } from "bun:test";
import { bundleFolders } from "./import-links";

const base = { kund: "Cernera", avtalNr: "ALI_A1755", adress: "", datum: "", objekt: [], besokPerAr: 2, perYear: null, info: {}, kalkyler: [], on: false, kalk: "", post: "", facility: "", related: [], cands: [{ score: 90 }], mod: 0 } as any;
const kalkyl = { namn: "FU", objekt: [], besokPerAr: 2, perYear: 22730 } as any;

  test("en mapp med ett avtal blir ett kort med kalkyl och bilagor", () => {
    const out = bundleFolders([
      { ...base, file: "Sign.avt.pdf", path: "Cernera/Sign.avt.pdf", kind: "granska", reason: "", post: "p1", facility: "f1" },
      { ...base, file: "FU.xlsx", path: "Cernera/FU.xlsx", kind: "ok", reason: "", kalkyler: [kalkyl], mod: 2 },
      { ...base, file: "Spec.Forsen.pdf", path: "Cernera/Spec.Forsen.pdf", kind: "ej", reason: "" },
    ]);
    expect(out[0]!.kind).toBe("ok");
    expect(out[0]!.kalk).toBe("Cernera/FU.xlsx|0");
    expect(out[0]!.related.join()).toBe(["Cernera/Spec.Forsen.pdf"].join());
    expect(out[1]!.kind).toBe("ej");
  });
  test("två avtal till olika poster i samma mapp slås aldrig ihop", () => {
    const out = bundleFolders([
      { ...base, file: "A.pdf", path: "K/A.pdf", kind: "granska", reason: "x", post: "p1", facility: "f1" },
      { ...base, file: "B.pdf", path: "K/B.pdf", kind: "granska", reason: "y", post: "p2", facility: "f2" },
    ]);
    expect(out.map((x) => x.reason).join()).toBe("x,y");
  });

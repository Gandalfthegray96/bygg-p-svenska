export const FILIALER = [{ id: "GBG", label: "Göteborg" }, { id: "BORAS", label: "Borås" }] as const;

/** Kvartal enligt planeringsfilerna: v1–13 Q1, v14–26 Q2, v27–39 Q3, v40–52 Q4. */
export function kvartal(vecka: number): 1 | 2 | 3 | 4 {
  if (vecka <= 13) return 1;
  if (vecka <= 26) return 2;
  if (vecka <= 39) return 3;
  return 4;
}

export const KVARTAL_VECKOR: Record<1 | 2 | 3 | 4, number[]> = {
  1: Array.from({ length: 13 }, (_, i) => i + 1),
  2: Array.from({ length: 13 }, (_, i) => i + 14),
  3: Array.from({ length: 13 }, (_, i) => i + 27),
  4: Array.from({ length: 13 }, (_, i) => i + 40),
};

/** Föreslår veckor jämnt fördelade över året från en startvecka, t.ex. 2 besök från v4 → v4, v30. */
export function foreslaVeckor(antal: number, start = 4): number[] {
  if (antal <= 0) return [];
  const steg = 52 / antal;
  return Array.from({ length: antal }, (_, i) => ((Math.round(start - 1 + i * steg) % 52) + 1));
}

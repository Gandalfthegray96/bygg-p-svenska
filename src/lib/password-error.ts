// Översätter inloggningssystemets lösenordsfel till exakt svensk förklaring.
export function passwordErrorMessage(err: unknown): string | null {
  const e = err as { message?: string; code?: string; reasons?: string[] } | null;
  const msg = e?.message ?? "";
  const reasons = e?.reasons ?? [];
  const isWeak = e?.code === "weak_password" || reasons.length > 0 || /password/i.test(msg);
  if (!isWeak) return null;
  const parts: string[] = [];
  if (reasons.includes("pwned") || /pwned|leak|known|guess|compromised/i.test(msg))
    parts.push("lösenordet är för vanligt eller har förekommit i kända dataläckor och är lätt att gissa – välj något mer unikt (undvik t.ex. ord + 123!)");
  if (reasons.includes("length") || /at least \d+|short|length/i.test(msg)) {
    const n = msg.match(/at least (\d+)/i)?.[1] ?? "6";
    parts.push(`lösenordet är för kort – minst ${n} tecken krävs`);
  }
  if (reasons.includes("characters") || /character/i.test(msg))
    parts.push("lösenordet saknar nödvändiga teckentyper (t.ex. stor/liten bokstav, siffra eller specialtecken)");
  if (/same|different from the old/i.test(msg)) parts.push("det nya lösenordet måste skilja sig från det gamla");
  if (!parts.length) return `Lösenordet godkändes inte: ${msg}`;
  const text = parts.join("; ");
  return "Lösenordet godkändes inte: " + text + ".";
}

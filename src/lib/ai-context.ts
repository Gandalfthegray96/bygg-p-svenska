import { calculate, lonsamhet, type Avtal } from "@/lib/kalkyl";
import type { CustomerFolder } from "@/lib/avtal-store";

const kr = (n: number) => `${Math.round(n).toLocaleString("sv-SE")} kr`;

/** Ett avtal som text för AI:n. includeNotes=false när texten ska till kund. */
export function avtalContext(a: Avtal, includeNotes = true): string {
  const k = calculate(a); const l = lonsamhet(a); const c = a.customer;
  const rows = a.rows.filter((r) => r.name || r.qty).map((r) =>
    `- ${r.qty} st ${r.name || "objekt"}, ${r.minutes} min/st, ${r.visits} besök/år${includeNotes && r.note ? ` (intern notering: ${r.note})` : ""}`).join("\n");
  return [
    `Kund: ${c.bestallare || "-"}, anläggning: ${c.anlAdress || "-"}, avtalsnr: ${c.avtalNr || "-"}`,
    `Timpris ${a.hourRate} kr/h, framkörning ${a.tripFee} kr, rabatt arbete ${a.discount} %, utjämning ${a.adjust || 0} kr/besök`,
    `Objekt:\n${rows || "(inga)"}`,
    `Besök/år: ${k.visits.length}. ${k.visits.map((v) => `Besök ${v.k}: ${v.hours.toFixed(2)} h, ${v.trips} framkörning, ${kr(v.perVisit)}`).join("; ")}`,
    `Pris per år ${kr(k.perYear)}, 5 år ${kr(k.total5)}`,
    `Lönsamhet/år: självkostnad ${kr(l.kostnad)}, TB ${kr(l.tb)}, TG ${l.tg.toFixed(1)} %, ${l.hours.toFixed(1)} h, ${l.trips} framkörningar`,
  ].join("\n");
}

/** Hela registret i kort form för AI-kollegan. */
export function registerContext(store: Record<string, CustomerFolder>): string {
  const lines = Object.values(store).map((f) => {
    const v = f.versions[f.versions.length - 1]; if (!v) return null;
    const d = v.data; const k = calculate(d); const l = lonsamhet(d);
    const typer = d.rows.filter((r) => r.name).map((r) => `${r.qty}×${r.name}`).join(", ");
    return `- ${f.name} | nr ${d.customer.avtalNr || "-"} | status ${f.uppsagd ? "uppsagt" : v.status ?? "utkast"} | v${v.version} sparad ${v.savedAt.slice(0, 10)} | ${kr(k.perYear)}/år | TB ${kr(l.tb)} | ${l.objekt} objekt | ${typer}${f.forfragan ? ` | förfrågan: ${f.forfragan.beskrivning.slice(0, 120)}` : ""}`;
  }).filter(Boolean);
  return `Idag: ${new Date().toISOString().slice(0, 10)}. Avtalsregister (${lines.length} poster):\n${lines.join("\n")}`;
}

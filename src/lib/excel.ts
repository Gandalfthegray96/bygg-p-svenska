import { type Avtal, calculate, TOTAL_VISITS, VISITS_PER_YEAR } from "./kalkyl";

export function fileBase(a: Avtal, rev?: number) {
  const c = a.customer;
  const parts = [c.avtalNr || "Avtal", c.bestallare || "kund", rev ? `v${rev}` : c.rev ? `rev${c.rev}` : ""];
  return parts.filter(Boolean).join("_").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_");
}

export async function downloadExcel(a: Avtal, rev?: number) {
  const XLSX = await import("xlsx");
  const c = a.customer;
  const k = calculate(a);
  const n = a.rows.length;
  const first = 8;
  const last = first + n - 1;

  const kalkyl: (string | number | { f: string } | null)[][] = [
    ["Kalkyl förebyggande underhåll – 5 år"],
    ["Offertnummer", c.avtalNr],
    ["Kund", c.bestallare],
    ["Projekt / övrig info", c.coverTitle],
    [],
    ["Timpris (kr/h)", a.hourRate, "Framkörning (kr/st)", a.tripFee, "Rabatt timpris (%)", a.discount / 100, "Utjämning/tillfälle (kr)", k.adjust],
    ["Produkt", "Antal", "Tid (min)", "Total min", "Styckespris (kr)", "Fabrikat", "Tillverkningsnr", "Besiktningsnr"],
  ];
  a.rows.forEach((r, i) => {
    const row = first + i;
    kalkyl.push([
      r.name, r.qty, r.minutes, { f: `B${row}*C${row}` },
      { f: `IF(AND($D$${last + 2}>0,B${row}>0),D${row}/$D$${last + 2}*$D$${last + 7}/B${row},0)` },
      r.make, r.mfgNo, r.inspNo,
    ]);
  });
  const t = last + 2;
  kalkyl.push(
    [],
    ["Totalt", { f: `SUM(B${first}:B${last})` }, "", { f: `SUM(D${first}:D${last})` }],
    ["Framkörningar (st)", "", "", { f: `IF(D${t}>0,ROUNDUP(D${t}/480,0),0)` }],
    ["Framkörning (kr)", "", "", { f: `D${t + 1}*D6` }],
    ["Arbete brutto (kr)", "", "", { f: `D${t}/60*B6` }],
    ["Arbete netto (kr)", "", "", { f: `D${t + 3}*(1-F6)` }],
    ["Kostnad per tillfälle exkl. moms", "", "", { f: `D${t + 2}+D${t + 4}+H6` }],
    ["Kostnad per år exkl. moms", "", "", { f: `D${t + 5}*${VISITS_PER_YEAR}` }],
    ["Kostnad 5 år exkl. moms", "", "", { f: `D${t + 5}*${TOTAL_VISITS}` }],
  );

  const ws1 = XLSX.utils.aoa_to_sheet(kalkyl as never);
  ws1["!cols"] = [{ wch: 32 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];

  const utskrift: (string | number)[][] = [
    ["Bilaga 1. Kostnad"],
    [],
    ["Kund", c.bestallare],
    ["Offertnummer", c.avtalNr],
    ["Projekt", c.coverTitle],
    [],
    ["Objekt", "Antal"],
    ...a.rows.map((r) => [r.name || "Objekt", r.qty]),
    [],
    ["Totalt antal objekt", k.totalQty],
    ["Servicetillfällen per år", VISITS_PER_YEAR],
    ["Kostnad per tillfälle exkl. moms", Math.round(k.perVisit * 100) / 100],
    ["Kostnad per år exkl. moms", Math.round(k.perYear * 100) / 100],
    ["Kostnad 5 år garantiservice exkl. moms", Math.round(k.total5 * 100) / 100],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(utskrift);
  ws2["!cols"] = [{ wch: 40 }, { wch: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Kalkyl");
  XLSX.utils.book_append_sheet(wb, ws2, "Utskrift");
  XLSX.writeFile(wb, `Kalkyl_${fileBase(a, rev)}.xlsx`);
}

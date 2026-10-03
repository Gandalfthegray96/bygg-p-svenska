import { type Avtal, calculate, YEARS } from "./kalkyl";

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
    ["Timpris (kr/h)", a.hourRate, "Framkörning (kr/st)", a.tripFee, "Rabatt timpris (%)", a.discount / 100, "Utjämning/besök (kr)", k.adjust],
    ["Produkt", "Antal", "Tid (min)", "Total min", "Besök/år", "Styckespris/år (kr)", "Fabrikat", "Tillverkningsnr", "Besiktningsnr"],
  ];
  a.rows.forEach((r, i) => {
    const row = first + i;
    kalkyl.push([
      r.name, r.qty, r.minutes, { f: `B${row}*C${row}` }, r.visitsPerYear,
      Math.round((k.unitPrices[i] ?? 0) * 100) / 100,
      r.make, r.mfgNo, r.inspNo,
    ]);
  });
  const t = last + 2;
  kalkyl.push(
    [],
    ["Totalt", { f: `SUM(B${first}:B${last})` }, "", { f: `SUM(D${first}:D${last})` }],
  );
  // Ett block per besök: besök v innehåller objekt med besök/år >= v
  const visitPriceRows: number[] = [];
  k.visits.forEach((v, i) => {
    const base = t + 1 + i * 5;
    const minF = `SUMPRODUCT(($E$${first}:$E$${last}>=${v.index})*D${first}:D${last})`;
    kalkyl.push(
      [`Besök ${v.index} – servicetid (min)`, "", "", { f: minF }],
      [`Besök ${v.index} – framkörningar (st)`, "", "", { f: `IF(D${base}>0,ROUNDUP(D${base}/480,0),0)` }],
      [`Besök ${v.index} – framkörning (kr)`, "", "", { f: `D${base + 1}*D6` }],
      [`Besök ${v.index} – arbete netto (kr)`, "", "", { f: `D${base}/60*B6*(1-F6)` }],
      [`Besök ${v.index} – pris exkl. moms`, "", "", { f: `D${base + 2}+D${base + 3}+H6` }],
    );
    visitPriceRows.push(base + 4);
  });
  const yearRow = t + 1 + k.visits.length * 5;
  kalkyl.push(
    ["Kostnad per år exkl. moms", "", "", visitPriceRows.length ? { f: visitPriceRows.map((r) => `D${r}`).join("+") } : 0],
    ["Kostnad 5 år exkl. moms", "", "", { f: `D${yearRow}*${YEARS}` }],
  );

  const ws1 = XLSX.utils.aoa_to_sheet(kalkyl as never);
  ws1["!cols"] = [{ wch: 32 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];

  const utskrift: (string | number)[][] = [
    ["Bilaga 1. Kostnad"],
    [],
    ["Kund", c.bestallare],
    ["Offertnummer", c.avtalNr],
    ["Projekt", c.coverTitle],
    [],
    ["Objekt", "Antal", "Besök/år"],
    ...a.rows.map((r) => [r.name || "Objekt", r.qty, r.visitsPerYear]),
    [],
    ["Totalt antal objekt", k.totalQty],
    ["Servicetillfällen per år", k.maxVisits],
    ...k.visits.map((v) => [`Kostnad servicebesök ${v.index} exkl. moms`, Math.round(v.price * 100) / 100]),
    ["Kostnad per år exkl. moms", Math.round(k.perYear * 100) / 100],
    ["Kostnad 5 år garantiservice exkl. moms", Math.round(k.total5 * 100) / 100],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(utskrift);
  ws2["!cols"] = [{ wch: 40 }, { wch: 18 }, { wch: 10 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Kalkyl");
  XLSX.utils.book_append_sheet(wb, ws2, "Utskrift");
  XLSX.writeFile(wb, `Kalkyl_${fileBase(a, rev)}.xlsx`);
}

import { type Avtal, calculate, YEARS } from "./kalkyl";

type Cell = string | number | { f: string } | null;

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
  const g0 = last + 3; // första summeringsraden per besök (efter blankrad + Totalt-rad)
  const minCell = (g: number) => `E${g0 + 2 * g}`;
  const priceCell = (g: number) => `E${g0 + 2 * g + 1}`;

  const kalkyl: Cell[][] = [
    ["Kalkyl förebyggande underhåll – pris per servicebesök"],
    ["Offertnummer", c.avtalNr],
    ["Kund", c.bestallare],
    ["Projekt / övrig info", c.coverTitle],
    [],
    ["Timpris (kr/h)", a.hourRate, "Framkörning (kr/st)", a.tripFee, "Rabatt timpris (%)", a.discount / 100, "Utjämning per besök (kr)", k.adjust],
    ["Produkt", "Antal", "Besök/år", "Tid (min)", "Total min", "Styckpris besök 1 (kr)", "Fabrikat", "Tillverkningsnr", "Besiktningsnr"],
  ];
  a.rows.forEach((r, i) => {
    const row = first + i;
    const unit = k.visits.length > 0 ? { f: `IF($E$${g0}>0,E${row}/$E$${g0}*$E$${g0 + 1}/B${row},0)` } : 0;
    kalkyl.push([r.name, r.qty, r.visits, r.minutes, { f: `B${row}*D${row}` }, unit, r.make, r.mfgNo, r.inspNo]);
  });
  kalkyl.push(
    [],
    ["Totalt", { f: `SUM(B${first}:B${last})` }, "", "", { f: `SUM(E${first}:E${last})` }],
  );

  k.visits.forEach((v, g) => {
    kalkyl.push(
      [`Besök ${v.k}: total min (objekt med ≥${v.k} besök/år)`, "", "", "", { f: `SUMPRODUCT(($C$${first}:$C$${last}>=${v.k})*$E$${first}:$E$${last})` }],
      [`Besök ${v.k}: pris per besök exkl. moms`, "", "", "", { f: `IF(${minCell(g)}>0,${minCell(g)}/60*$B$6*(1-$F$6)+ROUNDUP(${minCell(g)}/480,0)*$D$6+$H$6,0)` }],
    );
  });

  if (k.visits.length > 0) {
    const yearRow = g0 + 2 * k.visits.length;
    kalkyl.push(
      ["Kostnad per år exkl. moms", "", "", "", { f: k.visits.map((_, g) => priceCell(g)).join("+") }],
      [`Kostnad ${YEARS} år exkl. moms`, "", "", "", { f: `E${yearRow}*${YEARS}` }],
    );
  }

  const ws1 = XLSX.utils.aoa_to_sheet(kalkyl as never);
  ws1["!cols"] = [{ wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];

  const visitLabel = (vk: number) => (k.visits.length > 1 ? `Kostnad servicebesök ${vk} exkl. moms` : "Kostnad per servicebesök exkl. moms");
  const utskrift: Cell[][] = [
    ["Bilaga 1. Kostnad"],
    [],
    ["Kund", c.bestallare],
    ["Offertnummer", c.avtalNr],
    ["Projekt", c.coverTitle],
    [],
    ["Objekt", "Antal", "Besök/år"],
    ...a.rows.map((r) => [r.name || "Objekt", r.qty, r.visits]),
    [],
    ["Totalt antal objekt", k.totalQty],
    ...(a.show.visit ? k.visits.map((v) => [visitLabel(v.k), Math.round(v.perVisit * 100) / 100]) : []),
    ...(a.show.year ? [["Kostnad per år exkl. moms", Math.round(k.perYear * 100) / 100]] : []),
    ...(a.show.total5 ? [["Kostnad 5 år garantiservice exkl. moms", Math.round(k.total5 * 100) / 100]] : []),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(utskrift as never);
  ws2["!cols"] = [{ wch: 40 }, { wch: 14 }, { wch: 10 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Kalkyl");
  XLSX.utils.book_append_sheet(wb, ws2, "Utskrift");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const { saveFile } = await import("./save-file");
  await saveFile(new Blob([buf], { type: mime }), `Kalkyl_${fileBase(a, rev)}.xlsx`, mime, ".xlsx");
}

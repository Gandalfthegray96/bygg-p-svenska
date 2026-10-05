import { type Avtal } from "./kalkyl";

export function fileBase(a: Avtal, rev?: number) {
  const c = a.customer;
  const parts = [c.avtalNr || "Avtal", c.bestallare || "kund", rev ? `v${rev}` : c.rev ? `rev${c.rev}` : ""];
  return parts.filter(Boolean).join("_").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_");
}

/** Max antal objektrader i originalmallen (Kalkyl!A5:A14). */
export const MALL_ROWS = 10;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Sätter värdet i en befintlig cell i mallen och behåller cellens formatering (s-attributet). */
function setCell(xml: string, ref: string, value: string | number | null | undefined): string {
  const re = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
  const m = xml.match(re);
  if (!m) return xml;
  const attrs = m[1]!.replace(/\s*t="[^"]*"/, "");
  let cell: string;
  if (value === null || value === undefined || value === "") cell = `<c r="${ref}"${attrs}/>`;
  else if (typeof value === "number") cell = `<c r="${ref}"${attrs}><v>${value}</v></c>`;
  else cell = `<c r="${ref}"${attrs} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
  return xml.replace(re, cell);
}

/** Fyller i er originalmall (FU_GS_5år) — endast inmatningscellerna, allt annat lämnas orört. */
export async function downloadExcel(a: Avtal, rev?: number) {
  const { default: JSZip } = await import("jszip");
  const c = a.customer;
  if (a.rows.length > MALL_ROWS) {
    alert(`Kalkylmallen har plats för ${MALL_ROWS} objekt. Endast de ${MALL_ROWS} första kommer med i Excel-filen.`);
  }
  const res = await fetch("/excel/kalkyl-mall.xlsx");
  const zip = await JSZip.loadAsync(await res.arrayBuffer());

  const sheetPath = "xl/worksheets/sheet1.xml";
  let s = await zip.file(sheetPath)!.async("string");
  s = setCell(s, "B1", c.avtalNr);
  s = setCell(s, "B2", c.bestallare);
  s = setCell(s, "B3", c.coverTitle);
  for (let i = 0; i < MALL_ROWS; i++) {
    const r = a.rows[i];
    const row = 5 + i;
    s = setCell(s, `A${row}`, r ? r.name : null);
    s = setCell(s, `B${row}`, r ? r.qty : null);
    s = setCell(s, `C${row}`, r ? r.minutes : null);
  }
  s = setCell(s, "B21", (a.discount || 0) / 100);
  s = setCell(s, "D23", a.adjust || 0);
  zip.file(sheetPath, s);

  // Excel räknar om alla formler när filen öppnas
  let wb = await zip.file("xl/workbook.xml")!.async("string");
  wb = wb.replace(/<calcPr([^>]*?)\/>/, (_m, at: string) => `<calcPr${at.replace(/\s*fullCalcOnLoad="[^"]*"/, "")} fullCalcOnLoad="1"/>`);
  zip.file("xl/workbook.xml", wb);
  zip.remove("xl/calcChain.xml");
  let ct = await zip.file("[Content_Types].xml")!.async("string");
  ct = ct.replace("spreadsheetml.template.main+xml", "spreadsheetml.sheet.main+xml").replace(/<Override PartName="\/xl\/calcChain.xml"[^>]*\/>/, "");
  zip.file("[Content_Types].xml", ct);
  let rels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  rels = rels.replace(/<Relationship [^>]*calcChain[^>]*\/>/, "");
  zip.file("xl/_rels/workbook.xml.rels", rels);

  const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const blob = await zip.generateAsync({ type: "blob", mimeType: mime, compression: "DEFLATE" });
  const { saveFile } = await import("./save-file");
  await saveFile(blob, `Kalkyl_${fileBase(a, rev)}.xlsx`, mime, ".xlsx");
}

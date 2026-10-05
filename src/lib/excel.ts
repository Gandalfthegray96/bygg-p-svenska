import { type Avtal, calculate } from "./kalkyl";

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

const shiftRef = (ref: string, from: number, n: number) =>
  ref.replace(/(\$?[A-Z]{1,3}\$?)(\d+)/g, (_m, col: string, row: string) => {
    const r = Number(row);
    return `${col}${r >= from ? r + n : r}`;
  });

/** Flyttar ner alla rader ≥ from med n steg (cellreferenser, matrisformler, formler på samma blad). */
function shiftRows(xml: string, from: number, n: number): string {
  return xml.replace(/<row r="(\d+)"([\s\S]*?)(?:<\/row>|(?<=\/)>)/g, (whole, rs: string) => {
    if (Number(rs) < from) return whole;
    return whole
      .replace(/<row r="\d+"/, `<row r="${Number(rs) + n}"`)
      .replace(/ (r|ref)="([^"]+)"/g, (_m, a: string, v: string) => ` ${a}="${shiftRef(v, from, n)}"`)
      .replace(/<f([^>]*)>([^<]*)<\/f>/g, (_m, at: string, f: string) =>
        /[[!]/.test(f) ? `<f${at}>${f}</f>` : `<f${at}>${shiftRef(f, from, n)}</f>`);
  });
}

/** Infogar nya rader direkt före raden `before` (som redan flyttats). */
function insertRows(xml: string, before: number, rows: string[]): string {
  return xml.replace(new RegExp(`<row r="${before}"`), `${rows.join("")}<row r="${before}"`);
}

function getRow(xml: string, r: number): string {
  const m = xml.match(new RegExp(`<row r="${r}"[\\s\\S]*?</row>`));
  return m ? m[0] : "";
}

/** Fyller i er originalmall (FU_GS_5år) — endast inmatningscellerna; vid fler än 10 objekt utökas tabellen med fler rader. */
export async function downloadExcel(a: Avtal, rev?: number) {
  const { default: JSZip } = await import("jszip");
  const c = a.customer;
  const count = Math.max(MALL_ROWS, a.rows.length);
  const extra = count - MALL_ROWS;
  const res = await fetch("/excel/kalkyl-mall.xlsx");
  const zip = await JSZip.loadAsync(await res.arrayBuffer());

  const sheetPath = "xl/worksheets/sheet1.xml";
  let s = await zip.file(sheetPath)!.async("string");

  if (extra > 0) {
    // Kalkyl: tabellrad 14 kopieras, allt från rad 15 flyttas ner
    const tpl = getRow(s, 14);
    s = shiftRows(s, 15, extra);
    const newRows = Array.from({ length: extra }, (_, i) => {
      const r = 15 + i;
      return tpl.replace(/<row r="14"/, `<row r="${r}"`).replace(/([A-Z])14"/g, `$1${r}"`);
    });
    s = insertRows(s, 15 + extra, newRows);
    s = s.replace(/<dimension ref="([^"]+)"/, (_m, v: string) => `<dimension ref="${shiftRef(v, 15, extra)}"`);
    // Tabellernas områden
    for (let t = 1; t <= 6; t++) {
      const p = `xl/tables/table${t}.xml`;
      const f = zip.file(p);
      if (!f) continue;
      let tx = await f.async("string");
      tx = tx.replace(/ ref="([^"]+)"/g, (_m, v: string) => ` ref="${shiftRef(v, 15, extra)}"`);
      if (t === 1) tx = tx.replace(/<autoFilter ref="A4:E\d+"/, `<autoFilter ref="A4:E${14 + extra}"`);
      zip.file(p, tx);
    }

    // Utskrift: objektrad 20 kopieras, allt från rad 21 flyttas ner
    const p2 = "xl/worksheets/sheet2.xml";
    let u = await zip.file(p2)!.async("string");
    const tpl2 = getRow(u, 20);
    u = shiftRows(u, 21, extra);
    const rows2 = Array.from({ length: extra }, (_, i) => {
      const r = 21 + i;
      const k = 15 + i;
      return tpl2
        .replace(/<row r="20"/, `<row r="${r}"`)
        .replace(/([A-Z])20"/g, `$1${r}"`)
        .replace("<f>Kalkyl!A14</f>", `<f>Kalkyl!A${k}</f>`)
        .replace("<f>Kalkyl!B14</f>", `<f>Kalkyl!B${k}</f>`)
        .replace(/<f t="shared" si="1"\/>/, `<f>A${r}</f>`)
        .replace(/<f t="shared" si="2"\/>/, `<f>B${r}</f>`);
    });
    u = insertRows(u, 21 + extra, rows2);
    u = u.replace("SUM(B11:B20)", `SUM(B11:B${20 + extra})`).replace("SUM(F11:F20)", `SUM(F11:F${20 + extra})`);
    u = u.replace(/<dimension ref="([^"]+)"/, (_m, v: string) => `<dimension ref="${shiftRef(v, 21, extra)}"`);
    zip.file(p2, u);
  }

  const R = (row: number) => (row >= 15 ? row + extra : row);
  s = setCell(s, "B1", c.avtalNr);
  s = setCell(s, "B2", c.bestallare);
  s = setCell(s, "B3", c.coverTitle);
  for (let i = 0; i < count; i++) {
    const r = a.rows[i];
    const row = 5 + i;
    s = setCell(s, `A${row}`, r ? r.name : null);
    s = setCell(s, `B${row}`, r ? r.qty : null);
    s = setCell(s, `C${row}`, r ? r.minutes : null);
  }
  s = setCell(s, `B${R(21)}`, (a.discount || 0) / 100);
  s = setCell(s, `D${R(23)}`, calculate(a).adjust);
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

// Bygger avtalet av era ORIGINAL-PDF:er (public/pdf/). Endast befintliga formulärfält fylls i —
// layout och text i originalen ändras aldrig. Bilaga 1 (Kostnad) är det enda bladet som skapas.
import { PDFDocument, StandardFonts, rgb, type PDFForm } from "pdf-lib";
import { type Avtal, calculate } from "@/lib/kalkyl";

const load = async (p: string) => PDFDocument.load(await (await fetch(p)).arrayBuffer());

function fill(form: PDFForm, values: Record<string, string>) {
  for (const [name, v] of Object.entries(values)) {
    try { form.getTextField(name).setText(v ?? ""); } catch { /* fält saknas */ }
  }
}

// Bilaga 1 – ritas som utskriftsfliken ("Utskrift") i er Excel-kalkylmall:
// sidhuvud med logga, kund/offertnr/projekt, tabell Objekt/Antal, totalt antal,
// servicetillfällen per år och kostnader. Tillv.nr/fabrikat visas inte här.
async function bilaga1(a: Avtal): Promise<PDFDocument> {
  const c = a.customer;
  const k = calculate(a);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const boldIt = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
  const logo = await doc.embedJpg(await (await fetch("/pdf/bilaga-header.jpg")).arrayBuffer());
  const W = 595.28, H = 841.89;
  const dark = rgb(0.23, 0.23, 0.23), white = rgb(1, 1, 1), black = rgb(0, 0, 0);
  const wA = 250, wB = 86, x0 = (W - wA - wB) / 2, xB = x0 + wA, xEnd = xB + wB, rh = 19.5, fs = 11;

  let page = doc.addPage([W, H]);
  let y = 0;
  const newPage = () => {
    page = doc.addPage([W, H]);
    const lw = 460.5 * 0.75, lh = 115.5 * 0.75;
    page.drawImage(logo, { x: W - 30 - lw, y: H - 22 - lh, width: lw, height: lh });
    y = H - 2.24 * 72;
  };
  doc.removePage(0); newPage();

  const fit = (s: string, f: typeof font, w: number) => { let x = s; while (x && f.widthOfTextAtSize(x, fs) > w) x = x.slice(0, -1); return x; };
  const txt = (s: string, x: number, w: number, align: "left" | "center" | "right", f = font, color = black) => {
    const v = fit(s, f, w - 6), tw = f.widthOfTextAtSize(v, fs);
    const tx = align === "left" ? x + 3 : align === "right" ? x + w - 3 - tw : x + (w - tw) / 2;
    page.drawText(v, { x: tx, y: y - rh + 6, size: fs, font: f, color });
  };
  const cell = (x: number, w: number, fill?: typeof dark) =>
    page.drawRectangle({ x, y: y - rh, width: w, height: rh, ...(fill ? { color: fill } : {}), borderColor: black, borderWidth: 0.6 });

  for (const l of [c.bestallare, c.avtalNr, c.coverTitle]) { txt(l || "", x0, wA + wB, "left", bold); y -= rh; }
  y -= rh * 2;
  cell(x0, wA, dark); cell(xB, wB, dark); txt("Objekt", x0, wA, "left", bold, white); txt("Antal", xB, wB, "center", bold, white); y -= rh;
  for (const r of a.rows) {
    if (y - rh < 90) { newPage(); }
    cell(x0, wA); cell(xB, wB); txt(r.name || "", x0, wA, "left"); txt(String(r.qty), xB, wB, "center"); y -= rh;
  }
  if (y - rh * 9 < 60) newPage();
  cell(x0, wA, dark); cell(xB, wB); txt("Totalt antal objekt:", x0, wA, "right", bold, white); txt(String(k.totalQty), xB, wB, "center", boldIt); y -= rh * 3;
  cell(x0, wA, dark); cell(xB, wB); txt("Antal servicetillfällen per år:", x0, wA, "right", bold, white); txt(String(k.maxVisits), xB, wB, "center"); y -= rh * 3;

  const kr = (n: number) => new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " kr";
  const lines: [string, number][] = [];
  if (a.show.visit) for (const v of k.visits) lines.push([k.visits.length > 1 ? `Kostnad servicetillfälle ${v.k} (exkl. moms):` : "Kostnad per servicetillfälle (exkl. moms):", v.perVisit]);
  if (a.show.year) lines.push(["Kostnad per år (exkl. moms):", k.perYear]);
  if (a.show.total5) lines.push(["Kostnad 5 år garantiservice (exkl. moms):", k.total5]);
  for (const [l, v] of lines) { cell(x0, wA, dark); cell(xB, wB); txt(l, x0, wA, "right", bold, white); txt(kr(v), xB, wB, "right"); y -= rh; }
  return doc;
}

export async function buildAvtalPdf(a: Avtal): Promise<Uint8Array> {
  const c = a.customer;
  const k = calculate(a);
  const [fsb, fu, pris, b1] = await Promise.all([load("/pdf/forsattsblad.pdf"), load("/pdf/avtal.pdf"), load("/pdf/prislista.pdf"), bilaga1(a)]);

  const ff = fsb.getForm();
  fill(ff, { Kund: c.bestallare, "Kund 2": c.anlAdress, Projekt: c.coverTitle, Objekt: c.anlObjekt, "Dokument beteckning": c.avtalNr });
  try { ff.getDropdown("Typ av dokument").select("Förebyggande Underhållsavtal"); } catch { /* */ }
  ff.flatten();

  const fa = fu.getForm();
  fill(fa, {
    "Avtal nr": c.avtalNr, Datum: c.datum, Rev: c.rev, Rev_2: c.rev, Rev_3: c.rev,
    Entreprenör: "UK Portservice AB", "Orgnr Entr": "55 65 50 - 8339",
    Beställare: c.bestallare, "Orgnr Best": c.orgNr, "Vår Referens": c.varRef,
    "Er Referens": c.erRef, Adress: c.adress, Telefon: c.telefon, PostnummerOrt: c.postort,
    Epost: c.epost, "Märkning Faktura": c.markning, Befattning: c.befattning, "Epost Faktura": c.epostFaktura,
    Objekt: c.anlObjekt, "Adress Obj": c.anlAdress, Kontaktperson: c.kontaktperson,
    "Antal objekt": String(k.totalQty), Servicebesökår: String(k.maxVisits),
    // Signatursidan: vänster = kundens namnförtydligande (Er referens),
    // höger = UK Portservice (Vår referens) med ort och dagens datum
    "Namnförtydligande": c.erRef, "Namnförtydligande UK": c.varRef,
    "Ort & Datum": `Västra Frölunda ${new Date().toISOString().slice(0, 10)}`,
  });
  fa.flatten();

  const out = await PDFDocument.create();
  const add = async (src: PDFDocument, idx: number[]) => (await out.copyPages(src, idx)).forEach((p) => out.addPage(p));
  await add(fsb, fsb.getPageIndices());   // Försättsblad
  await add(fu, [0, 1]);                  // Sida 1–2
  await add(b1, b1.getPageIndices());     // Bilaga 1 – före signering
  await add(fu, [2]);                     // Sida 3 – signatursida
  await add(pris, pris.getPageIndices()); // Bilaga 2 – Prislista, sist
  return out.save();
}

// Bygger avtalet av era ORIGINAL-PDF:er (public/pdf/). Endast befintliga formulärfält fylls i —
// layout och text i originalen ändras aldrig. Bilaga 1 (Kostnad) är det enda bladet som skapas.
import { PDFDocument, StandardFonts, rgb, type PDFForm } from "pdf-lib";
import { type Avtal, calculate, fmtKr } from "@/lib/kalkyl";

const load = async (p: string) => PDFDocument.load(await (await fetch(p)).arrayBuffer());

function fill(form: PDFForm, values: Record<string, string>) {
  for (const [name, v] of Object.entries(values)) {
    try { form.getTextField(name).setText(v ?? ""); } catch { /* fält saknas */ }
  }
}

async function bilaga1(a: Avtal): Promise<PDFDocument> {
  const c = a.customer;
  const k = calculate(a);
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  let y = 780;
  const t = (s: string, x: number, size = 10, f = font) => page.drawText(s, { x, y, size, font: f, color: black });
  const right = (s: string, xr: number, size = 10, f = font) => page.drawText(s, { x: xr - f.widthOfTextAtSize(s, size), y, size, font: f, color: black });
  t("Bilaga 1. Kostnad", 50, 16, bold); y -= 30;
  t("Kund:", 50, 10, bold); t(c.bestallare, 120); t("Offertnummer:", 330, 10, bold); t(c.avtalNr, 420); y -= 28;
  const cols = [50, 200, 300, 390, 480, 545];
  ["Objekt", "Fabrikat", "Tillv.nr", "Besikt.nr"].forEach((h, i) => t(h, cols[i]!, 9, bold));
  right("Antal", 505, 9, bold); right("Besök/år", 545, 9, bold);
  y -= 6; page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5 }); y -= 14;
  for (const r of a.rows) {
    const cut = (s: string, w: number) => { let x = s || ""; while (x && font.widthOfTextAtSize(x, 9) > w) x = x.slice(0, -1); return x; };
    t(cut(r.name || "Objekt", 145), 50, 9); t(cut(r.make, 95), 200, 9); t(cut(r.mfgNo, 85), 300, 9); t(cut(r.inspNo, 85), 390, 9);
    right(String(r.qty), 505, 9); right(String(r.visits), 545, 9); y -= 14;
    if (y < 200) break;
  }
  y -= 10; page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5 }); y -= 18;
  const row = (l: string, v: string, b = false) => { t(l, 50, 10, b ? bold : font); right(v, 545, 10, b ? bold : font); y -= 18; };
  row("Totalt antal objekt", `${k.totalQty} st`);
  if (a.show.visit) for (const v of k.visits) row(k.visits.length > 1 ? `Kostnad servicebesök ${v.k} exkl. moms` : "Kostnad per servicebesök exkl. moms", fmtKr(v.perVisit));
  if (a.show.year) row("Kostnad per år exkl. moms", fmtKr(k.perYear));
  if (a.show.total5) row("Kostnad 5 år garantiservice exkl. moms", fmtKr(k.total5), true);
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
    Beställare: c.bestallare, "Orgnr Best": c.orgNr, "Vår Referens": c.varRef,
    "Er Referens": c.erRef, Adress: c.adress, Telefon: c.telefon, PostnummerOrt: c.postort,
    Epost: c.epost, "Märkning Faktura": c.markning, Befattning: c.befattning, "Epost Faktura": c.epostFaktura,
    Objekt: c.anlObjekt, "Adress Obj": c.anlAdress, Kontaktperson: c.kontaktperson,
    "Antal objekt": String(k.totalQty), Servicebesökår: String(k.maxVisits),
  });
  fa.flatten();

  const out = await PDFDocument.create();
  const add = async (src: PDFDocument, idx: number[]) => (await out.copyPages(src, idx)).forEach((p) => out.addPage(p));
  await add(fsb, fsb.getPageIndices());   // Försättsblad
  await add(fu, [0, 1]);                  // Sida 1–2
  await add(b1, [0]);                     // Bilaga 1 – före signering
  await add(fu, [2]);                     // Sida 3 – signatursida
  await add(pris, pris.getPageIndices()); // Bilaga 2 – Prislista, sist
  return out.save();
}

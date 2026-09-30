# Hela avtalet i appen

## Vad du får
Appen delas upp i fyra steg med flikar längst upp:

1. **Kund** – alla fält från avtalets sida 1: avtalsnummer, datum, revision, beställare, org.nr, vår/er referens, adress, postnummer/ort, telefon, e-post, befattning, fakturamärkning, e-post för faktura, anläggning (objekt, adress, kontaktperson). Antal objekt och servicebesök/år (2) fylls i automatiskt.
2. **Objekt** – som idag: namn, antal, servicetid, tillverkningsnummer, fabrikat, besiktningsnummer.
3. **Pris** – räknas som i er kalkylmall: rabatten gäller bara arbetet, framkörning 745 kr per påbörjade 8 h, ett fält för **utjämning** där `150` läggs till och `-893` dras av, pris per tillfälle och totalt för 5 år (×10). Styckespris per objekt visas.
4. **Förhandsgranska** – hela avtalet som det ser ut i dag:
   - Försättsblad ("OFFERT", kundnamn, rubrik, avtalsnummer, era leverantörsloggor)
   - Avtal sidan 1–3 med er text ordagrant och kunduppgifterna ifyllda
   - Bilaga 1 Kostnad (objektlista och priser enligt kalkylmallens utskriftsflik)
   - Knappar: **Spara avtal som PDF**, **Ladda ner kalkyl som Excel**, **Mejla till kund** (öppnar Outlook med beställarens e-post och den fina texten)

## Spara per kund
Varje avtal sparas under kunden som v1, v2, v3 … med knappen "Spara ny version". Till att börja med sparas de på telefonen. När molnet är aktiverat (nästa steg) syns de på alla telefoner.

## Att känna till
- Bilaga 2 (Prislista) har inte bifogats. Den nämns i avtalet men följer inte med i PDF:en förrän du skickar den.
- Försättsbladets rubrik (t.ex. "Förebyggande underhåll") skriver du själv i ett fält.
- Loggorna och sidhuvudet hämtas från era PDF:er.

## Technical details
- Split src/routes/index.tsx into components under src/components/avtal/ (CustomerStep, ObjectsStep, PriceStep, Preview) + src/lib/kalkyl.ts (pricing per mem kalkyl-mall).
- Preview is print-styled A4 HTML; PDF via window.print with @media print page breaks (works on Android "Spara som PDF").
- Excel via `xlsx` (SheetJS) generated client-side, sheets Kalkyl + Utskrift.
- Logos/header extracted from uploaded PDFs, stored via lovable-assets.
- Versions stored in localStorage keyed by customer; migrate to Lovable Cloud in follow-up.

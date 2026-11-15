# Historisk import – kvalitetssäkring 2026-11-15

## Genomfört
- 81 automatiserade tester godkända; samtliga fyra befintliga kalkyltolkare bevarade och central calculate() oförändrad.
- Inloggat prov med 798 befintliga poster och 11 verkliga filer. Inga kundposter skrevs till det gemensamma registret under proven.
- Dator 1280 × 1800 och telefon 384 × 685: ingen horisontell sidoverflow; prisval och sparknapp kontrollerade.
- Herbert sparades endast i en isolerad lokal testkopia. Årspriset 8 062 kr lästes tillbaka i avtalsöversikten; 6 objekt, ursprungliga versioner och övriga 797 poster bevarades.
- Sparande utan prisval blockeras både i vyn och i fyllImport. Saknat dokumentpris bevarar gamla objekt/utjämning. Flera källrader till samma mål avvisas. Ny serviceadress bevarar befintliga objekt/priser.

## Verkliga filer
| Underlag | Kontrollerat resultat |
|---|---|
| AV_Förslag_DANE_C0033.pdf | AB Herbert Karlssons Charkuterifabrik, Industrivägen 4 Härryda, 6 objekt, 4 031 kr/besök, 8 062 kr/år; pris på sida 2. |
| Sig.Avtal_DANE_C0033.pdf | Skannad utan text; separat rad under Granska, ingen automatisk sammanslagning med förslaget. |
| 2305.pdf, 2311.pdf, 2404.pdf | Saknar text; inga objekt eller priser gissades. |
| 2410_Herbert.pdf | Checklista/protokoll: Ej avtal även när förebyggande underhåll står i texten. |
| Avtal.CO_BE166.pdf | Gäsene Mejeriförening, Alingsåsvägen 32 Ljung, 9 objekt, 4 600 kr/besök, 9 200 kr/år; pris på sida 3. |
| FU_1_och_21.xlsx | 1 objekt, 2 000 kr/år; kunden måste väljas för fristående kalkyl. |
| Servicekalkyl_Flera_Fastigheter.xlsx | 6 objekt; platsnummer blir inte antal; prisantaganden kräver granskning. |
| FU_Avtal_Enkel_Mall.xltx | Formatet läses, 1 objekt och 1 150 kr/besök; kund saknas och besöksantal är ett antagande. |
| FU_GS_5år_Mall_-25_Q3.xltx | Tom mall, noll objektrader: inget avtal eller pris skapades. |

## Rättningar från proven
- Kundens formulärfält och Företag prioriteras framför signatursidans Beställare/Leverantör.
- Leveransadress läses i äldre mallar.
- Mobigo-checklistor skiljs från avtal; skannade avtalsfiler behålls för granskning.
- XLTX kan väljas/släppas, inte bara XLS/XLSX.
- Ändring av koppling/underlag återställer prisbeslutet. Dokumentimport utan objektrader behåller befintlig utjämning.

## Begränsningar före massimport
- Kompletta kundmappar med flera verkliga serviceadresser, dokumentrelationer och kalkylversioner saknas i tillgängligt provmaterial; massimport har därför inte godkänts.
- Fleradressavtal sparar källhänvisningar/adresser men importerar inte objekt eller priser. Ingen ny prisfördelningsregel infördes.
- Originaldokument arkiveras inte i appen; endast referenser sparas. Skannade dokument utan text kräver manuell kontroll.
- Saknat besöksantal, oklara kontaktuppgifter och motstridiga priser kräver fortsatt manuell granskning. Herbert-dokumentets sidfotstelefon kan inte säkert användas som kundtelefon.
- Molnsparning provades inte: ett nätverksskydd och avstängd synk användes för att inte ändra verkliga kundavtal.

## Ändrade filer
src/lib/pdf-import.ts, src/lib/import-files.ts, src/lib/price-review.ts, src/lib/avtal-store.ts, src/components/ImportPdf.tsx, src/lib/pdf-import.test.ts, src/lib/import-files.test.ts, src/lib/price-review.test.ts, src/lib/avtal-import.test.ts, src/bun-test.d.ts, public/changelog.json, AGENTS.md, roadmap.md, import-qa.md.
# Roadmap

## Öppet
- [x] Glasstil i vänstermenyn och större sammanfattning uppe till höger med objekt, tid och pris per år; verifierat ändrade värden, omladdning och telefonbredd utan kalkyländring.
- [x] Gemensamt designsystem: rött/blått/svart/vitt, typografi, avstånd, former och kontrollstilar; tillämpa i hela appen utan kalkyl- eller dokumentändringar.
- [x] Avtals-PDF byggs av originalfilerna (försättsblad, avtal, prislista) — endast befintliga fält fylls i; ordning: Fsb, sida 1–2, Bilaga 1, signatursida, Prislista
- [x] Redigerbart försättsblad i egen flik: behåll slogan och loggor, fast rubrik "Förebyggande Underhållsavtal", redigerbara kunduppgifter
- [x] Masterplan steg 1: stabil grund — granskad 2026-10-01
- [x] Masterplan steg 2: affärsregler — beslutade och genomförda 2026-10-03 (pris per servicebesök, besök/år per objekt 1–12, utjämning per besök, ett avtal per adress, valbara priser i Bilaga 1)
- [ ] Steg 3–9 (kundregister, objektregister, avtal, export, UI, moln, roller) — i tur och ordning
- [ ] SharePoint-koppling (eget Microsoft-konto per användare, via telefonerna): öppna connect_client-kortet för microsoft_sharepoint — PÅGÅR
- [x] Bygg hela avtalsflödet (avtal FU_Avtal_-25_Q4 + försättsblad Fsb_Q2-22 mottagna) — kund → objekt → pris → förhandsgranskning → PDF
- [x] Kalkyl-ändringar enligt mallen: rabatt bara på arbetskostnad, pris per tillfälle, utjämning +/- per tillfälle, 5-årstotal
- [x] Export: avtal som PDF + kalkyl som Excel laddas ner till telefonens "Mina filer" — ingen SharePoint-koppling i appen (beslutat 2026-09-29)
- [ ] Outlook-synk i appen (riktig koppling, App User Connector microsoft_outlook): connect_client-kort -> OAuth per anvandare -> kalenderny vy/hamtning — PÅGÅR
- [ ] Moln-lagring (Lovable Cloud) + kundmappar med versioner v1/v2/v3
- [ ] Publicering så appen kan installeras på Android-startskärmen

- [x] Mejlets ämne: "Avtalsförslag <avtalsnr>"

## Klart
- [x] Objekt-fält: Tillverkningsnummer, Fabrikat, Besiktningsnummer
- [x] Manuellt slutpris-fält (justeringsfält enligt kalkylmallen väntar på bygget ovan)
- [x] Ifyllda fält i avtals-PDF:en med Arial

- [x] Inloggningar per konto (e-post + lösenord) med synk mellan enheter

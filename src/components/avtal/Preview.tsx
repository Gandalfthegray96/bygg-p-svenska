import cover from "@/assets/avtal-cover.jpg.asset.json";
import header from "@/assets/avtal-header.jpg.asset.json";
import { type Avtal, calculate, fmtKr } from "@/lib/kalkyl";

function Field({ label, value, wide }: { label: string; value?: string | number; wide?: boolean }) {
  return (
    <div className={`doc-field ${wide ? "doc-field-wide" : ""}`}>
      <span className="doc-label">{label}</span>
      <span className="doc-line">{value}</span>
    </div>
  );
}

function PageHead({ a, page }: { a: Avtal; page: string }) {
  const c = a.customer;
  return (
    <>
      <img src={header.url} alt="UK Port Service – Försäljning, Montage, Service" className="doc-header" />
      <div className="doc-titlebar">
        <h1>AVTAL</h1>
        <div className="doc-meta">
          <span>Avtal nr:</span><b>{c.avtalNr}</b>
          <span>Sida:</span><b>{page}</b>
          <span>Datum:</span><b>{c.datum}</b>
          <span>Rev.</span><b>{c.rev}</b>
        </div>
      </div>
    </>
  );
}

function Footer() {
  return (
    <footer className="doc-footer">
      <div>info@ukportservice.se<br />www.ukportservice.se</div>
      <div><b>UK Portservice AB Göteborg</b><br />Reningsverksgatan 8<br />421 47 Västra Frölunda<br />Tel 031-23 08 60</div>
      <div><b>UK Portservice AB Borås</b><br />Vävlagargatan 15D<br />507 30 Brämhult<br />Tel 030-23 08 00</div>
      <div>F-skattsedel 556550-8339<br />Bolagets säte: Västra Götaland</div>
    </footer>
  );
}

export function Preview({ a }: { a: Avtal }) {
  const c = a.customer;
  const k = calculate(a);
  const visitLabel = (vk: number) => (k.visits.length > 1 ? `Kostnad servicebesök ${vk} exkl. moms` : "Kostnad per servicebesök exkl. moms");
  return (
    <div className="doc-root">
      {/* Försättsblad */}
      <section className="doc-page doc-cover" style={{ backgroundImage: `url(${cover.url})` }}>
        <div className="doc-cover-text">
          <p className="doc-tagline">Din <i>kompletta</i><br />portpartner</p>
          <h1>OFFERT</h1>
          <p className="doc-cover-customer">{c.bestallare}</p>
          <p className="doc-cover-title">{c.coverTitle}</p>
          <p className="doc-cover-nr">{c.avtalNr}</p>
        </div>
      </section>

      {/* Sida 1 */}
      <section className="doc-page">
        <PageHead a={a} page="1 av 3" />
        <p className="doc-small">Avser regelkravat förebyggande underhåll (enligt BFS 2018:2 H18) och akutservice enligt Bilaga 1 och Bilaga 2.</p>
        <h2>Avtal mellan parter</h2>
        <div className="doc-grid">
          <Field label="Beställare:" value={c.bestallare} />
          <Field label="Entreprenör:" value="UK Portservice AB" />
          <Field label="Org.nr:" value={c.orgNr} />
          <Field label="Org.nr:" value="55 65 50 - 8339" />
          <div />
          <Field label="Vår Referens:" value={c.varRef} />
        </div>
        <h2>Kund- & Fakturauppgifter</h2>
        <div className="doc-grid">
          <Field label="Er Referens:" value={c.erRef} />
          <Field label="Adress:" value={c.adress} />
          <Field label="Telefon:" value={c.telefon} />
          <Field label="Postnummer/Ort:" value={c.postort} />
          <Field label="E-post:" value={c.epost} />
          <Field label="Märkning Faktura:" value={c.markning} />
          <Field label="Befattning:" value={c.befattning} />
          <Field label="E-post Faktura:" value={c.epostFaktura} />
        </div>
        <h2>Anläggning</h2>
        <div className="doc-grid doc-grid-1">
          <Field label="Objekt:" value={c.anlObjekt} wide />
          <Field label="Adress:" value={c.anlAdress} wide />
          <Field label="Kontaktperson:" value={c.kontaktperson} wide />
          <div className="doc-field">
            <span className="doc-label">Antal objekt:</span><span className="doc-line doc-line-s">{k.totalQty}</span>
            <span className="doc-label">Servicebesök/år</span><span className="doc-line doc-line-s">{k.maxVisits}</span>
          </div>
        </div>
        <Footer />
      </section>

      {/* Sida 2 */}
      <section className="doc-page">
        <PageHead a={a} page="2 av 3" />
        <h3>TIDSPLAN</h3>
        <p>Förebyggande underhåll utförs avtalat antal gånger per år.<br />Planerade och bokade besök utförs på ordinarie arbetstid (vard. 07.00 - 16.00).</p>
        <h3>TILLVÄGAGÅNGSSÄTT</h3>
        <p><b>Beskrivning förebyggande underhåll (FU):</b> I det avtalade priset ingår funktionstester, säkerhetstester, balansering, justering och smörjning.</p>
        <p>Skyddsanordningar och delar som inte har tillfredsställande skydd och funktion gällande säkerhet och hälsa vid servicetillfället bytes eller repareras direkt utan genomgång och debiteras löpande.</p>
        <p>Övrigt noteras och presenteras innan byte eller reparation, t. ex. skador av kosmetisk karaktär eller delar som påverkar objektets livslängd.</p>
        <p><b>Beskrivning löpande arbeten:</b> Löpande arbeten innefattar samtliga beställda åtgärder som inte omfattas av avtalet. Tid, material mm. redovisas i tidrapport efter utfört arbete. Genomgång av utfört arbete görs på kundens begäran. Pris för arbeten och/eller material som inte ingår i avtalet angivet pris debiteras på löpande räkning enligt Leverantörens vid var tid gällande prislista. Fakturerings- och/eller miljöavgifter kan debiteras tid efter annan.</p>
        <p><b>Beskrivning entreprenad:</b> Kan innefatta arbeten som t.ex. automatikbyte, motorbyte, portbyte eller dylikt mot ett avtalat fast pris.</p>
        <h3>TIMKOSTNADER</h3>
        <p>Enligt bilaga 2.</p>
        <h3>RESERVDELAR</h3>
        <p>Enligt bilaga 2.</p>
        <h3>EKONOMI</h3>
        <p>Avtalet regleras med ett fast pris för entreprenörens åtagande/uppdrag gällande förebyggande underhåll. Övriga arbeten utförs på löpande räkning. Avtalet indexregleras varje år (kalenderår) enligt Arbetskostnadsindex (AKI) SNI 2007 N, basmånad oktober.</p>
        <p>Avtalet kan revideras löpande vid både avgående och tillkommande objekt. Entreprenören äger rätten att utöver avtalat pris erfordra ersättning för eventuella prishöjningar som entreprenören ej kunnat förutse och som påverkar kalkylen för utförandet av åtagandet/uppdraget under avtalstiden.</p>
        <p>För att förebyggande underhåll ska kunna utföras enligt avtal behöver objektens alla delar vara lättillgängliga för tekniker. Entreprenören äger rätt att revidera avtalat pris om objekten anses svårtillgängliga och därmed kräver mer tid än normalt.</p>
        <p>Båda parter äger rätten att påkalla prisförhandling för entreprenörens åtagande/uppdrag om förutsättningarna för avtalets genomförande förändras och ingen av parterna kunnat förutse åberopad förändring.</p>
        <p>I de fall utrustning, som t.ex. ställning, saxlift eller liknande erfordras som hjälp för att utföra åtagandet/uppdraget står beställaren för denna kostnad.</p>
        <Footer />
      </section>

      {/* Sida 3 */}
      <section className="doc-page">
        <PageHead a={a} page="3 av 3" />
        <h3>SEKRETESS</h3>
        <p>Varje part förbinder sig att iakttaga absolut sekretess rörande den andra partens tekniska och affärsmässiga förhållanden, både under och efter avtalstiden. Det gäller priser, kalkyler, offerter och annan konfidentiell information som har delats under samarbetet. Ingen part får vidarebefordra eller avslöja denna information för tredje part, om inte den andra parten givit sitt godkännande.</p>
        <h3>ÖVRIGT</h3>
        <p>Entreprenören ansvarar inte för person- eller egendomsskador som uppstår till följd av användning eller felaktig hantering av portar, grindar, bommar, dockningssystem, entrédörrar eller liknande utrustning, utöver vad som uttryckligen följer av tvingande lag.</p>
        <p>Om en part inte kan fullfölja avtalet på grund av exempelvis arbetskonflikt, maskinhaveri eller någon annan händelse som parten inte kan kontrollera, befrias den parten från sitt åtagande från den tidpunkt då hindret anmäls och en begäran om befrielse görs, tills hindret är åtgärdat.</p>
        <p>Tvister rörande tolkning eller tillämpning av detta avtal skall avgöras av allmän domstol enligt gällande svensk lag.</p>
        <p>Avtalet får inte överlåtas utan motpartens skriftliga godkännande.</p>
        <h3>BILAGOR</h3>
        <p>Bilaga 1. Kostnad<br />Bilaga 2. Prislista</p>
        <h3>AVTALSTID/UPPSÄGNING/FÖRLÄNGNING</h3>
        <p>Avtalet gäller tills vidare från och med datum för undertecknande. Avtalet gäller tills någon av parterna skriftligen säger upp det, då upphör avtalet utan uppsägningstid.</p>
        <p><b>Detta avtal är upprättat i två exemplar varav parterna har tagit var sitt.</b></p>
        <table className="doc-sign">
          <thead><tr><th>Beställare</th><th>UK Portservice AB</th></tr></thead>
          <tbody>
            {["Ort och datum:", "Namnförtydligande:", "Underskrift:"].map((l) => (
              <tr key={l}><td>{l}</td><td>{l}</td></tr>
            ))}
          </tbody>
        </table>
        <Footer />
      </section>

      {/* Bilaga 1 */}
      <section className="doc-page">
        <PageHead a={a} page="Bilaga 1" />
        <h2>Bilaga 1. Kostnad</h2>
        <div className="doc-grid">
          <Field label="Kund:" value={c.bestallare} />
          <Field label="Offertnummer:" value={c.avtalNr} />
        </div>
        <table className="doc-table">
          <thead>
            <tr><th>Objekt</th><th>Fabrikat</th><th>Tillv.nr</th><th>Besikt.nr</th><th className="r">Antal</th><th className="r">Besök/år</th></tr>
          </thead>
          <tbody>
            {a.rows.map((r) => (
              <tr key={r.id}><td>{r.name || "Objekt"}</td><td>{r.make}</td><td>{r.mfgNo}</td><td>{r.inspNo}</td><td className="r">{r.qty}</td><td className="r">{r.visits}</td></tr>
            ))}
          </tbody>
        </table>
        <table className="doc-table doc-sum">
          <tbody>
            <tr><td>Totalt antal objekt</td><td className="r">{k.totalQty} st</td></tr>
            {a.show.visit && k.visits.map((v) => (
              <tr key={v.k}><td>{visitLabel(v.k)}</td><td className="r">{fmtKr(v.perVisit)}</td></tr>
            ))}
            {a.show.year && <tr><td>Kostnad per år exkl. moms</td><td className="r">{fmtKr(k.perYear)}</td></tr>}
            {a.show.total5 && <tr className="b"><td>Kostnad 5 år garantiservice exkl. moms</td><td className="r">{fmtKr(k.total5)}</td></tr>}
          </tbody>
        </table>
        <Footer />
      </section>
    </div>
  );
}

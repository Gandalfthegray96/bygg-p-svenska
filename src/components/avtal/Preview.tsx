const cover = { url: "/pdf/avtal-cover.jpg" };
const header = { url: "/pdf/avtal-header.jpg" };
import { KLAUSULER, klausulText } from "@/lib/klausuler";
import { type Avtal, calculate, fmtKr, rabattText } from "@/lib/kalkyl";

// Bilaga 2 – Prislista 2026 Q2 (fasta listpriser, påverkar inte kalkylen)
const PRISLISTA: [string, string][] = [
  ["Framkörning ordinarie timdebitering", "745,00 kr"],
  ["Ordinarie (07.00 – 16.00) timdebitering", "975,00 kr"],
  ["Ordinarie planerad övertid", "1 367,00 kr"],
  ["Timdebitering ordinarie planerad helg", "1 901,00 kr"],
  ["Timdebitering jour", "1 945,00 kr"],
  ["Utryckningskostnad jour (avtalskund)", "6 405,00 kr"],
  ["Utryckningskostnad jour (ej avtalskund)", "9 150,00 kr"],
];

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

function KlausulBlock({ a, sida }: { a: Avtal; sida: 2 | 3 }) {
  return (
    <>
      {KLAUSULER.filter((k) => k.sida === sida).map((k) => (
        <div key={k.id}>
          <h3>{k.rubrik}</h3>
          {klausulText(a.klausuler, k).split(/\n\s*\n/).filter((x) => x.trim()).map((para, i) => {
            const m = para.match(/^(Beskrivning[^:]{0,60}:)([\s\S]*)$/);
            return <p key={i} style={{ whiteSpace: "pre-line" }}>{m ? <><b>{m[1]}</b>{m[2]}</> : para}</p>;
          })}
        </div>
      ))}
    </>
  );
}

export function CoverPreview({ a }: { a: Avtal }) {
  const c = a.customer;
  return (
    <section className="doc-page doc-cover" style={{ backgroundImage: `url(${cover.url})` }}>
      <div className="doc-cover-text">
        <p className="doc-tagline">Din <i>kompletta</i><br />portpartner</p>
        <h1>Förebyggande Underhållsavtal</h1>
        <p className="doc-cover-customer">
          {c.bestallare}
          {c.anlAdress && <><br />{c.anlAdress}</>}
          {c.anlObjekt && <><br />{c.anlObjekt}</>}
        </p>
        <p className="doc-cover-title">{c.coverTitle}</p>
        <p className="doc-cover-nr">{c.avtalNr}</p>
      </div>
    </section>
  );
}

export function Preview({ a }: { a: Avtal }) {
  const c = a.customer;
  const k = calculate(a);
  const visitLabel = (vk: number) => (k.visits.length > 1 ? `Kostnad servicebesök ${vk} exkl. moms` : "Kostnad per servicebesök exkl. moms");
  return (
    <div className="doc-root">
      {/* Försättsblad */}
      <CoverPreview a={a} />

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
        <KlausulBlock a={a} sida={2} />
        <Footer />
      </section>

      {(a.attachments?.cover || a.attachments?.contract) && (
        <section className="doc-page">
          <h2>Egen PDF används</h2>
          <p>{[a.attachments?.cover && `Försättsblad: ${a.attachments.cover.name}`, a.attachments?.contract && `Huvudavtal: ${a.attachments.contract.name}`].filter(Boolean).join(" · ")}</p>
          <p className="doc-small">Den sparade PDF:en använder dessa filer i stället för standardsidorna som visas här.</p>
        </section>
      )}

      {/* Bilaga 1 – placeras före signatursidan */}
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

      {/* Sida 3 – signatursida */}
      <section className="doc-page">
        <PageHead a={a} page="3 av 3" />
        <KlausulBlock a={a} sida={3} />
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

      {/* Bilaga 2 – Prislista, alltid sista bladet */}
      <section className="doc-page">
        <img src={header.url} alt="UK Port Service – Försäljning, Montage, Service" className="doc-header" />
        <h2>PRISLISTA</h2>
        <p><b>Bilaga 2</b></p>
        <h3>Ordinarie priser, framkörning, utryckningskostnader och timpriser</h3>
        <table className="doc-table doc-sum">
          <tbody>
            {PRISLISTA.map(([t, p]) => (
              <tr key={t}><td>{t}</td><td className="r">{p}</td></tr>
            ))}
          </tbody>
        </table>
        <p><b>{rabattText(a)}</b><br />(gäller samtliga lagerförda reservdelar)</p>
        <p>Betalningstid: 30 dagar netto.<br />Material faktureras vid leverans.<br />Arbete faktureras löpande.</p>
        <p>Leveransvillkor: Allmänna leveransbestämmelser Port 19 och Port 07A.</p>
        <p>Priserna gäller från och med avtalsdatum tillsvidare. Vi förbehåller oss rätten att justera priser utan föregående avisering till följd av förändringar i kostnader, råvarupriser eller andra marknadsförhållanden.</p>
        <Footer />
      </section>
    </div>
  );
}

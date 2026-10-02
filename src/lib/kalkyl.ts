export type ObjRow = {
  id: string;
  name: string;
  qty: number;
  minutes: number;
  visitsPerYear: number;
  mfgNo: string;
  make: string;
  inspNo: string;
};

export type Customer = {
  avtalNr: string;
  datum: string;
  rev: string;
  bestallare: string;
  orgNr: string;
  varRef: string;
  erRef: string;
  telefon: string;
  epost: string;
  befattning: string;
  adress: string;
  postort: string;
  markning: string;
  epostFaktura: string;
  anlObjekt: string;
  anlAdress: string;
  kontaktperson: string;
  coverTitle: string;
};

export type Avtal = {
  customer: Customer;
  rows: ObjRow[];
  hourRate: number;
  tripFee: number;
  discount: number;
  adjust: string;
};

export const YEARS = 5;

export function newRow(): ObjRow {
  return { id: Math.random().toString(36).slice(2), name: "", qty: 1, minutes: 30, visitsPerYear: 2, mfgNo: "", make: "", inspNo: "" };
}

export function emptyCustomer(): Customer {
  return {
    avtalNr: "", datum: new Date().toISOString().slice(0, 10), rev: "",
    bestallare: "", orgNr: "", varRef: "", erRef: "", telefon: "", epost: "", befattning: "",
    adress: "", postort: "", markning: "", epostFaktura: "",
    anlObjekt: "", anlAdress: "", kontaktperson: "", coverTitle: "Förebyggande underhåll",
  };
}

export function emptyAvtal(): Avtal {
  return { customer: emptyCustomer(), rows: [newRow()], hourRate: 975, tripFee: 745, discount: 0, adjust: "" };
}

export function normalizeAvtal(a: Partial<Avtal> | null | undefined): Avtal {
  const base = emptyAvtal();
  if (!a) return base;
  return {
    ...base,
    ...a,
    customer: { ...base.customer, ...(a.customer ?? {}) },
    rows: Array.isArray(a.rows) && a.rows.length ? a.rows.map((r) => ({ ...newRow(), ...r })) : base.rows,
  };
}

/** "150" → 150, "-893" → -893, "1 234,50" → 1234.5, "" → 0 */
export function parseAmount(s: string): number {
  const t = s.trim().replace(/\s/g, "").replace(/kr$/i, "").replace(",", ".").replace("−", "-");
  if (t === "" || t === "-" || t === "+") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

export type VisitCalc = {
  /** 1-baserat besöksnummer */
  index: number;
  /** index i a.rows för objekt som ingår i besöket */
  rowIdx: number[];
  minutes: number;
  trips: number;
  travel: number;
  laborGross: number;
  laborNet: number;
  /** pris för besöket exkl. moms (framkörning + arbete netto + utjämning) */
  price: number;
};

/**
 * Central kalkyl – enda källan för alla prisberäkningar (UI, PDF, Excel, mejl).
 * Besök k innehåller alla objekt med besök/år >= k.
 * Framkörning: 1 per påbörjat 8-timmarspass per besök (en adress).
 * Rabatt gäller bara arbetet. Utjämning läggs på varje besök.
 */
export function calculate(a: Avtal) {
  const rowMins = a.rows.map((r) => Math.max(0, r.qty) * Math.max(0, r.minutes));
  const totalMinutes = rowMins.reduce((s, m) => s + m, 0);
  const hours = totalMinutes / 60;
  const adjust = parseAmount(a.adjust);
  const freqs = a.rows.map((r) => Math.max(0, Math.floor(r.visitsPerYear || 0)));
  const maxVisits = freqs.length ? Math.max(...freqs) : 0;

  const visits: VisitCalc[] = [];
  for (let v = 1; v <= maxVisits; v++) {
    const rowIdx = a.rows.map((_, i) => i).filter((i) => (freqs[i] ?? 0) >= v && (rowMins[i] ?? 0) > 0);
    const minutes = rowIdx.reduce((s, i) => s + (rowMins[i] ?? 0), 0);
    const trips = minutes > 0 ? Math.ceil(minutes / 480) : 0;
    const travel = trips * a.tripFee;
    const laborGross = (minutes / 60) * a.hourRate;
    const laborNet = laborGross * (1 - a.discount / 100);
    const price = travel + laborNet + adjust;
    visits.push({ index: v, rowIdx, minutes, trips, travel, laborGross, laborNet, price });
  }

  const perYear = visits.reduce((s, v) => s + v.price, 0);
  const total5 = perYear * YEARS;
  const totalQty = a.rows.reduce((s, r) => s + Math.max(0, r.qty), 0);
  const laborGrossTotal = visits.reduce((s, v) => s + v.laborGross, 0);
  const laborNetTotal = visits.reduce((s, v) => s + v.laborNet, 0);
  const travelTotal = visits.reduce((s, v) => s + v.travel, 0);
  const discountAmount = laborGrossTotal - laborNetTotal;

  /** Styckespris per år: objektets andel (minuter) av varje besök det ingår i, delat på antal */
  const unitPrices = a.rows.map((r, i) => {
    if (r.qty <= 0) return 0;
    let year = 0;
    for (const v of visits) {
      if (v.minutes > 0 && v.rowIdx.includes(i)) year += ((rowMins[i] ?? 0) / v.minutes) * v.price;
    }
    return year / r.qty;
  });

  return {
    rowMins, totalMinutes, hours, adjust, freqs, maxVisits, visits,
    perYear, total5, totalQty, unitPrices,
    laborGrossTotal, laborNetTotal, travelTotal, discountAmount,
  };
}

export const fmtKr = (n: number) => {
  const dec = Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2;
  return new Intl.NumberFormat("sv-SE", { minimumFractionDigits: dec, maximumFractionDigits: 2 }).format(n) + " kr";
};
export const fmtNum = (n: number) => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 }).format(n);

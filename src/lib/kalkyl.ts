export type ObjRow = {
  id: string;
  name: string;
  qty: number;
  minutes: number;
  visits: number;
  mfgNo: string;
  make: string;
  inspNo: string;
};

export type ShowPrices = { visit: boolean; year: boolean; total5: boolean };

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
  show: ShowPrices;
};

export const YEARS = 5;
export const MAX_VISITS = 12;

export function newRow(): ObjRow {
  return { id: Math.random().toString(36).slice(2), name: "", qty: 1, minutes: 30, visits: 2, mfgNo: "", make: "", inspNo: "" };
}

export function clampVisits(n: unknown): number {
  const v = Math.round(Number(n) || 1);
  return Math.min(MAX_VISITS, Math.max(1, v));
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
  return {
    customer: emptyCustomer(),
    rows: [newRow()],
    hourRate: 975,
    tripFee: 745,
    discount: 0,
    adjust: "",
    show: { visit: true, year: true, total5: true },
  };
}

export function normalizeAvtal(a: Partial<Avtal> | null | undefined): Avtal {
  const base = emptyAvtal();
  if (!a) return base;
  return {
    ...base,
    ...a,
    customer: { ...base.customer, ...(a.customer ?? {}) },
    show: { ...base.show, ...(a.show ?? {}) },
    rows: Array.isArray(a.rows) && a.rows.length ? a.rows.map((r) => ({ ...newRow(), ...r, visits: clampVisits(r.visits) })) : base.rows,
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
  k: number;
  minutes: number;
  hours: number;
  trips: number;
  travel: number;
  laborGross: number;
  laborNet: number;
  perVisit: number;
};

/**
 * Central kalkyl: pris per servicebesök.
 * Besök k omfattar objekten med ≥ k besök/år. Pris per besök =
 * framkörning (per påbörjad 8 h) + arbete netto (rabatten gäller bara arbete) + utjämning.
 * Ett avtal gäller en adress, därför räknas framkörning per besök – inte per adress.
 */
export function calculate(a: Avtal) {
  const rowVisits = a.rows.map((r) => clampVisits(r.visits));
  const rowMins = a.rows.map((r) => Math.max(0, r.qty) * Math.max(0, r.minutes));
  const totalMinutes = rowMins.reduce((s, m) => s + m, 0);
  const totalQty = a.rows.reduce((s, r) => s + Math.max(0, r.qty), 0);
  const maxVisits = rowVisits.reduce((m, v) => Math.max(m, v), 1);
  const adjust = parseAmount(a.adjust);

  const visits: VisitCalc[] = [];
  for (let k = 1; k <= maxVisits; k++) {
    const minutes = rowMins.reduce((s, m, i) => (rowVisits[i] >= k ? s + m : s), 0);
    if (minutes <= 0) continue;
    const trips = Math.ceil(minutes / 480);
    const travel = trips * a.tripFee;
    const laborGross = (minutes / 60) * a.hourRate;
    const laborNet = laborGross * (1 - a.discount / 100);
    visits.push({ k, minutes, hours: minutes / 60, trips, travel, laborGross, laborNet, perVisit: travel + laborNet + adjust });
  }

  const perYear = visits.reduce((s, v) => s + v.perVisit, 0);
  const total5 = perYear * YEARS;

  // Styckpris per rad och år: radens andel av varje besök den ingår i, delat på antal
  const unitPrices = a.rows.map((r, i) => {
    if (r.qty <= 0) return 0;
    let sum = 0;
    for (const v of visits) {
      if (rowVisits[i] < v.k) continue;
      const visitMins = rowMins.reduce((s, m, j) => (rowVisits[j] >= v.k ? s + m : s), 0);
      if (visitMins > 0) sum += ((rowMins[i] / visitMins) * v.perVisit) / r.qty;
    }
    return sum;
  });

  return { rowMins, rowVisits, totalMinutes, totalQty, maxVisits, adjust, visits, perYear, total5, unitPrices };
}

export const fmtKr = (n: number) => {
  const dec = Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2;
  return new Intl.NumberFormat("sv-SE", { minimumFractionDigits: dec, maximumFractionDigits: 2 }).format(n) + " kr";
};
export const fmtNum = (n: number) => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 }).format(n);

export type ObjRow = {
  id: string;
  name: string;
  qty: number;
  minutes: number;
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

export const VISITS_PER_YEAR = 2;
export const YEARS = 5;
export const TOTAL_VISITS = VISITS_PER_YEAR * YEARS;

export function newRow(): ObjRow {
  return { id: Math.random().toString(36).slice(2), name: "", qty: 1, minutes: 30, mfgNo: "", make: "", inspNo: "" };
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

export function calculate(a: Avtal) {
  const rowMins = a.rows.map((r) => Math.max(0, r.qty) * Math.max(0, r.minutes));
  const totalMinutes = rowMins.reduce((s, m) => s + m, 0);
  const hours = totalMinutes / 60;
  const trips = totalMinutes > 0 ? Math.ceil(totalMinutes / 480) : 0;
  const travel = trips * a.tripFee;
  const laborGross = hours * a.hourRate;
  const discountAmount = laborGross * (a.discount / 100);
  const laborNet = laborGross - discountAmount;
  const adjust = parseAmount(a.adjust);
  const perVisit = travel + laborNet + adjust;
  const perYear = perVisit * VISITS_PER_YEAR;
  const total5 = perVisit * TOTAL_VISITS;
  const totalQty = a.rows.reduce((s, r) => s + Math.max(0, r.qty), 0);
  const unitPrices = a.rows.map((r, i) =>
    totalMinutes > 0 && r.qty > 0 ? ((rowMins[i] / totalMinutes) * perVisit) / r.qty : 0
  );
  return { rowMins, totalMinutes, hours, trips, travel, laborGross, discountAmount, laborNet, adjust, perVisit, perYear, total5, totalQty, unitPrices };
}

export const fmtKr = (n: number) => {
  const dec = Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2;
  return new Intl.NumberFormat("sv-SE", { minimumFractionDigits: dec, maximumFractionDigits: 2 }).format(n) + " kr";
};
export const fmtNum = (n: number) => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 }).format(n);

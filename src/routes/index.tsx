import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prisräknare Underhållsavtal" },
      {
        name: "description",
        content:
          "Räkna snabbt pris på förebyggande underhållsavtal: objekt, servicetid, timpeng, framkörning, rabatt och manuellt slutpris.",
      },
      { property: "og:title", content: "Prisräknare Underhållsavtal" },
      {
        property: "og:description",
        content:
          "Räkna pris på underhållsavtal: objekt, servicetid, timpeng, framkörning, rabatt och manuellt slutpris.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
    ],
  }),
  component: Calculator,
});

import { useEffect, useMemo, useState } from "react";

type PortRow = {
  id: string;
  name: string;
  qty: number;
  minutes: number;
  mfgNo: string;
  make: string;
  inspNo: string;
};

const HOUR_RATE_KEY = "uc-hour-rate";
const TRIP_FEE_KEY = "uc-trip-fee";
const TRIP_WINDOW_KEY = "uc-trip-window";
const ROWS_KEY = "uc-rows";
const DISCOUNT_KEY = "uc-discount";
const MANUAL_PRICE_KEY = "uc-manual-price";
const CUSTOMER_EMAIL_KEY = "uc-customer-email";
const CUSTOMER_NAME_KEY = "uc-customer-name";

const DEFAULT_HOUR_RATE = 975;
const DEFAULT_TRIP_FEE = 745;
const DEFAULT_TRIP_WINDOW = 8;

function newRow(): PortRow {
  return {
    id: Math.random().toString(36).slice(2),
    name: "",
    qty: 1,
    minutes: 30,
    mfgNo: "",
    make: "",
    inspNo: "",
  };
}

function normalizeRow(r: Partial<PortRow>): PortRow {
  return {
    ...newRow(),
    ...r,
    id: r.id ?? newRow().id,
  };
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseManualPrice(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(/kr$/i, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const fmtKr = (n: number) => {
  const dec = Number.isInteger(n) ? 0 : 2;
  return (
    new Intl.NumberFormat("sv-SE", {
      minimumFractionDigits: dec,
      maximumFractionDigits: 2,
    }).format(n) + " kr"
  );
};
const fmtNum = (n: number) =>
  new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 }).format(n);

function Calculator() {
  const [hourRate, setHourRate] = useState<number>(DEFAULT_HOUR_RATE);
  const [tripFee, setTripFee] = useState<number>(DEFAULT_TRIP_FEE);
  const [tripWindow, setTripWindow] = useState<number>(DEFAULT_TRIP_WINDOW);
  const [rows, setRows] = useState<PortRow[]>([newRow()]);
  const [discount, setDiscount] = useState<number>(0);
  const [manualPrice, setManualPrice] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  // Load saved state (browser only)
  useEffect(() => {
    const readNum = (key: string): number | null => {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === "") return null;
      const n = Number(raw);
      return Number.isNaN(n) ? null : n;
    };
    const savedHour = readNum(HOUR_RATE_KEY);
    const savedTrip = readNum(TRIP_FEE_KEY);
    const savedWindow = readNum(TRIP_WINDOW_KEY);
    const savedRows = loadJSON<PortRow[] | null>(ROWS_KEY, null);
    const savedDiscount = readNum(DISCOUNT_KEY);
    const savedManual = localStorage.getItem(MANUAL_PRICE_KEY);
    const savedEmail = localStorage.getItem(CUSTOMER_EMAIL_KEY);
    const savedName = localStorage.getItem(CUSTOMER_NAME_KEY);

    if (savedHour !== null && savedHour > 0) setHourRate(savedHour);
    if (savedTrip !== null && savedTrip >= 0) setTripFee(savedTrip);
    if (savedWindow !== null && savedWindow > 0) setTripWindow(savedWindow);
    if (Array.isArray(savedRows) && savedRows.length > 0)
      setRows(savedRows.map(normalizeRow));
    if (savedDiscount !== null && savedDiscount >= 0) setDiscount(savedDiscount);
    if (savedManual !== null) setManualPrice(savedManual);
    if (savedEmail !== null) setCustomerEmail(savedEmail);
    if (savedName !== null) setCustomerName(savedName);
    setHydrated(true);
  }, []);

  // Persist
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(HOUR_RATE_KEY, String(hourRate));
    localStorage.setItem(TRIP_FEE_KEY, String(tripFee));
    localStorage.setItem(TRIP_WINDOW_KEY, String(tripWindow));
    localStorage.setItem(ROWS_KEY, JSON.stringify(rows));
    localStorage.setItem(DISCOUNT_KEY, String(discount));
    if (manualPrice) localStorage.setItem(MANUAL_PRICE_KEY, manualPrice);
    else localStorage.removeItem(MANUAL_PRICE_KEY);
    if (customerEmail) localStorage.setItem(CUSTOMER_EMAIL_KEY, customerEmail);
    else localStorage.removeItem(CUSTOMER_EMAIL_KEY);
    if (customerName) localStorage.setItem(CUSTOMER_NAME_KEY, customerName);
    else localStorage.removeItem(CUSTOMER_NAME_KEY);
  }, [hydrated, hourRate, tripFee, tripWindow, rows, discount, manualPrice, customerEmail, customerName]);

  const calc = useMemo(() => {
    const totalMinutes = rows.reduce(
      (sum, r) => sum + Math.max(0, r.qty) * Math.max(0, r.minutes),
      0
    );
    const hours = totalMinutes / 60;
    const labor = hours * hourRate;
    const trips = hours > 0 ? Math.max(1, Math.ceil(hours / Math.max(1, tripWindow))) : 0;
    const travel = trips * tripFee;
    const subtotal = labor + travel;
    const discountAmount = subtotal * (discount / 100);
    const afterDiscount = subtotal - discountAmount;
    const manual = parseManualPrice(manualPrice);
    const finalPrice = manual !== null ? manual : afterDiscount;
    return { hours, labor, trips, travel, subtotal, discountAmount, afterDiscount, manual, finalPrice };
  }, [rows, hourRate, tripFee, tripWindow, discount, manualPrice]);

  const updateRow = (id: string, patch: Partial<PortRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const openMail = () => {
    const subject = `Underhållsavtal – ${customerName || "UK Portservice"}`;
    const lines = [
      `Hej${customerName ? " " + customerName : ""}!`,
      "",
      "Tack för att ni valt UK Portservice!",
      "",
      "Här kommer ert avtalsförslag för förebyggande underhåll. Avtalet och kalkylen bifogas i detta mejl.",
      "",
      "Sammanfattning:",
      ...rows
        .filter((r) => r.name || r.qty > 0)
        .map(
          (r) =>
            `• ${r.name || "Objekt"} – ${r.qty} st, ${r.minutes} min/st` +
            (r.make ? `, fabrikat: ${r.make}` : "") +
            (r.mfgNo ? `, tillv.nr: ${r.mfgNo}` : "") +
            (r.inspNo ? `, besikt.nr: ${r.inspNo}` : "")
        ),
      `• Total servicetid: ${fmtNum(calc.hours)} h`,
      `• Framkörning: ${calc.trips} st × ${fmtKr(tripFee)}`,
      discount > 0 ? `• Rabatt: ${fmtNum(discount)} %` : "",
      "",
      `Pris: ${fmtKr(calc.finalPrice)}`,
      "",
      "Återkom gärna om ni har frågor eller vill justera något.",
      "",
      "Med vänliga hälsningar,",
      "UK Portservice",
    ].filter((l) => l !== "");
    const href = `mailto:${encodeURIComponent(customerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
    window.location.href = href;
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img src="/icon-512.png" alt="" className="h-9 w-9 rounded-lg" />
            <div>
              <h1 className="text-lg font-bold leading-tight text-foreground">
                Prisräknare Underhållsavtal
              </h1>
              <p className="text-xs text-muted-foreground">
                Förebyggande underhåll
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        {/* Objekt */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Objekt</h2>
            <button
              onClick={() => setRows((prev) => [...prev, newRow()])}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              + Lägg till objekt
            </button>
          </div>

          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-border bg-background/60 p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={row.name}
                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                    placeholder="Objektnamn, t.ex. Port A1"
                    className="min-w-0 flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                  />
                  {rows.length > 1 && (
                    <button
                      onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                      aria-label={`Ta bort ${row.name || "objekt"}`}
                      className="shrink-0 rounded-lg border border-input px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      Antal
                    </span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={row.qty}
                      onChange={(e) =>
                        updateRow(row.id, { qty: Number(e.target.value) || 0 })
                      }
                      className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      Servicetid per st (min)
                    </span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={row.minutes}
                      onChange={(e) =>
                        updateRow(row.id, { minutes: Number(e.target.value) || 0 })
                      }
                      className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      Tillverkningsnummer
                    </span>
                    <input
                      value={row.mfgNo}
                      onChange={(e) => updateRow(row.id, { mfgNo: e.target.value })}
                      placeholder="T.ex. 123456"
                      className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      Fabrikat
                    </span>
                    <input
                      value={row.make}
                      onChange={(e) => updateRow(row.id, { make: e.target.value })}
                      placeholder="T.ex. Crawford"
                      className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      Besiktningsnummer
                    </span>
                    <input
                      value={row.inspNo}
                      onChange={(e) => updateRow(row.id, { inspNo: e.target.value })}
                      placeholder="T.ex. B-2024-01"
                      className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rabatt & pris */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-foreground">Rabatt & pris</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Rabatt (%)
              </span>
              <input
                type="number"
                min={0}
                max={100}
                inputMode="decimal"
                value={discount}
                onChange={(e) =>
                  setDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                }
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Manuellt slutpris (kr)
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Lämna tomt för beräknat pris"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
                {parseManualPrice(manualPrice) !== null && (
                  <button
                    type="button"
                    onClick={() => setManualPrice("")}
                    className="shrink-0 rounded-lg border border-input px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                  >
                    Rensa
                  </button>
                )}
              </div>
            </label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Skriv in en summa (även decimaler, t.ex. 8 893,50) för att sätta slutpriset
            manuellt. Lämna fältet tomt för att använda det beräknade priset.
          </p>
        </section>

        {/* Sammanställning */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-foreground">Sammanställning</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground">Total servicetid</dt>
              <dd className="font-medium text-foreground">
                {fmtNum(calc.hours)} h <span className="text-muted-foreground">({Math.round(calc.hours * 60)} min)</span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground">Arbetskostnad</dt>
              <dd className="font-medium text-foreground">{fmtKr(calc.labor)}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground">
                Framkörning ({calc.trips} × {fmtKr(tripFee)})
              </dt>
              <dd className="font-medium text-foreground">{fmtKr(calc.travel)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-border pt-2">
              <dt className="text-muted-foreground">Delsumma</dt>
              <dd className="font-medium text-foreground">{fmtKr(calc.subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex items-baseline justify-between">
                <dt className="text-muted-foreground">
                  Rabatt ({fmtNum(discount)}%)
                </dt>
                <dd className="font-medium text-destructive">
                  −{fmtKr(calc.discountAmount)}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-4 rounded-xl bg-primary/10 p-4 text-center ring-1 ring-primary/20">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {parseManualPrice(manualPrice) !== null ? "Pris (manuellt)" : "Pris"}
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-primary">
              {fmtKr(calc.finalPrice)}
            </p>
            {parseManualPrice(manualPrice) !== null && (
              <p className="mt-1 text-xs text-muted-foreground">
                Beräknat: {fmtKr(calc.afterDiscount)}
              </p>
            )}
          </div>
        </section>

        {/* Prisuppgifter */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-foreground">Prisuppgifter</h2>
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Timpeng (kr/h)
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={hourRate}
                onChange={(e) => setHourRate(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Framkörning (kr)
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={tripFee}
                onChange={(e) => setTripFee(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Framkörning per 8 h
              </span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={1}
                readOnly
                aria-label="En framkörning per åtta timmar"
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground outline-none"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            En framkörning räknas per 8 h påbörjad tid. Timpeng och framkörningsavgift
            sparas i appen när de ändras.
          </p>
        </section>
      </main>
    </div>
  );
}

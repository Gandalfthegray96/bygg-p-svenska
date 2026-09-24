import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prisräknare Underhållsavtal" },
      {
        name: "description",
        content:
          "Räkna snabbt pris på förebyggande underhållsavtal: porter, antal, servestid, timpeng, framkörning, rabatt och avrundning.",
      },
      { property: "og:title", content: "Prisräknare Underhållsavtal" },
      {
        property: "og:description",
        content:
          "Räkna pris på underhållsavtal: porter, servestid, timpeng, framkörning, rabatt och avrundning.",
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
};

type RoundingStep = "none" | "10" | "50" | "100" | "1000";
type RoundingDir = "nearest" | "up" | "down";

const HOUR_RATE_KEY = "uc-hour-rate";
const TRIP_FEE_KEY = "uc-trip-fee";
const TRIP_WINDOW_KEY = "uc-trip-window";
const ROWS_KEY = "uc-rows";
const DISCOUNT_KEY = "uc-discount";
const ROUND_STEP_KEY = "uc-round-step";
const ROUND_DIR_KEY = "uc-round-dir";

const DEFAULT_HOUR_RATE = 975;
const DEFAULT_TRIP_FEE = 745;
const DEFAULT_TRIP_WINDOW = 8;

function newRow(): PortRow {
  return { id: Math.random().toString(36).slice(2), name: "", qty: 1, minutes: 30 };
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

function roundPrice(value: number, step: RoundingStep, dir: RoundingDir): number {
  if (step === "none") return value;
  const s = Number(step);
  if (dir === "up") return Math.ceil(value / s) * s;
  if (dir === "down") return Math.floor(value / s) * s;
  return Math.round(value / s) * s;
}

const fmtKr = (n: number) =>
  new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n) + " kr";
const fmtNum = (n: number) =>
  new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 }).format(n);

function Calculator() {
  const [hourRate, setHourRate] = useState<number>(DEFAULT_HOUR_RATE);
  const [tripFee, setTripFee] = useState<number>(DEFAULT_TRIP_FEE);
  const [tripWindow, setTripWindow] = useState<number>(DEFAULT_TRIP_WINDOW);
  const [rows, setRows] = useState<PortRow[]>([newRow()]);
  const [discount, setDiscount] = useState<number>(0);
  const [roundStep, setRoundStep] = useState<RoundingStep>("none");
  const [roundDir, setRoundDir] = useState<RoundingDir>("nearest");
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
    const savedStep = localStorage.getItem(ROUND_STEP_KEY) as RoundingStep | null;
    const savedDir = localStorage.getItem(ROUND_DIR_KEY) as RoundingDir | null;

    if (savedHour !== null && savedHour > 0) setHourRate(savedHour);
    if (savedTrip !== null && savedTrip >= 0) setTripFee(savedTrip);
    if (savedWindow !== null && savedWindow > 0) setTripWindow(savedWindow);
    if (Array.isArray(savedRows) && savedRows.length > 0) setRows(savedRows);
    if (savedDiscount !== null && savedDiscount >= 0) setDiscount(savedDiscount);
    if (savedStep) setRoundStep(savedStep);
    if (savedDir) setRoundDir(savedDir);
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
    localStorage.setItem(ROUND_STEP_KEY, roundStep);
    localStorage.setItem(ROUND_DIR_KEY, roundDir);
  }, [hydrated, hourRate, tripFee, tripWindow, rows, discount, roundStep, roundDir]);

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
    const finalPrice = roundPrice(afterDiscount, roundStep, roundDir);
    return { hours, labor, trips, travel, subtotal, discountAmount, afterDiscount, finalPrice };
  }, [rows, hourRate, tripFee, tripWindow, discount, roundStep, roundDir]);

  const updateRow = (id: string, patch: Partial<PortRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

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
        {/* Porter */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Porter</h2>
            <button
              onClick={() => setRows((prev) => [...prev, newRow()])}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              + Lägg till port
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
                    placeholder="Portnamn, t.ex. Port A1"
                    className="min-w-0 flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                  />
                  {rows.length > 1 && (
                    <button
                      onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                      aria-label={`Ta bort ${row.name || "port"}`}
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
                      Servestid per st (min)
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
              </div>
            ))}
          </div>
        </section>

        {/* Rabatt & pris */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-foreground">Rabatt & pris</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                Avrunda till
              </span>
              <select
                value={roundStep}
                onChange={(e) => setRoundStep(e.target.value as RoundingStep)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="none">Ingen avrundning</option>
                <option value="10">10 kr</option>
                <option value="50">50 kr</option>
                <option value="100">100 kr</option>
                <option value="1000">1 000 kr</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Riktning
              </span>
              <select
                value={roundDir}
                onChange={(e) => setRoundDir(e.target.value as RoundingDir)}
                disabled={roundStep === "none"}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="nearest">Närmaste</option>
                <option value="up">Uppåt</option>
                <option value="down">Nedåt</option>
              </select>
            </label>
          </div>
        </section>

        {/* Sammanställning */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-foreground">Sammanställning</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground">Total servestid</dt>
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
              Pris{" "}
              {roundStep !== "none"
                ? `(avrundat ${roundDir === "up" ? "uppåt" : roundDir === "down" ? "nedåt" : "till"} ${new Intl.NumberFormat("sv-SE").format(Number(roundStep))} kr)`
                : ""}
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-primary">
              {fmtKr(calc.finalPrice)}
            </p>
            {roundStep !== "none" && calc.finalPrice !== calc.afterDiscount && (
              <p className="mt-1 text-xs text-muted-foreground">
                Exakt: {fmtKr(calc.afterDiscount)}
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
                Antal framkörn./h
              </span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={tripWindow}
                onChange={(e) => setTripWindow(Number(e.target.value) || 1)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            En framkörning räknas per {tripWindow} h påbörjad tid. Ändra värdena här om
            era priser ändras — de sparas i appen.
          </p>
        </section>
      </main>
    </div>
  );
}

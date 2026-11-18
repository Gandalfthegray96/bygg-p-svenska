import type { CustomerFolder } from "./avtal-store";
import { normKund } from "./import-match";
import { facilitiesOf, normalizeAvtal, type Avtal, type LinkedDocument } from "./kalkyl";
import type { ImportHit, Kalkyl } from "./pdf-import";

export const normAddress = (value: string) => value.split(",")[0]?.toLowerCase().replace(/[^a-zåäö0-9]/g, "") ?? "";
export const customerDirectory = (path: string) => {
  const parts = path.replace(/\\/g, "/").split("/").slice(0, -1);
  while (parts.length > 1 && /^(av|avt|avtal|a|fu|kalkyl(er)?|underhåll|serviceavtal)$/i.test(parts.at(-1) ?? "")) parts.pop();
  return parts.join("/").toLowerCase();
};

/** Agreement number is evidence, never authority to merge or ignore a conflicting address. */
export function automaticPost(store: Record<string, CustomerFolder>, hit: ImportHit, candidates: { id: string; score: number }[]): string {
  const eligible = candidates.filter((candidate) => {
    const folder = store[candidate.id];
    if (!folder) return false;
    const agreement = normalizeAvtal(folder.versions.at(-1)?.data);
    const nr = agreement.customer.avtalNr.trim().toLowerCase();
    if (hit.avtalNr && nr && nr !== hit.avtalNr.trim().toLowerCase()) return false;
    const address = normAddress(hit.adress);
    const addresses = facilitiesOf(agreement).map((facility) => normAddress(facility.address)).filter(Boolean);
    if (address && addresses.length && !addresses.includes(address)) return false;
    if (hit.kund && candidate.score === 100) {
      const name = normKund(hit.kund), registered = normKund(folder.name);
      if (name && registered && !name.includes(registered) && !registered.includes(name)) return false;
    }
    return candidate.score >= 60;
  });
  return eligible.length === 1 ? eligible[0]?.id ?? "" : "";
}

export function linkageIssues(hit: ImportHit, source: ImportHit | undefined, calculation: Kalkyl | null): string[] {
  if (!source || !calculation) return [];
  const issues: string[] = [];
  if (source.path !== hit.path) issues.push("Separat kalkylfil – dokumentkopplingen måste bekräftas");
  if (hit.avtalNr && source.avtalNr && hit.avtalNr.toLowerCase() !== source.avtalNr.toLowerCase()) issues.push("Olika avtalsnummer");
  const address = normAddress(hit.adress), calculationAddress = normAddress(calculation.adress || source.adress);
  if (address && calculationAddress && address !== calculationAddress) issues.push("Olika serviceadresser");
  if (source.kalkyler.length > 1 && !calculationAddress) issues.push("Kalkylens serviceadress saknas");
  return issues;
}

/** Sibling documents remain separate review rows, including scanned copies. */
export function sameNumberDocuments<T extends ImportHit>(items: T[]): T[] {
  return items.map((item) => {
    const nr = item.avtalNr.trim().toLowerCase();
    if (!nr || !items.some((other) => other.path !== item.path && other.avtalNr.trim().toLowerCase() === nr)) return item;
    return { ...item, kind: "granska", reason: `${item.reason}. Flera dokument har samma avtalsnummer – välj relation; ingen sammanslagning` };
  });
}

/** File modification time remains technical metadata, not the agreement date or legal priority. */
export function sourceDocument(hit: ImportHit, mod: number, documentType: LinkedDocument["documentType"], facilityId?: string, calculation?: Kalkyl | null): LinkedDocument {
  return {
    id: `${hit.path}|${documentType}|${facilityId ?? ""}|${calculation?.namn ?? ""}`,
    fileName: hit.file, filePath: hit.path, documentType, ...(facilityId ? { facilityId } : {}),
    ...(hit.datum ? { datum: hit.datum } : {}), perYear: calculation?.perYear ?? hit.perYear,
    objektCount: (calculation?.objekt ?? hit.objekt).reduce((sum, object) => sum + object.qty, 0),
    notes: [calculation && `Kalkyl: ${calculation.namn}`, mod && `Fil ändrad: ${new Date(mod).toISOString()}`, "Källhänvisning; originalfilen har inte laddats upp"].filter(Boolean).join(". "),
  };
}

export function attachImportSources(agreement: Avtal, facilityId: string, address: string, documents: LinkedDocument[]): boolean {
  const facilities = facilitiesOf(agreement);
  if (facilityId === "new") {
    if (!address.trim()) return false;
    facilityId = crypto.randomUUID();
    agreement.facilities = [...facilities, { id: facilityId, name: address.trim(), address: address.trim(), pricingType: "gemensam" }];
  } else if (!facilities.some((facility) => facility.id === facilityId)) return false;
  const existing = new Map((agreement.documents ?? []).map((document) => [document.id, document]));
  for (const document of documents) if (!existing.has(document.id)) existing.set(document.id, { ...document, facilityId: document.facilityId || facilityId });
  agreement.documents = [...existing.values()];
  return true;
}
type BundleItem = ImportHit & { mod: number; on: boolean; kalk: string; post: string; facility: string; related: string[]; cands: { score: number }[] };
const isSpec = (file: string) => /^spec[\s._-]/i.test(file);
const isExcel = (file: string) => /\.(xlsx|xls|xltx)$/i.test(file);

/**
 * One customer folder = one review card, but only as a proposal: when a folder holds exactly one
 * agreement PDF matched to an existing post, the newest single-table Excel calculation becomes its
 * calculation and the other files become source references. Nothing is merged between posts and
 * the user still confirms each card before saving.
 */
export function bundleFolders<T extends BundleItem>(items: T[]): T[] {
  const out = items.map((item) => ({ ...item }));
  const dirs = new Map<string, T[]>();
  for (const item of out) { const dir = customerDirectory(item.path); if (dir) dirs.set(dir, [...(dirs.get(dir) ?? []), item]); }
  for (const group of dirs.values()) {
    const mains = group.filter((x) => !isExcel(x.file) && !isSpec(x.file) && x.kind !== "ej" && x.post);
    if (mains.length !== 1) continue;
    const main = mains[0]!;
    if (group.some((x) => x !== main && !isExcel(x.file) && !isSpec(x.file) && x.post && x.post !== main.post)) continue;
    const calcs = group.filter((x) => isExcel(x.file) && x.kalkyler.length === 1 && (!x.post || x.post === main.post)).sort((a, b) => b.mod - a.mod);
    if (!main.kalkyler.length && calcs[0]) main.kalk = `${calcs[0].path}|0`;
    const sourcePath = main.kalk.slice(0, main.kalk.lastIndexOf("|"));
    for (const x of group) {
      if (x === main) continue;
      if (x.path !== sourcePath && !main.related.includes(x.path)) main.related = [...main.related, x.path];
      x.kind = "ej"; x.reason = `Ingår i mappens avtal: ${main.file}`; x.on = false;
    }
    const selected = calcs.find((c) => c.path === sourcePath)?.kalkyler[0];
    const unresolved = (selected?.evidence?.verification.unresolvedIssues ?? main.evidence?.verification.unresolvedIssues ?? []).length > 0;
    const sure = (main.cands[0]?.score ?? 0) >= 60 && !!main.facility && !unresolved && main.kalkyler.length <= 1;
    main.kind = sure ? "ok" : "granska";
    main.reason = sure ? `Mappens avtal${selected ? " + kalkyl" : ""} kopplade (${group.length} filer)` : `Mappens avtal – kontrollera koppling (${group.length} filer)`;
    main.on = sure;
  }
  return out;
}

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
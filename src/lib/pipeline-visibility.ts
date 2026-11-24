import type { CustomerFolder } from "./avtal-store";

export const SIGNED_PIPELINE_DAYS = 30;
const DAY = 86_400_000;

/** Display-only expiry: never change stored status, planning or agreements. */
export function visibleInPipeline(folder: CustomerFolder, now = Date.now()): boolean {
  const latest = folder.versions.at(-1);
  if (!latest) return false;
  if (latest.status !== "signerat") return true;

  const signingTimes = (folder.log ?? [])
    .filter((entry) => entry.kind === "signerat")
    .map((entry) => Date.parse(entry.at))
    .filter(Number.isFinite);
  let signedAt: number;
  if (signingTimes.length) {
    signedAt = Math.max(...signingTimes);
  } else {
    // Legacy records: use the first version in the current signed run,
    // not the latest edit or a customer note.
    let firstSigned = latest;
    for (let i = folder.versions.length - 2; i >= 0; i--) {
      const version = folder.versions[i];
      if (!version || version.status !== "signerat") break;
      firstSigned = version;
    }
    signedAt = Date.parse(firstSigned.savedAt);
  }
  // Missing/invalid historical dates should not silently hide an agreement.
  return !Number.isFinite(signedAt) || now - signedAt < SIGNED_PIPELINE_DAYS * DAY;
}
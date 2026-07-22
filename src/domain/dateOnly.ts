// Single store today (D4), located in Brazil (NFC-e issuer is a Boulevard Shopping
// store) — noon in that fixed offset avoids the UTC-midnight boundary bug where a
// "YYYY-MM-DD" string parsed as UTC midnight can land on the *previous* local day
// once converted through Date's local getters (used by salesXml/driveFileFinder.ts).
const STORE_UTC_OFFSET = "-03:00";

export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnly(dateOnly: string): Date {
  return new Date(`${dateOnly}T12:00:00${STORE_UTC_OFFSET}`);
}

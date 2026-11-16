/**
 * Invoice numbers follow the Mac app's scheme: `INV-YY-NNNN`, a two-digit year
 * then a zero-padded sequence that restarts each January and is scoped to one
 * workspace.
 */

const DEFAULT_PREFIX = "INV";

export function yearPart(date: Date): string {
  return String(date.getFullYear() % 100).padStart(2, "0");
}

export function formatInvoiceNumber(
  date: Date,
  sequence: number,
  prefix = DEFAULT_PREFIX
): string {
  return `${prefix}-${yearPart(date)}-${String(sequence).padStart(4, "0")}`;
}

/** Reads the sequence out of a number for the same year, or `null`. */
export function parseSequence(
  invoiceNumber: string,
  date: Date,
  prefix = DEFAULT_PREFIX
): number | null {
  const match = new RegExp(`^${prefix}-${yearPart(date)}-(\\d{4,})$`).exec(
    invoiceNumber.trim()
  );
  return match ? Number(match[1]) : null;
}

/**
 * Next sequence for `date`, given every invoice number already in the
 * workspace. Numbers from other years or other shapes are ignored.
 */
export function nextSequence(
  existingNumbers: string[],
  date: Date,
  prefix = DEFAULT_PREFIX
): number {
  let highest = 0;
  for (const number of existingNumbers) {
    const sequence = parseSequence(number, date, prefix);
    if (sequence !== null && sequence > highest) highest = sequence;
  }
  return highest + 1;
}

export function nextInvoiceNumber(
  existingNumbers: string[],
  date = new Date(),
  prefix = DEFAULT_PREFIX
): string {
  return formatInvoiceNumber(date, nextSequence(existingNumbers, date, prefix), prefix);
}

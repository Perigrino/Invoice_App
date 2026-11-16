/**
 * Workspace recovery keys. The cookie identifies a browser; this key is how a
 * person gets back to their data from another browser, or after clearing site
 * data.
 *
 * Crockford-style base32: no I, L, O or U, so a key read aloud or copied off a
 * screen stays unambiguous. Twenty characters is 100 bits — far beyond guessing
 * range even with generous rate limits on the adopt endpoint.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const KEY_LENGTH = 20;
const GROUP = 4;

export function generateRecoveryKey(): string {
  const bytes = new Uint8Array(KEY_LENGTH);
  crypto.getRandomValues(bytes);
  let key = "";
  for (const byte of bytes) key += ALPHABET[byte % ALPHABET.length];
  return formatRecoveryKey(key);
}

/** "k7qm 3xpd-9tzr" → "K7QM3XPD9TZR" (also maps I/L→1 and O→0). */
export function normalizeRecoveryKey(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/I|L/g, "1")
    .replace(/O/g, "0");
}

export function isRecoveryKey(input: string): boolean {
  const normalized = normalizeRecoveryKey(input);
  if (normalized.length !== KEY_LENGTH) return false;
  return [...normalized].every((char) => ALPHABET.includes(char));
}

/** K7QM3XPD9TZR4HWV8NB2 → K7QM-3XPD-9TZR-4HWV-8NB2 */
export function formatRecoveryKey(input: string): string {
  const normalized = normalizeRecoveryKey(input);
  return normalized.match(new RegExp(`.{1,${GROUP}}`, "g"))?.join("-") ?? normalized;
}

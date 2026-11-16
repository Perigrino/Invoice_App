/**
 * Workspace recovery keys. The cookie identifies a browser; this key is how a
 * person gets back to their data from another browser, or after clearing site
 * data.
 *
 * Crockford-style base32: no I, L, O or U, so a key read aloud or copied off a
 * screen stays unambiguous. Twenty characters is 100 bits — far beyond guessing
 * range even with the rate limit on the adopt endpoint.
 *
 * Keys are stored and compared bare (`K7QM3XPD...`). The dashes are a display
 * affordance only, so nothing downstream has to strip them.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const KEY_LENGTH = 20;
const GROUP = 4;

/** A new bare key. */
export function generateRecoveryKey(): string {
  const bytes = new Uint8Array(KEY_LENGTH);
  crypto.getRandomValues(bytes);
  let key = "";
  for (const byte of bytes) key += ALPHABET[byte % ALPHABET.length];
  return key;
}

/**
 * The canonical form of anything a person might type or paste — lower case,
 * spaces, dashes, and the I/L/O misreads — or `null` when it cannot be a key.
 */
export function parseRecoveryKey(input: string): string | null {
  const normalized = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/I|L/g, "1")
    .replace(/O/g, "0");

  if (normalized.length !== KEY_LENGTH) return null;
  for (const char of normalized) {
    if (!ALPHABET.includes(char)) return null;
  }
  return normalized;
}

/** K7QM3XPD9TZR4HWV8NB2 → K7QM-3XPD-9TZR-4HWV-8NB2 */
export function formatRecoveryKey(input: string): string {
  const key = parseRecoveryKey(input) ?? input;
  return key.match(new RegExp(`.{1,${GROUP}}`, "g"))?.join("-") ?? key;
}

/**
 * Share links are bearer tokens in a URL, so they need to be long enough that
 * guessing is hopeless even though the endpoint is rate limited. 32 characters
 * of the same unambiguous alphabet the recovery key uses is 160 bits.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TOKEN_LENGTH = 32;

export function generateShareToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  let token = "";
  for (const byte of bytes) token += ALPHABET[byte % ALPHABET.length];
  return token;
}

export function isShareToken(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== TOKEN_LENGTH) return false;
  return [...value].every((char) => ALPHABET.includes(char));
}

/** The absolute URL for a token, given the request's origin. */
export function shareUrl(origin: string, token: string): string {
  return `${origin}/s/${token}`;
}

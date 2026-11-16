/**
 * State-changing requests must come from the app's own origin. Kept free of
 * `server-only`/Prisma so it can be unit tested directly.
 */
export interface MutationHeaders {
  origin?: string | null;
  host?: string | null;
  secFetchSite?: string | null;
}

/**
 * Browsers always send `Origin` on cross-site mutations. A request without one
 * is a non-browser client (curl, a test, a server), which carries no ambient
 * cookie and so cannot be CSRF'd; a request with one must match the host.
 */
export function isSameOriginMutation(headers: MutationHeaders): boolean {
  const { origin, host, secFetchSite } = headers;

  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return false;
  }

  return true;
}

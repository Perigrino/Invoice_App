/**
 * The anonymous workspace cookie, shared by the proxy (which issues it) and
 * server code (which reads it). Kept free of Prisma and `server-only` imports
 * because the proxy runs before the app and cannot use either.
 */

export const WORKSPACE_COOKIE = "invoiceflow_ws";

/** One year, in seconds. */
export const WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ids are the only thing separating one visitor's data from another's, so a
 * malformed value is treated as no value at all rather than turned into a
 * workspace.
 */
export function isWorkspaceId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function newWorkspaceId(): string {
  return crypto.randomUUID();
}

/**
 * Writes to one row can be in flight at the same time — an auto-save, then a
 * manual save, then another auto-save — and their responses can come back in
 * any order. Only the most recent write is allowed to describe the row's
 * state, so the others must not reconcile it or mark it failed.
 */

const latest = new Map<string, number>();

/** Call immediately before starting a write for `key`. */
export function beginWrite(key: string): number {
  const token = (latest.get(key) ?? 0) + 1;
  latest.set(key, token);
  return token;
}

/** True when nothing newer has started for `key` since `token` was issued. */
export function isLatestWrite(key: string, token: number): boolean {
  return latest.get(key) === token;
}

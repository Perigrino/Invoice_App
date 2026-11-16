/**
 * The recovery key is shown once, right after the first saved invoice, and
 * must be acknowledged or copied. This flag is what carries "a save just
 * happened" across the navigation from the form to the invoice list, so it
 * lives in localStorage rather than React state. Every access is guarded:
 * storage can be unavailable (private mode, disabled cookies).
 */

const PENDING = "invoiceflow_recovery_pending";

/** Fired when a save marks the notice pending, for a gate already mounted. */
export const RECOVERY_PENDING_EVENT = "invoiceflow:recovery-pending";

export function recoverySeenKey(recoveryKey: string): string {
  return `invoiceflow_recovery_seen:${recoveryKey}`;
}

export function isRecoveryPending(): boolean {
  try {
    return window.localStorage.getItem(PENDING) !== null;
  } catch {
    return false;
  }
}

export function markRecoveryPending(): void {
  try {
    window.localStorage.setItem(PENDING, String(Date.now()));
  } catch {
    // Without storage the notice simply cannot be shown.
    return;
  }
  window.dispatchEvent(new Event(RECOVERY_PENDING_EVENT));
}

export function clearRecoveryPending(): void {
  try {
    window.localStorage.removeItem(PENDING);
  } catch {
    // Ignored.
  }
}

export function isRecoverySeen(recoveryKey: string): boolean {
  try {
    return window.localStorage.getItem(recoverySeenKey(recoveryKey)) === "1";
  } catch {
    return true;
  }
}

export function markRecoverySeen(recoveryKey: string): void {
  try {
    window.localStorage.setItem(recoverySeenKey(recoveryKey), "1");
  } catch {
    // Ignored: the key is still on screen and in Settings.
  }
  clearRecoveryPending();
}

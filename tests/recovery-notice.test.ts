import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RECOVERY_PENDING_EVENT,
  clearRecoveryPending,
  isRecoveryPending,
  isRecoverySeen,
  markRecoveryPending,
  markRecoverySeen,
} from "@/lib/recovery-notice";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

beforeEach(() => {
  const listeners = new Set<() => void>();
  vi.stubGlobal("window", {
    localStorage: fakeStorage(),
    dispatchEvent: (event: Event) => {
      listeners.forEach((listener) => listener());
      return true;
    },
    addEventListener: (_: string, listener: () => void) => void listeners.add(listener),
  } as unknown as Window & typeof globalThis);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("recovery notice", () => {
  it("is not pending until a save marks it", () => {
    expect(isRecoveryPending()).toBe(false);
    markRecoveryPending();
    expect(isRecoveryPending()).toBe(true);
  });

  it("announces the pending flag so a mounted gate reacts", () => {
    const handler = vi.fn();
    window.addEventListener(RECOVERY_PENDING_EVENT, handler);
    markRecoveryPending();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("treats acknowledgement as per workspace and clears the pending flag", () => {
    markRecoveryPending();
    expect(isRecoverySeen("AAAA-BBBB")).toBe(false);
    markRecoverySeen("AAAA-BBBB");
    expect(isRecoverySeen("AAAA-BBBB")).toBe(true);
    expect(isRecoverySeen("CCCC-DDDD")).toBe(false);
    expect(isRecoveryPending()).toBe(false);
  });

  it("clears the flag without acknowledging", () => {
    markRecoveryPending();
    clearRecoveryPending();
    expect(isRecoveryPending()).toBe(false);
  });

  it("never throws when storage is unavailable", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
        removeItem: () => {
          throw new Error("denied");
        },
      },
      dispatchEvent: () => true,
    } as unknown as Window & typeof globalThis);
    expect(isRecoveryPending()).toBe(false);
    // Unreadable storage counts as "already seen": better to stay quiet than
    // to show a modal on every save that can never be acknowledged.
    expect(isRecoverySeen("AAAA")).toBe(true);
    expect(() => markRecoveryPending()).not.toThrow();
    expect(() => markRecoverySeen("AAAA")).not.toThrow();
  });
});

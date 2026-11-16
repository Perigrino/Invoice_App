import { describe, expect, it } from "vitest";
import { formatRecoveryKey, generateRecoveryKey, parseRecoveryKey } from "@/lib/recovery";

describe("generateRecoveryKey", () => {
  it("produces a bare, unambiguous twenty-character key", () => {
    expect(generateRecoveryKey()).toMatch(/^[0-9A-HJKMNP-TV-Z]{20}$/);
  });

  it("is accepted back by the parser", () => {
    for (let i = 0; i < 50; i += 1) expect(parseRecoveryKey(generateRecoveryKey())).not.toBeNull();
  });

  it("does not repeat", () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateRecoveryKey()));
    expect(keys.size).toBe(200);
  });
});

describe("parseRecoveryKey", () => {
  it("canonicalises case, spaces and dashes", () => {
    expect(parseRecoveryKey("k7qm 3xpd-9tzr-4hwv-8nb2")).toBe("K7QM3XPD9TZR4HWV8NB2");
  });

  it("maps the characters people misread inside a full key", () => {
    // I and L read as 1, O as 0 — the letters the alphabet deliberately omits.
    expect(parseRecoveryKey("K7QM3XPD9TZR4HWV8NBO")).toBe("K7QM3XPD9TZR4HWV8NB0");
    expect(parseRecoveryKey("K7QM3XPD9TZR4HWV8NB I".replace(" ", ""))).toBe("K7QM3XPD9TZR4HWV8NB1");
  });

  it("survives a round trip through the displayed form", () => {
    const key = generateRecoveryKey();
    expect(parseRecoveryKey(formatRecoveryKey(key))).toBe(key);
  });

  it("rejects wrong lengths and characters outside the alphabet", () => {
    expect(parseRecoveryKey("")).toBeNull();
    expect(parseRecoveryKey("K7QM-3XPD")).toBeNull();
    expect(parseRecoveryKey("K7QM3XPD9TZR4HWV8NB2X")).toBeNull();
    expect(parseRecoveryKey("K7QM3XPD9TZR4HWV8NBU")).toBeNull();
  });
});

describe("formatRecoveryKey", () => {
  it("groups a bare key for display", () => {
    expect(formatRecoveryKey("K7QM3XPD9TZR4HWV8NB2")).toBe("K7QM-3XPD-9TZR-4HWV-8NB2");
  });

  it("is idempotent on an already grouped key", () => {
    expect(formatRecoveryKey("K7QM-3XPD-9TZR-4HWV-8NB2")).toBe("K7QM-3XPD-9TZR-4HWV-8NB2");
  });
});

import { describe, expect, it } from "vitest";
import {
  formatRecoveryKey,
  generateRecoveryKey,
  isRecoveryKey,
  normalizeRecoveryKey,
} from "@/lib/recovery";

describe("generateRecoveryKey", () => {
  it("produces five groups of four characters", () => {
    const key = generateRecoveryKey();
    expect(key).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){4}$/);
  });

  it("is accepted by the validator", () => {
    for (let i = 0; i < 50; i += 1) expect(isRecoveryKey(generateRecoveryKey())).toBe(true);
  });

  it("does not repeat", () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateRecoveryKey()));
    expect(keys.size).toBe(200);
  });
});

describe("normalizeRecoveryKey", () => {
  it("accepts lower case, spaces and dashes", () => {
    expect(normalizeRecoveryKey("k7qm 3xpd-9tzr-4hwv-8nb2")).toBe("K7QM3XPD9TZR4HWV8NB2");
  });

  it("maps characters people misread", () => {
    expect(normalizeRecoveryKey("IL0")).toBe("110");
  });
});

describe("isRecoveryKey", () => {
  it("rejects wrong lengths", () => {
    expect(isRecoveryKey("")).toBe(false);
    expect(isRecoveryKey("K7QM-3XPD")).toBe(false);
    expect(isRecoveryKey("K7QM3XPD9TZR4HWV8NB2X")).toBe(false);
  });

  it("rejects characters outside the alphabet", () => {
    expect(isRecoveryKey("K7QM3XPD9TZR4HWV8NBU")).toBe(false);
  });
});

describe("formatRecoveryKey", () => {
  it("regroups a bare key", () => {
    expect(formatRecoveryKey("K7QM3XPD9TZR4HWV8NB2")).toBe("K7QM-3XPD-9TZR-4HWV-8NB2");
  });

  it("round-trips a generated key", () => {
    const key = generateRecoveryKey();
    expect(formatRecoveryKey(normalizeRecoveryKey(key))).toBe(key);
  });
});

import { describe, expect, it } from "vitest";
import { generateShareToken, isShareToken, shareUrl } from "@/lib/share";

describe("generateShareToken", () => {
  it("is 32 characters of the unambiguous alphabet", () => {
    expect(generateShareToken()).toMatch(/^[0-9A-HJKMNP-TV-Z]{32}$/);
  });

  it("does not repeat", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateShareToken()));
    expect(tokens.size).toBe(500);
  });
});

describe("isShareToken", () => {
  it("accepts a token it generated", () => {
    expect(isShareToken(generateShareToken())).toBe(true);
  });

  it("rejects short, long and out-of-alphabet values", () => {
    expect(isShareToken("")).toBe(false);
    expect(isShareToken("ABC")).toBe(false);
    expect(isShareToken(`${generateShareToken()}A`)).toBe(false);
    expect(isShareToken("A".repeat(31) + "U")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isShareToken(null)).toBe(false);
    expect(isShareToken(42)).toBe(false);
  });
});

describe("shareUrl", () => {
  it("points at /s/<token>", () => {
    const token = generateShareToken();
    expect(shareUrl("https://example.com", token)).toBe(`https://example.com/s/${token}`);
  });
});

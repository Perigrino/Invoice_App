import { describe, expect, it } from "vitest";
import { normalizeTemplate } from "@/lib/templates/presets";

describe("normalizeTemplate", () => {
  it("keeps the two live templates", () => {
    expect(normalizeTemplate("dark")).toBe("dark");
    expect(normalizeTemplate("light")).toBe("light");
  });

  it("moves the five retired designs to light", () => {
    for (const legacy of ["modern", "business", "minimal", "professional", "elegant"]) {
      expect(normalizeTemplate(legacy)).toBe("light");
    }
  });

  it("falls back to light for anything else", () => {
    expect(normalizeTemplate(undefined)).toBe("light");
    expect(normalizeTemplate("")).toBe("light");
    expect(normalizeTemplate("whatever")).toBe("light");
  });
});

import { describe, expect, it } from "vitest";
import { isSameOriginMutation } from "@/lib/same-origin";

describe("isSameOriginMutation", () => {
  it("allows a same-origin browser mutation", () => {
    expect(
      isSameOriginMutation({
        origin: "https://invoiceflow.app",
        host: "invoiceflow.app",
        secFetchSite: "same-origin",
      })
    ).toBe(true);
  });

  it("allows a same-host mutation on another scheme or port", () => {
    expect(isSameOriginMutation({ origin: "http://localhost:3000", host: "localhost:3000" })).toBe(
      true
    );
  });

  it("rejects another origin", () => {
    expect(
      isSameOriginMutation({
        origin: "https://evil.example",
        host: "invoiceflow.app",
        secFetchSite: "cross-site",
      })
    ).toBe(false);
  });

  it("rejects a subdomain that is not the host", () => {
    expect(isSameOriginMutation({ origin: "https://a.invoiceflow.app", host: "invoiceflow.app" })).toBe(
      false
    );
  });

  it("rejects an unparsable origin", () => {
    expect(isSameOriginMutation({ origin: "not a url", host: "invoiceflow.app" })).toBe(false);
  });

  it("rejects a cross-site request that carries no Origin", () => {
    expect(isSameOriginMutation({ origin: null, host: "invoiceflow.app", secFetchSite: "cross-site" })).toBe(
      false
    );
  });

  it("rejects same-site siblings that are not same-origin", () => {
    expect(
      isSameOriginMutation({ origin: null, host: "invoiceflow.app", secFetchSite: "same-site" })
    ).toBe(false);
  });

  it("allows non-browser clients, which send no Origin and no fetch metadata", () => {
    expect(isSameOriginMutation({ origin: null, host: "localhost:3000" })).toBe(true);
  });
});

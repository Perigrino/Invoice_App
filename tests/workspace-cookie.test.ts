import { describe, expect, it } from "vitest";
import {
  WORKSPACE_COOKIE,
  isWorkspaceId,
  newWorkspaceId,
} from "@/lib/workspace-cookie";

describe("isWorkspaceId", () => {
  it("accepts generated ids", () => {
    expect(isWorkspaceId(newWorkspaceId())).toBe(true);
  });

  it("accepts any well-formed uuid, upper or lower case", () => {
    expect(isWorkspaceId("23277807-3778-4b86-ae85-0f14d1593f9b")).toBe(true);
    expect(isWorkspaceId("23277807-3778-4B86-AE85-0F14D1593F9B")).toBe(true);
  });

  it("rejects anything that is not a uuid", () => {
    for (const value of [
      "",
      "abc",
      "invoiceflow",
      "23277807-3778-4b86-ae85",
      "23277807-3778-4b86-ae85-0f14d1593f9b-extra",
      "'; drop table invoice; --",
      null,
      undefined,
      42,
    ]) {
      expect(isWorkspaceId(value)).toBe(false);
    }
  });
});

describe("cookie name", () => {
  it("stays stable, because every stored row is filed under it", () => {
    expect(WORKSPACE_COOKIE).toBe("invoiceflow_ws");
  });
});

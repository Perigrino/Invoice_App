import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, describeWriteError } from "@/lib/api";
import { notifyWriteFailure, useToastStore } from "@/store/toast-store";

describe("describeWriteError", () => {
  it("explains the status in words a user can act on", () => {
    expect(describeWriteError(new ApiError(403))).toContain("blocked");
    expect(describeWriteError(new ApiError(404))).toContain("no longer exists");
    expect(describeWriteError(new ApiError(413))).toContain("too large");
    expect(describeWriteError(new ApiError(429))).toContain("Too many changes");
    expect(describeWriteError(new ApiError(500))).toContain("Nothing was changed");
  });

  it("treats anything else as a connection problem", () => {
    expect(describeWriteError(new TypeError("Failed to fetch"))).toContain(
      "Could not reach the server"
    );
    expect(describeWriteError(undefined)).toContain("nothing was saved");
  });
});

describe("write failure notices", () => {
  beforeEach(() => {
    useToastStore.setState({ notices: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("names the action and the reason", () => {
    notifyWriteFailure("This invoice was not saved.", new ApiError(500));
    const [notice] = useToastStore.getState().notices;
    expect(notice.kind).toBe("error");
    expect(notice.message).toBe(
      "This invoice was not saved. The server could not save that. Nothing was changed."
    );
  });

  it("does not repeat the same failure, as auto-save would", () => {
    notifyWriteFailure("Your settings were not saved.", new TypeError("offline"));
    notifyWriteFailure("Your settings were not saved.", new TypeError("offline"));
    expect(useToastStore.getState().notices).toHaveLength(1);
  });

  it("keeps at most three notices and can dismiss one", () => {
    notifyWriteFailure("a", new ApiError(500));
    notifyWriteFailure("b", new ApiError(500));
    notifyWriteFailure("c", new ApiError(500));
    notifyWriteFailure("d", new ApiError(500));
    const notices = useToastStore.getState().notices;
    expect(notices).toHaveLength(3);
    expect(notices[0].message.startsWith("b")).toBe(true);

    useToastStore.getState().dismiss(notices[0].id);
    expect(useToastStore.getState().notices).toHaveLength(2);
  });

  it("clears errors on its own", () => {
    notifyWriteFailure("a", new ApiError(500));
    expect(useToastStore.getState().notices).toHaveLength(1);
    vi.advanceTimersByTime(10_000);
    expect(useToastStore.getState().notices).toHaveLength(0);
  });
});

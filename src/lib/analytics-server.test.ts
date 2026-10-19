import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@vercel/analytics/server", () => ({ track: mocks.track }));

import { trackServerEvent } from "./analytics-server";

describe("trackServerEvent", () => {
  it("forwards the user agent and client IP but never the cookie header", async () => {
    mocks.track.mockResolvedValue(undefined);
    const headers = new Headers({
      "user-agent": "Mozilla/5.0",
      "x-forwarded-for": "203.0.113.10",
      cookie: "sb-access-token=admin-session",
    });

    await trackServerEvent("booking_created", { lesson_type: "beginner", court_setup: "outdoor" }, headers);

    expect(mocks.track).toHaveBeenCalledWith(
      "booking_created",
      { lesson_type: "beginner", court_setup: "outdoor" },
      { headers: { "user-agent": "Mozilla/5.0", "x-forwarded-for": "203.0.113.10" } }
    );
    expect(JSON.stringify(mocks.track.mock.calls[0])).not.toContain("admin-session");
  });

  it("never throws, so analytics cannot break a booking", async () => {
    mocks.track.mockRejectedValue(new Error("analytics down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      trackServerEvent("booking_created", { lesson_type: "clinic", court_setup: "help" }, new Headers())
    ).resolves.toBeUndefined();
    consoleError.mockRestore();
  });
});

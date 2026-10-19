import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@vercel/analytics/server", () => ({ track: mocks.track }));

import { trackServerEvent } from "./analytics-server";

describe("trackServerEvent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("posts to the custom domain in production, past the login wall on *.vercel.app", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_WEB_ANALYTICS_ENDPOINT", undefined);
    // track() reads the endpoint when it is called, so record it from inside.
    // (An expect() in here would be swallowed: trackServerEvent never throws.)
    let endpointSeen: string | undefined;
    mocks.track.mockImplementationOnce(async () => {
      endpointSeen = process.env.VERCEL_WEB_ANALYTICS_ENDPOINT;
    });

    await trackServerEvent("booking_created", { lesson_type: "beginner", court_setup: "outdoor" }, new Headers());

    expect(endpointSeen).toBe("https://demariomontezpb.com/_vercel/insights/event");
  });

  it("keeps an explicitly configured endpoint", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_WEB_ANALYTICS_ENDPOINT", "https://example.com/custom");
    mocks.track.mockResolvedValue(undefined);

    await trackServerEvent("booking_created", { lesson_type: "beginner", court_setup: "outdoor" }, new Headers());

    expect(process.env.VERCEL_WEB_ANALYTICS_ENDPOINT).toBe("https://example.com/custom");
  });

  it("leaves previews on the library default", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_WEB_ANALYTICS_ENDPOINT", undefined);
    mocks.track.mockResolvedValue(undefined);

    await trackServerEvent("booking_created", { lesson_type: "beginner", court_setup: "outdoor" }, new Headers());

    expect(process.env.VERCEL_WEB_ANALYTICS_ENDPOINT).toBeUndefined();
  });

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

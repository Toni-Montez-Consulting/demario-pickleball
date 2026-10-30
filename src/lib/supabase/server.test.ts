import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authClient: {
    auth: {
      getUser: vi.fn(),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(),
      },
    },
  },
  serviceClient: {
    from: vi.fn(),
  },
  cookieStore: {
    getAll: vi.fn(() => []),
    set: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mocks.cookieStore),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => mocks.authClient),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mocks.serviceClient),
}));

// redirect() ends rendering by throwing; the message carries the target.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

describe("admin auth helpers", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAIL = "coach@example.com, demariomontez10@gmail.com";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    mocks.authClient.auth.getUser.mockReset();
    mocks.authClient.auth.mfa.getAuthenticatorAssuranceLevel.mockReset();
    mocks.cookieStore.getAll.mockClear();
    mocks.cookieStore.set.mockClear();
  });

  it("allows comma-separated admin emails", async () => {
    const { isAdminEmail } = await import("./server");

    expect(isAdminEmail("demariomontez10@gmail.com")).toBe(true);
    expect(isAdminEmail("COACH@example.com")).toBe(true);
    expect(isAdminEmail("student@example.com")).toBe(false);
  });

  it("denies allowed admin emails without aal2 MFA", async () => {
    const { requireAdmin } = await import("./server");
    mocks.authClient.auth.getUser.mockResolvedValue({
      data: { user: { email: "coach@example.com" } },
    });
    mocks.authClient.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1" },
      error: null,
    });

    const result = await requireAdmin();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected admin auth to fail");
    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({ error: "MFA required" });
  });

  it("allows admin emails with aal2 MFA", async () => {
    const { requireAdmin } = await import("./server");
    const user = { email: "coach@example.com" };
    mocks.authClient.auth.getUser.mockResolvedValue({ data: { user } });
    mocks.authClient.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal2" },
      error: null,
    });

    const result = await requireAdmin();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected admin auth to pass");
    expect(result.user).toBe(user);
    expect(result.auth).toBe(mocks.authClient);
    expect(result.supabase).toBe(mocks.serviceClient);
  });
});

describe("requireAdminPage", () => {
  beforeEach(async () => {
    process.env.ADMIN_EMAIL = "coach@example.com";
    mocks.authClient.auth.getUser.mockReset();
    mocks.authClient.auth.mfa.getAuthenticatorAssuranceLevel.mockReset();
    const { createClient } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockClear();
  });

  async function serviceClientsMade() {
    const { createClient } = await import("@supabase/supabase-js");
    return vi.mocked(createClient).mock.calls.length;
  }

  it("sends a visitor with no session to login, before any data client exists", async () => {
    const { requireAdminPage } = await import("./server");
    mocks.authClient.auth.getUser.mockResolvedValue({ data: { user: null } });

    await expect(requireAdminPage()).rejects.toThrow("NEXT_REDIRECT /admin/login");
    expect(await serviceClientsMade()).toBe(0);
  });

  it("sends a signed-in non-admin to login", async () => {
    const { requireAdminPage } = await import("./server");
    mocks.authClient.auth.getUser.mockResolvedValue({ data: { user: { email: "student@example.com" } } });

    await expect(requireAdminPage()).rejects.toThrow("NEXT_REDIRECT /admin/login");
    expect(await serviceClientsMade()).toBe(0);
  });

  it("sends an admin with no MFA set up to MFA setup, and one mid-login back to login", async () => {
    const { requireAdminPage } = await import("./server");
    mocks.authClient.auth.getUser.mockResolvedValue({ data: { user: { email: "coach@example.com" } } });

    mocks.authClient.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1" },
      error: null,
    });
    await expect(requireAdminPage()).rejects.toThrow("NEXT_REDIRECT /admin/mfa-setup");

    mocks.authClient.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });
    await expect(requireAdminPage()).rejects.toThrow("NEXT_REDIRECT /admin/login");

    mocks.authClient.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: null,
      error: { message: "unavailable" },
    });
    await expect(requireAdminPage()).rejects.toThrow("NEXT_REDIRECT /admin/login");
    expect(await serviceClientsMade()).toBe(0);
  });

  it("returns the user and the data client for an admin with MFA", async () => {
    const { requireAdminPage } = await import("./server");
    const user = { email: "coach@example.com" };
    mocks.authClient.auth.getUser.mockResolvedValue({ data: { user } });
    mocks.authClient.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" },
      error: null,
    });

    const result = await requireAdminPage();

    expect(result.user).toBe(user);
    expect(result.supabase).toBe(mocks.serviceClient);
  });
});

// Supabase is retiring the legacy keys by the end of 2026; the new ones win.
describe("supabaseServerKey", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers the new secret key, and falls back to the legacy service_role key", async () => {
    const { supabaseServerKey } = await import("./server");
    vi.stubEnv("SUPABASE_SECRET_KEY", "fake-new-server-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fake-legacy-server-key");
    expect(supabaseServerKey()).toBe("fake-new-server-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect(supabaseServerKey()).toBe("fake-legacy-server-key");
  });

  it("names both settings when neither is set", async () => {
    const { supabaseServerKey } = await import("./server");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => supabaseServerKey()).toThrow(/SUPABASE_SECRET_KEY.*SUPABASE_SERVICE_ROLE_KEY/);
  });
});

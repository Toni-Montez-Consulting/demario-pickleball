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

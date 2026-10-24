import { afterEach, describe, expect, it, vi } from "vitest";
import { supabaseBrowserKey } from "./keys";

// Supabase is retiring the legacy keys by the end of 2026; the new ones win.
describe("supabaseBrowserKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers the publishable key, and falls back to the legacy anon key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "fake-publishable-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fake-legacy-anon-key");
    expect(supabaseBrowserKey()).toBe("fake-publishable-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(supabaseBrowserKey()).toBe("fake-legacy-anon-key");
  });

  it("names both settings when neither is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(() => supabaseBrowserKey()).toThrow(
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.*NEXT_PUBLIC_SUPABASE_ANON_KEY/
    );
  });
});

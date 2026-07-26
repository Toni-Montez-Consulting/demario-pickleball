import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone, normalizeEmail, findOrCreateStudent } from "./students";

describe("normalizePhone", () => {
  it("strips formatting from a 10-digit US number", () => {
    expect(normalizePhone("(469) 371-9220")).toBe("4693719220");
  });
  it("drops a leading country code 1", () => {
    expect(normalizePhone("+1 469-371-9220")).toBe("4693719220");
  });
  it("returns null for an unusable number", () => {
    expect(normalizePhone("555")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("not a phone")).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Rachel.K@Example.COM ")).toBe("rachel.k@example.com");
  });
  it("returns null for a non-email", () => {
    expect(normalizeEmail("nope")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

// Minimal fake matching the query chain findOrCreateStudent uses.
function fakeSupabase(existing: Record<string, unknown> | null) {
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const client = {
    from() {
      return {
        select() {
          return {
            or() {
              return {
                limit: async () => ({ data: existing ? [existing] : [], error: null }),
              };
            },
          };
        },
        insert(row: Record<string, unknown>) {
          inserted.push(row);
          return {
            select: () => ({
              single: async () => ({ data: { id: "new-id", ...row }, error: null }),
            }),
          };
        },
        update(row: Record<string, unknown>) {
          updated.push(row);
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, inserted, updated };
}

describe("findOrCreateStudent", () => {
  it("creates a student when none matches", async () => {
    const { client, inserted } = fakeSupabase(null);
    const result = await findOrCreateStudent(client, {
      name: "Rachel K",
      email: "rachel@example.com",
      phone: "(469) 371-9220",
    });
    expect(result?.created).toBe(true);
    expect(result?.needsReview).toBe(false);
    expect(inserted[0]).toMatchObject({
      phone_normalized: "4693719220",
      email_normalized: "rachel@example.com",
      source: "site",
    });
  });

  it("matches an existing student on phone and does not flag when details agree", async () => {
    const { client, inserted } = fakeSupabase({
      id: "s1",
      name: "Rachel K",
      phone_normalized: "4693719220",
      email_normalized: "rachel@example.com",
    });
    const result = await findOrCreateStudent(client, {
      name: "Rachel K",
      email: "rachel@example.com",
      phone: "469-371-9220",
    });
    expect(result?.created).toBe(false);
    expect(result?.needsReview).toBe(false);
    expect(inserted).toHaveLength(0);
  });

  it("flags needs_review when a phone match carries a different name", async () => {
    const { client, updated } = fakeSupabase({
      id: "s1",
      name: "Rachel K",
      phone_normalized: "4693719220",
      email_normalized: "rachel@example.com",
    });
    const result = await findOrCreateStudent(client, {
      name: "Someone Else",
      email: "rachel@example.com",
      phone: "4693719220",
    });
    expect(result?.created).toBe(false);
    expect(result?.needsReview).toBe(true);
    expect(result?.needsReviewReason).toContain("name");
    expect(updated[0]).toMatchObject({ needs_review: true });
  });

  it("flags needs_review when a phone match carries a different email", async () => {
    const { client } = fakeSupabase({
      id: "s1",
      name: "Rachel K",
      phone_normalized: "4693719220",
      email_normalized: "rachel@example.com",
    });
    const result = await findOrCreateStudent(client, {
      name: "Rachel K",
      email: "different@example.com",
      phone: "4693719220",
    });
    expect(result?.needsReview).toBe(true);
    expect(result?.needsReviewReason).toContain("email");
  });

  it("is case and whitespace insensitive on the name comparison", async () => {
    const { client } = fakeSupabase({
      id: "s1",
      name: "Rachel K",
      phone_normalized: "4693719220",
      email_normalized: "rachel@example.com",
    });
    const result = await findOrCreateStudent(client, {
      name: "  rachel k  ",
      email: "rachel@example.com",
      phone: "4693719220",
    });
    expect(result?.needsReview).toBe(false);
  });

  it("returns null when there is no usable phone or email", async () => {
    const { client } = fakeSupabase(null);
    const result = await findOrCreateStudent(client, {
      name: "Nobody",
      email: "nope",
      phone: "555",
    });
    expect(result).toBeNull();
  });
});

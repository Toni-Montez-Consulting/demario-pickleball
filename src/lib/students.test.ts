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

  // These become raw values in a database filter. PostgREST treats comma, dot,
  // and parens as syntax, so they must never survive normalization.
  it("rejects PostgREST filter delimiters in the local part", () => {
    expect(normalizeEmail("a,name.neq.zz@x.com")).toBeNull();
    expect(normalizeEmail("a(b)@x.com")).toBeNull();
    expect(normalizeEmail('a"b@x.com')).toBeNull();
    expect(normalizeEmail("a,b@x.com")).toBeNull();
  });
  it("still accepts ordinary real-world addresses", () => {
    expect(normalizeEmail("first.last+tag@sub.example.co.uk")).toBe(
      "first.last+tag@sub.example.co.uk"
    );
    expect(normalizeEmail("o'brien@example.com")).toBe("o'brien@example.com");
  });
});

/**
 * Fake matching the query shape findOrCreateStudent now uses: two separate
 * .eq(...).limit(n) lookups rather than one interpolated .or() string.
 */
function fakeSupabase(rows: Record<string, unknown>[]) {
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const eqCalls: { column: string; value: unknown }[] = [];

  const client = {
    from() {
      return {
        select() {
          return {
            eq(column: string, value: unknown) {
              eqCalls.push({ column, value });
              return {
                limit: async () => ({
                  data: rows.filter((r) => r[column] === value),
                  error: null,
                }),
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

  return { client, inserted, updated, eqCalls };
}

const RACHEL = {
  id: "s1",
  name: "Rachel K",
  phone_normalized: "4693719220",
  email_normalized: "rachel@example.com",
};

describe("findOrCreateStudent", () => {
  it("creates a student when none matches", async () => {
    const { client, inserted } = fakeSupabase([]);
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

  it("matches on phone and does not flag when details agree", async () => {
    const { client, inserted } = fakeSupabase([RACHEL]);
    const result = await findOrCreateStudent(client, {
      name: "Rachel K",
      email: "rachel@example.com",
      phone: "469-371-9220",
    });
    expect(result?.created).toBe(false);
    expect(result?.needsReview).toBe(false);
    expect(inserted).toHaveLength(0);
  });

  // The injection this replaced: a comma in the email used to append an extra
  // PostgREST condition that matched every row.
  it("passes candidate keys as encoded eq values, never as a filter string", async () => {
    const { client, eqCalls } = fakeSupabase([]);
    await findOrCreateStudent(client, {
      name: "A",
      email: "someone@example.com",
      phone: "2145550000",
    });
    expect(eqCalls).toEqual([
      { column: "phone_normalized", value: "2145550000" },
      { column: "email_normalized", value: "someone@example.com" },
    ]);
    for (const call of eqCalls) {
      expect(String(call.value)).not.toContain(",");
      expect(String(call.value)).not.toContain(".eq.");
    }
  });

  it("cannot be steered onto another student by a crafted email", async () => {
    const victim = { ...RACHEL, id: "victim" };
    const { client, inserted } = fakeSupabase([victim]);
    const result = await findOrCreateStudent(client, {
      name: "Attacker",
      email: "a,name.neq.zz@x.com",
      phone: "2145550000",
    });
    // The email is rejected outright, the phone matches nobody, so this creates
    // a fresh record instead of attaching to the victim.
    expect(result?.student.id).not.toBe("victim");
    expect(result?.created).toBe(true);
    expect(inserted[0].email_normalized).toBeNull();
  });

  it("flags needs_review when a phone match carries a different name", async () => {
    const { client, updated } = fakeSupabase([RACHEL]);
    const result = await findOrCreateStudent(client, {
      name: "Someone Else",
      email: "rachel@example.com",
      phone: "4693719220",
    });
    expect(result?.needsReview).toBe(true);
    expect(result?.needsReviewReason).toContain("name");
    expect(updated[0]).toMatchObject({ needs_review: true });
  });

  it("flags an ambiguous match when phone and email point at different people", async () => {
    // One person entered twice: the phone is on one record, the email on another.
    // A unique index makes a shared email impossible, so the split is across keys.
    const byPhoneOnly = {
      id: "s1",
      name: "Rachel K",
      phone_normalized: "4693719220",
      email_normalized: "old-address@example.com",
    };
    const byEmailOnly = {
      id: "s2",
      name: "Rachel K",
      phone_normalized: "2145550000",
      email_normalized: "rachel@example.com",
    };
    const { client } = fakeSupabase([byPhoneOnly, byEmailOnly]);
    const result = await findOrCreateStudent(client, {
      name: "Rachel K",
      email: "rachel@example.com",
      phone: "4693719220",
    });
    expect(result?.needsReview).toBe(true);
    expect(result?.needsReviewReason).toContain("split across two records");
    // Phone wins the tie, but the conflict is recorded rather than hidden.
    expect(result?.student.id).toBe("s1");
  });

  it("does not compare the name when the caller only has a display name", async () => {
    const { client } = fakeSupabase([RACHEL]);
    const result = await findOrCreateStudent(client, {
      name: "Rachel K.",
      email: "rachel@example.com",
      phone: "",
      compareName: false,
    });
    expect(result?.needsReview).toBe(false);
  });

  it("is case and whitespace insensitive on the name comparison", async () => {
    const { client } = fakeSupabase([RACHEL]);
    const result = await findOrCreateStudent(client, {
      name: "  rachel k  ",
      email: "rachel@example.com",
      phone: "4693719220",
    });
    expect(result?.needsReview).toBe(false);
  });

  it("returns null when there is no usable phone or email", async () => {
    const { client } = fakeSupabase([]);
    const result = await findOrCreateStudent(client, {
      name: "Nobody",
      email: "nope",
      phone: "555",
    });
    expect(result).toBeNull();
  });
});

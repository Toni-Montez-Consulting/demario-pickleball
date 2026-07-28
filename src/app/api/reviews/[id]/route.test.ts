import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  requireAdmin: mocks.requireAdmin,
  createServiceRoleClient: vi.fn(),
}));

const VALID_ID = "12345678-1234-1234-1234-123456789abc";

/** Records what the route tried to write so we can assert on it. */
function adminClient(returnRow: Row | null = { id: VALID_ID }, error: unknown = null) {
  const updates: Row[] = [];
  const deletes: string[] = [];
  const supabase = {
    from() {
      return {
        update(row: Row) {
          updates.push(row);
          return {
            eq: () => ({
              select: () => ({ single: async () => ({ data: returnRow, error }) }),
            }),
          };
        },
        delete() {
          return {
            eq: (_col: string, id: string) => ({
              select: async () => {
                deletes.push(id);
                return { data: returnRow ? [{ id }] : [], error };
              },
            }),
          };
        },
      };
    },
  };
  return { supabase, updates, deletes };
}

function req(body: unknown): NextRequest {
  return { json: async () => body } as NextRequest;
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("PATCH /api/reviews/[id]", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset();
  });

  it("refuses an unauthenticated caller before touching the database", async () => {
    const unauthorized = new Response(null, { status: 401 });
    mocks.requireAdmin.mockResolvedValue({ ok: false, response: unauthorized });
    const { PATCH } = await import("./route");

    const res = await PATCH(req({ status: "published" }), params(VALID_ID));
    expect(res.status).toBe(401);
  });

  it("rejects a malformed id", async () => {
    const { supabase, updates } = adminClient();
    mocks.requireAdmin.mockResolvedValue({ ok: true, supabase });
    const { PATCH } = await import("./route");

    const res = await PATCH(req({ status: "published" }), params("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(updates).toHaveLength(0);
  });

  it("publishes and stamps published_at", async () => {
    const { supabase, updates } = adminClient();
    mocks.requireAdmin.mockResolvedValue({ ok: true, supabase });
    const { PATCH } = await import("./route");

    const res = await PATCH(req({ status: "published" }), params(VALID_ID));
    expect(res.status).toBe(200);
    expect(updates[0].status).toBe("published");
    expect(typeof updates[0].published_at).toBe("string");
  });

  it("hides and clears published_at", async () => {
    const { supabase, updates } = adminClient();
    mocks.requireAdmin.mockResolvedValue({ ok: true, supabase });
    const { PATCH } = await import("./route");

    await PATCH(req({ status: "hidden" }), params(VALID_ID));
    expect(updates[0].status).toBe("hidden");
    expect(updates[0].published_at).toBeNull();
  });

  it("rejects a status outside publish and hide", async () => {
    const { supabase, updates } = adminClient();
    mocks.requireAdmin.mockResolvedValue({ ok: true, supabase });
    const { PATCH } = await import("./route");

    for (const status of ["pending", "deleted", "approved", 5, null]) {
      const res = await PATCH(req({ status }), params(VALID_ID));
      expect(res.status).toBe(400);
    }
    expect(updates).toHaveLength(0);
  });

  // The load-bearing rule: a published review is the student's words or it is worthless.
  it("never writes body or rating even when they are supplied", async () => {
    const { supabase, updates } = adminClient();
    mocks.requireAdmin.mockResolvedValue({ ok: true, supabase });
    const { PATCH } = await import("./route");

    const res = await PATCH(
      req({
        status: "published",
        body: "words the student never wrote",
        rating: 1,
        display_name: "Someone Else",
        verified_booking: true,
      }),
      params(VALID_ID)
    );

    expect(res.status).toBe(200);
    expect(updates).toHaveLength(1);
    expect(Object.keys(updates[0]).sort()).toEqual(["published_at", "status"]);
    expect(updates[0]).not.toHaveProperty("body");
    expect(updates[0]).not.toHaveProperty("rating");
    expect(updates[0]).not.toHaveProperty("display_name");
    expect(updates[0]).not.toHaveProperty("verified_booking");
  });

  it("saves the editorial tag and takeaway", async () => {
    const { supabase, updates } = adminClient();
    mocks.requireAdmin.mockResolvedValue({ ok: true, supabase });
    const { PATCH } = await import("./route");

    await PATCH(req({ tag: "  Strategy  ", takeaway: "Better point construction" }), params(VALID_ID));
    expect(updates[0]).toMatchObject({ tag: "Strategy", takeaway: "Better point construction" });
    expect(updates[0]).not.toHaveProperty("status");
  });

  it("clears the labels when given null or an empty string", async () => {
    const { supabase, updates } = adminClient();
    mocks.requireAdmin.mockResolvedValue({ ok: true, supabase });
    const { PATCH } = await import("./route");

    await PATCH(req({ tag: null, takeaway: "" }), params(VALID_ID));
    expect(updates[0].tag).toBeNull();
    expect(updates[0].takeaway).toBeNull();
  });

  it("rejects an overlong label", async () => {
    const { supabase, updates } = adminClient();
    mocks.requireAdmin.mockResolvedValue({ ok: true, supabase });
    const { PATCH } = await import("./route");

    const res = await PATCH(req({ tag: "x".repeat(121) }), params(VALID_ID));
    expect(res.status).toBe(400);
    expect(updates).toHaveLength(0);
  });

  it("refuses a body with nothing actionable in it", async () => {
    const { supabase, updates } = adminClient();
    mocks.requireAdmin.mockResolvedValue({ ok: true, supabase });
    const { PATCH } = await import("./route");

    const res = await PATCH(req({ irrelevant: true }), params(VALID_ID));
    expect(res.status).toBe(400);
    expect(updates).toHaveLength(0);
  });

  it("reports a missing review as 404 rather than success", async () => {
    const { supabase } = adminClient(null);
    mocks.requireAdmin.mockResolvedValue({ ok: true, supabase });
    const { PATCH } = await import("./route");

    const res = await PATCH(req({ status: "published" }), params(VALID_ID));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/reviews/[id]", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset();
  });

  it("refuses an unauthenticated caller", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const { DELETE } = await import("./route");

    const res = await DELETE({} as NextRequest, params(VALID_ID));
    expect(res.status).toBe(401);
  });

  it("rejects a malformed id without deleting", async () => {
    const { supabase, deletes } = adminClient();
    mocks.requireAdmin.mockResolvedValue({ ok: true, supabase });
    const { DELETE } = await import("./route");

    const res = await DELETE({} as NextRequest, params("../../etc/passwd"));
    expect(res.status).toBe(400);
    expect(deletes).toHaveLength(0);
  });

  it("reports 404 rather than success when no row matched", async () => {
    const { supabase } = adminClient(null);
    mocks.requireAdmin.mockResolvedValue({ ok: true, supabase });
    const { DELETE } = await import("./route");

    const res = await DELETE({} as NextRequest, params(VALID_ID));
    expect(res.status).toBe(404);
  });

  it("deletes the requested review", async () => {
    const { supabase, deletes } = adminClient();
    mocks.requireAdmin.mockResolvedValue({ ok: true, supabase });
    const { DELETE } = await import("./route");

    const res = await DELETE({} as NextRequest, params(VALID_ID));
    expect(res.status).toBe(200);
    expect(deletes).toEqual([VALID_ID]);
  });
});

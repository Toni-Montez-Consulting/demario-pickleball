import type { SupabaseClient } from "@supabase/supabase-js";

// Deliberately stricter than the loose "anything@anything.anything" pattern used
// elsewhere: this value becomes a canonical database key, and characters that are
// meaningful to PostgREST (comma, parens, quotes) must never reach a query.
const EMAIL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/**
 * Canonical phone key: 10 US digits, or null when the input is unusable.
 * Never guess at a partial number — an unusable phone must surface as null so
 * the caller can fall back to email or flag the record.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed) || trimmed.length > 254) return null;
  return trimmed;
}

export interface StudentRow {
  id: string;
  name: string;
  phone_normalized: string | null;
  email_normalized: string | null;
}

export interface StudentMatch {
  student: StudentRow;
  created: boolean;
  needsReview: boolean;
  needsReviewReason: string | null;
}

/**
 * Resolve a person to a student record, creating one when nothing matches.
 *
 * Matching is by normalized phone first, then normalized email. When a match
 * carries different details than the incoming booking, the student is flagged
 * `needs_review` rather than being silently merged or silently duplicated — a
 * plausible-but-wrong student record is worse than a visible conflict.
 *
 * Returns null when there is no usable canonical key at all. Callers must
 * handle that case explicitly instead of inventing one.
 */
export async function findOrCreateStudent(
  supabase: SupabaseClient,
  input: {
    name: string;
    email: string;
    phone: string;
    source?: string;
    /** Set false when `name` is a display name, not the name they booked under. */
    compareName?: boolean;
  }
): Promise<StudentMatch | null> {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  const name = input.name.trim();

  if (!phone && !email) return null;

  // Two separate .eq() lookups rather than one interpolated .or() string.
  // postgrest-js appends .or() filters to the query verbatim — it is an
  // unsanitised escape hatch — and an email is allowed to contain the comma
  // and dot that PostgREST uses as its own delimiters. Interpolating one let
  // an unauthenticated caller append their own conditions and match arbitrary
  // student rows. .eq() encodes its value, so this closes that off entirely.
  const byPhone = phone
    ? await supabase
        .from("students")
        .select("id,name,phone_normalized,email_normalized")
        .eq("phone_normalized", phone)
        .limit(2)
    : null;

  if (byPhone?.error) {
    console.error("[students] phone lookup failed", byPhone.error);
    return null;
  }

  const byEmail = email
    ? await supabase
        .from("students")
        .select("id,name,phone_normalized,email_normalized")
        .eq("email_normalized", email)
        .limit(2)
    : null;

  if (byEmail?.error) {
    console.error("[students] email lookup failed", byEmail.error);
    return null;
  }

  const phoneHit = (byPhone?.data?.[0] ?? null) as StudentRow | null;
  const emailHit = (byEmail?.data?.[0] ?? null) as StudentRow | null;

  // Phone wins, but if the two keys point at DIFFERENT people we are looking at
  // one human split across two records, or two humans sharing a key. Picking one
  // silently is exactly the plausible-but-wrong resolution we refuse to make.
  let ambiguity: string | null = null;
  if (phoneHit && emailHit && phoneHit.id !== emailHit.id) {
    ambiguity =
      `phone matches student ${phoneHit.id} but email matches student ${emailHit.id}; ` +
      `these may be the same person split across two records`;
  }

  const existing = phoneHit ?? emailHit;

  if (!existing) {
    const { data: created, error: insertError } = await supabase
      .from("students")
      .insert({
        name,
        phone_normalized: phone,
        email_normalized: email,
        source: input.source ?? "site",
      })
      .select()
      .single();

    if (insertError || !created) {
      console.error("[students] insert failed", insertError);
      return null;
    }
    return {
      student: created as StudentRow,
      created: true,
      needsReview: false,
      needsReviewReason: null,
    };
  }

  const mismatches: string[] = [];
  if (ambiguity) mismatches.push(ambiguity);

  // compareName is false for surfaces where the caller only has a display name
  // ("Rachel K.") rather than the name the student booked under. Comparing those
  // would flag every honest public review as a conflict.
  if (
    input.compareName !== false &&
    existing.name.trim().toLowerCase() !== name.toLowerCase()
  ) {
    mismatches.push(`name on file is "${existing.name}", booking says "${name}"`);
  }
  if (email && existing.email_normalized && existing.email_normalized !== email) {
    mismatches.push(
      `email on file is "${existing.email_normalized}", booking says "${email}"`
    );
  }
  if (phone && existing.phone_normalized && existing.phone_normalized !== phone) {
    mismatches.push(
      `phone on file is "${existing.phone_normalized}", booking says "${phone}"`
    );
  }

  if (mismatches.length > 0) {
    const reason = mismatches.join("; ");
    const { error: flagError } = await supabase
      .from("students")
      .update({
        needs_review: true,
        needs_review_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (flagError) console.error("[students] flag failed", flagError);
    return { student: existing, created: false, needsReview: true, needsReviewReason: reason };
  }

  return { student: existing, created: false, needsReview: false, needsReviewReason: null };
}

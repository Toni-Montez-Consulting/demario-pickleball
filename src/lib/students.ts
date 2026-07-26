import type { SupabaseClient } from "@supabase/supabase-js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  input: { name: string; email: string; phone: string; source?: string }
): Promise<StudentMatch | null> {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  const name = input.name.trim();

  if (!phone && !email) return null;

  const filters = [
    phone ? `phone_normalized.eq.${phone}` : null,
    email ? `email_normalized.eq.${email}` : null,
  ]
    .filter(Boolean)
    .join(",");

  const { data, error } = await supabase
    .from("students")
    .select("id,name,phone_normalized,email_normalized")
    .or(filters)
    .limit(1);

  if (error) {
    console.error("[students] lookup failed", error);
    return null;
  }

  const existing = (data?.[0] ?? null) as StudentRow | null;

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
  if (existing.name.trim().toLowerCase() !== name.toLowerCase()) {
    mismatches.push(`name on file is "${existing.name}", booking says "${name}"`);
  }
  if (email && existing.email_normalized && existing.email_normalized !== email) {
    mismatches.push(
      `email on file is "${existing.email_normalized}", booking says "${email}"`
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

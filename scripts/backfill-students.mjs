// One-time backfill: give every existing booking a student record.
//
// Run:  node scripts/backfill-students.mjs
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
// Run the students/reviews migration first.
//
// Safe to re-run: bookings that already carry a student_id are skipped.
// Exits non-zero if the reconciliation does not balance. A plausible-but-wrong
// student count is worse than a crash.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

// Mirrors src/lib/students.ts. Kept inline so this script has no build step.
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}
function normalizeEmail(raw) {
  if (!raw) return null;
  const t = String(raw).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : null;
}

const { data: bookings, error } = await supabase
  .from("bookings")
  .select("id,name,email,phone,lesson_date,student_id")
  .order("created_at", { ascending: true });

if (error) {
  console.error("Failed to read bookings:", error);
  process.exit(1);
}

// Each booking gets exactly one outcome: alreadyLinked, linked, or unmatched.
// studentsCreated is informational and counted separately so a create-then-link
// failure cannot double-count and corrupt the reconciliation.
let alreadyLinked = 0;
let linked = 0;
const unmatched = [];
let studentsCreated = 0;
let studentsMatched = 0;

for (const b of bookings) {
  if (b.student_id) {
    alreadyLinked++;
    continue;
  }

  const phone = normalizePhone(b.phone);
  const email = normalizeEmail(b.email);
  if (!phone && !email) {
    unmatched.push({ id: b.id, name: b.name, reason: "no usable phone or email" });
    continue;
  }

  const filters = [
    phone ? `phone_normalized.eq.${phone}` : null,
    email ? `email_normalized.eq.${email}` : null,
  ]
    .filter(Boolean)
    .join(",");

  const { data: found, error: findErr } = await supabase
    .from("students")
    .select("id")
    .or(filters)
    .limit(1);

  if (findErr) {
    unmatched.push({ id: b.id, name: b.name, reason: `lookup error: ${findErr.message}` });
    continue;
  }

  let studentId = found?.[0]?.id ?? null;
  if (studentId) {
    studentsMatched++;
  } else {
    const { data: ins, error: insErr } = await supabase
      .from("students")
      .insert({
        name: b.name,
        phone_normalized: phone,
        email_normalized: email,
        source: "site",
        last_lesson_at: b.lesson_date ? new Date(b.lesson_date).toISOString() : null,
      })
      .select("id")
      .single();

    if (insErr) {
      unmatched.push({ id: b.id, name: b.name, reason: `insert error: ${insErr.message}` });
      continue;
    }
    studentId = ins.id;
    studentsCreated++;
  }

  const { error: linkErr } = await supabase
    .from("bookings")
    .update({ student_id: studentId })
    .eq("id", b.id);

  if (linkErr) {
    unmatched.push({ id: b.id, name: b.name, reason: `link error: ${linkErr.message}` });
    continue;
  }
  linked++;
}

const processed = bookings.length;
const accounted = alreadyLinked + linked + unmatched.length;

console.log("");
console.log("bookings processed:  " + processed);
console.log("already linked:      " + alreadyLinked);
console.log("newly linked:        " + linked);
console.log("bookings unmatched:  " + unmatched.length);
console.log("---");
console.log("students created:    " + studentsCreated);
console.log("students reused:     " + studentsMatched);
for (const u of unmatched) {
  console.log(`  - ${u.id}  ${u.name ?? "(no name)"}  :: ${u.reason}`);
}
console.log("");

if (accounted !== processed) {
  console.error(
    `RECONCILIATION FAILED: accounted for ${accounted} of ${processed} bookings.`
  );
  process.exit(1);
}
console.log("Reconciliation balanced.");

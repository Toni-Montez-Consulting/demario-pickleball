import { createServiceRoleClient } from "@/lib/supabase/server";
import AdminDashboard from "../AdminDashboard";

export default async function AdminPage() {
  const supabase = createServiceRoleClient();

  const [{ data: bookings, error: bookingsError }, { data: inquiries, error: inquiriesError }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .order("lesson_date", { ascending: true }),
    supabase
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  // A failed query must not read as "No bookings yet."
  if (bookingsError) console.error("[admin] bookings load failed", bookingsError);
  if (inquiriesError) console.error("[admin] inquiries load failed", inquiriesError);
  const loadError =
    bookingsError || inquiriesError
      ? `Couldn't load ${bookingsError && inquiriesError ? "bookings or messages" : bookingsError ? "bookings" : "messages"}. Reload the page; if this keeps happening, the database may be down.`
      : null;

  return (
    <AdminDashboard
      initialBookings={bookings ?? []}
      initialInquiries={inquiries ?? []}
      loadError={loadError}
    />
  );
}

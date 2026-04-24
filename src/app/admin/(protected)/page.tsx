import { createServiceRoleClient } from "@/lib/supabase/server";
import AdminDashboard from "../AdminDashboard";

export default async function AdminPage() {
  const supabase = createServiceRoleClient();

  const [{ data: bookings }, { data: inquiries }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .order("lesson_date", { ascending: true }),
    supabase
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <AdminDashboard
      initialBookings={bookings ?? []}
      initialInquiries={inquiries ?? []}
    />
  );
}

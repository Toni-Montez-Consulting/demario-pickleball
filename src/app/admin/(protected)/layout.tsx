import { requireAdminPage } from "@/lib/supabase/server";
import AdminShell from "../AdminShell";

function todayInChicago(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")}`;
}

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Each page below runs the same check itself; this one guards the shell's
  // own read (the overdue-task count).
  const { supabase: service } = await requireAdminPage();
  const { count: overdueCount } = await service
    .from("admin_tasks")
    .select("id", { count: "exact", head: true })
    .lt("due_date", todayInChicago())
    .is("completed_at", null);

  return <AdminShell overdueCount={overdueCount ?? 0}>{children}</AdminShell>;
}

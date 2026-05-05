import { redirect } from "next/navigation";
import { createServerSupabaseClient, createServiceRoleClient, isAdminEmail } from "@/lib/supabase/server";
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
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) redirect("/admin/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") {
    if (aal?.nextLevel === "aal1") {
      redirect("/admin/mfa-setup");
    }
    redirect("/admin/login");
  }

  const service = createServiceRoleClient();
  const { count: overdueCount } = await service
    .from("admin_tasks")
    .select("id", { count: "exact", head: true })
    .lt("due_date", todayInChicago())
    .is("completed_at", null);

  return <AdminShell overdueCount={overdueCount ?? 0}>{children}</AdminShell>;
}

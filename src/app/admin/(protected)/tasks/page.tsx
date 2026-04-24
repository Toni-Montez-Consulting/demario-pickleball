import { createServerSupabaseClient } from "@/lib/supabase/server";
import TasksDashboard from "@/components/TasksDashboard";

export default async function TasksPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("admin_tasks")
    .select("*")
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  return <TasksDashboard initialTasks={data ?? []} />;
}

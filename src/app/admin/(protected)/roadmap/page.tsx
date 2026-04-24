import { createServerSupabaseClient } from "@/lib/supabase/server";
import RoadmapDashboard from "@/components/RoadmapDashboard";

export default async function RoadmapPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("roadmap_checks")
    .select("key, checked");

  const checkedKeys = new Set<string>(
    (data ?? []).filter((r) => r.checked).map((r) => r.key)
  );

  return <RoadmapDashboard initialChecked={checkedKeys} />;
}

import { createServiceRoleClient } from "@/lib/supabase/server";
import RoadmapDashboard from "@/components/RoadmapDashboard";

export default async function RoadmapPage() {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("roadmap_checks")
    .select("key, checked");

  const checkedKeys = (data ?? []).filter((r) => r.checked).map((r) => r.key);

  return <RoadmapDashboard initialChecked={checkedKeys} />;
}

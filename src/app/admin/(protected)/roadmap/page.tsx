import { requireAdminPage } from "@/lib/supabase/server";
import RoadmapDashboard from "@/components/RoadmapDashboard";

export default async function RoadmapPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase
    .from("roadmap_checks")
    .select("key, checked")
    .not("key", "like", "dev-%");

  const checkedKeys = (data ?? []).filter((r) => r.checked).map((r) => r.key);

  return <RoadmapDashboard initialChecked={checkedKeys} />;
}

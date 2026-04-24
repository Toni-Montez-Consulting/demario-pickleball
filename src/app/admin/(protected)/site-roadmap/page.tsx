import { createServiceRoleClient } from "@/lib/supabase/server";
import SiteRoadmapDashboard from "@/components/SiteRoadmapDashboard";

export default async function SiteRoadmapPage() {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("roadmap_checks")
    .select("key, checked")
    .like("key", "dev-%");

  const checkedKeys = (data ?? []).filter((r) => r.checked).map((r) => r.key);

  return <SiteRoadmapDashboard initialChecked={checkedKeys} />;
}

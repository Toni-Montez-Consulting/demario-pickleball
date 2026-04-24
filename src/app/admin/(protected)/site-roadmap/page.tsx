import { createServerSupabaseClient } from "@/lib/supabase/server";
import SiteRoadmapDashboard from "@/components/SiteRoadmapDashboard";

export default async function SiteRoadmapPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("roadmap_checks")
    .select("key, checked")
    .like("key", "site-%");

  const checkedKeys = (data ?? []).filter((r) => r.checked).map((r) => r.key);

  return <SiteRoadmapDashboard initialChecked={checkedKeys} />;
}

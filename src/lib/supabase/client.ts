import { createBrowserClient } from "@supabase/ssr";
import { supabaseBrowserKey } from "./keys";

export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, supabaseBrowserKey());
}

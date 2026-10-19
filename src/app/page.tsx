import type { Metadata } from "next";
import HomePage from "@/components/HomePage";
import { pageMetadata, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/metadata";

// Only the homepage claims "/" as canonical and og:url. In the root layout they
// would be inherited by every page without its own, telling search engines that
// /privacy and the rest are duplicates of the homepage, and making /review links
// preview as it. The homepage itself is a client component, which cannot export
// metadata, hence this thin wrapper.
export const metadata: Metadata = pageMetadata({
  path: "/",
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
});

export default function Page() {
  return <HomePage />;
}

import type { Metadata } from "next";
import HomePage from "@/components/HomePage";

// Only the homepage claims "/" as canonical. In the root layout it would be
// inherited by every page without its own value, telling search engines that
// /privacy and the rest are duplicates of the homepage. The homepage itself is
// a client component, which cannot export metadata, hence this thin wrapper.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Page() {
  return <HomePage />;
}

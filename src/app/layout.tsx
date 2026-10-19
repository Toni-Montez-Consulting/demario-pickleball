import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import SiteAnalytics from "@/components/SiteAnalytics";
import { SITE_URL } from "@/lib/site";
import { OG_IMAGE } from "@/lib/metadata";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});

// One source for the search and link-preview snippet. It was pasted into two
// places before, which is how a stale rating survives an update. Kept under
// ~155 characters so Google does not truncate it.
const SITE_DESCRIPTION =
  "Strategic 1:1 pickleball coaching in Dallas–Fort Worth. Book DeMario Montez — 4.97 doubles DUPR, top 1% worldwide, top 40 in DFW, USPTA certified.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "DeMario Montez — Pickleball Coach · Dallas–Fort Worth",
  description: SITE_DESCRIPTION,
  // Icons come from the file conventions in this folder: icon.svg, favicon.ico,
  // and apple-icon.png (the last two made by scripts/generate-icons.mjs).
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "DeMario Montez — Pickleball Coach · Dallas–Fort Worth",
    description: SITE_DESCRIPTION,
    // 1200x630 card made by scripts/generate-og-image.mjs. The portrait hero
    // photo used before was cropped or shrunk by iMessage, WhatsApp, and
    // Facebook, which is where students share coaches with each other.
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "DeMario Montez — Pickleball Coach · Dallas–Fort Worth",
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      // Deliberately no aggregateRating. Google treats reviews a business collects
      // about itself on its own site as self-serving: the markup is ignored for
      // rich results, so it would add surface area and buy nothing.
      "@type": "SportsActivityLocation",
      "@id": `${SITE_URL}/#business`,
      name: "DeMario Montez Pickleball Coaching",
      url: SITE_URL,
      image: `${SITE_URL}/img/hero-ready.jpg`,
      telephone: "+14693719220",
      email: "demariomontez10@gmail.com",
      areaServed: [
        { "@type": "City", name: "Dallas" },
        { "@type": "City", name: "Fort Worth" },
        { "@type": "City", name: "Farmers Branch" },
        { "@type": "City", name: "Plano" },
      ],
      sameAs: [
        "https://instagram.com/Alexanderiio",
        "https://tiktok.com/@DemarioMontez",
        "https://facebook.com/demario.montez.9/",
      ],
      employee: { "@id": `${SITE_URL}/#coach` },
      address: {
        "@type": "PostalAddress",
        addressLocality: "Farmers Branch",
        addressRegion: "TX",
        addressCountry: "US",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 32.9262,
        longitude: -96.8892,
      },
      priceRange: "$$",
      description:
        "Strategic 1:1 pickleball coaching in Dallas–Fort Worth by USPTA certified coach DeMario Montez.",
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#coach`,
      name: "DeMario Montez",
      jobTitle: "Pickleball Coach",
      telephone: "+14693719220",
      email: "demariomontez10@gmail.com",
      sameAs: [
        "https://instagram.com/Alexanderiio",
        "https://tiktok.com/@DemarioMontez",
        "https://facebook.com/demario.montez.9/",
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        {/* Cookieless. Redacts review tokens from reported paths. */}
        <SiteAnalytics />
      </body>
    </html>
  );
}

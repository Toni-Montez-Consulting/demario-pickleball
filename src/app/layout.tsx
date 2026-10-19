import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import SiteAnalytics from "@/components/SiteAnalytics";
import { SITE_URL } from "@/lib/site";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/metadata";
import "./fonts.css";
import "./globals.css";

// The Latin subsets carry nearly all of the site's text. next/font preloaded
// these two files before fonts.css replaced it, and the preload stays.
const PRELOADED_FONTS = [
  "/fonts/inter-latin.83afe278.woff2",
  "/fonts/space-grotesk-latin.0c89a48f.woff2",
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  // Icons come from the file conventions in this folder: icon.svg, favicon.ico,
  // and apple-icon.png (the last two made by scripts/generate-icons.mjs).
  // Site-wide preview fields only. A page without its own openGraph keeps this
  // object, so a url or title here would make it preview as the homepage; Next
  // fills og:title and og:description from the page's own metadata instead.
  // The homepage sets its own in src/app/page.tsx.
  openGraph: {
    type: "website",
    // 1200x630 card made by scripts/generate-og-image.mjs. The portrait hero
    // photo used before was cropped or shrunk by iMessage, WhatsApp, and
    // Facebook, which is where students share coaches with each other.
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
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
  for (const href of PRELOADED_FONTS) {
    preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  }
  return (
    <html lang="en">
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

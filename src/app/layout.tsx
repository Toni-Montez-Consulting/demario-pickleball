import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import SiteAnalytics from "@/components/SiteAnalytics";
import { SITE_URL } from "@/lib/site";
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "DeMario Montez — Pickleball Coach · Dallas–Fort Worth",
  description:
    "Strategic 1:1 pickleball coaching in Dallas–Fort Worth. Book a lesson with Head Pro DeMario Montez — 4.70 doubles DUPR, USTA certified, Top 3% SuperCoach.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "DeMario Montez — Pickleball Coach · Dallas–Fort Worth",
    description:
      "Strategic 1:1 pickleball coaching in Dallas–Fort Worth. Book a lesson with Head Pro DeMario Montez — 4.70 doubles DUPR, USTA certified, Top 3% SuperCoach.",
    images: [{ url: "/img/hero-ready.jpg", width: 828, height: 1099, alt: "DeMario Montez on the pickleball court" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DeMario Montez — Pickleball Coach · Dallas–Fort Worth",
    description:
      "Strategic 1:1 pickleball coaching in Dallas–Fort Worth. Book a lesson with Head Pro DeMario Montez.",
    images: ["/img/hero-ready.jpg"],
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
        "Strategic 1:1 pickleball coaching in Dallas–Fort Worth by Head Pro DeMario Montez.",
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#coach`,
      name: "DeMario Montez",
      jobTitle: "Head Pickleball Pro",
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

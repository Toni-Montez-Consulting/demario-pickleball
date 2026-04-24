import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
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
    "Strategic 1:1 pickleball coaching in Dallas–Fort Worth. Book a lesson with Head Pro DeMario Montez — 4.6 DUPR, USTA certified, Top 3% SuperCoach.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "DeMario Montez — Pickleball Coach · Dallas–Fort Worth",
    description:
      "Strategic 1:1 pickleball coaching in Dallas–Fort Worth. Book a lesson with Head Pro DeMario Montez — 4.6 DUPR, USTA certified, Top 3% SuperCoach.",
    images: [{ url: "/img/hero-ready.jpg", width: 1200, height: 630, alt: "DeMario Montez on the pickleball court" }],
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
      "@type": "LocalBusiness",
      "@id": `${SITE_URL}/#business`,
      name: "DeMario Montez Pickleball Coaching",
      url: SITE_URL,
      telephone: "+14693719220",
      email: "demariomontez10@gmail.com",
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
        "https://facebook.com/DemarioMontez",
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
      <body>{children}</body>
    </html>
  );
}

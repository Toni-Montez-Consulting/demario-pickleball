export type VenueBookingMode = "site-direct" | "platform-required" | "hybrid-by-request";

export interface VenueRule {
  name: string;
  shortName: string;
  mode: VenueBookingMode;
  bookingOwner: string;
  paymentOwner: string;
  waiverOwner: string;
  summary: string;
  studentAction: string;
  ctaLabel?: string;
  href?: string;
}

export const TEXT_MARIO_HREF = "sms:4693719220";

export const PUBLIC_COURT_RULE: VenueRule = {
  name: "Public outdoor courts",
  shortName: "Public courts",
  mode: "site-direct",
  bookingOwner: "DeMario's site",
  paymentOwner: "DeMario",
  waiverOwner: "DeMario's site terms",
  summary: "Book the lesson time here. Mario confirms the exact public court after checking weather, traffic, and your preference.",
  studentAction: "Choose Outdoor public court or Help me choose, then pick an available lesson time.",
};

export const PLATFORM_REQUIRED_VENUES: VenueRule[] = [
  {
    name: "Dallas Indoor Pickleball Club",
    shortName: "Dallas Indoor",
    mode: "platform-required",
    bookingOwner: "PodPlay",
    paymentOwner: "PodPlay",
    waiverOwner: "PodPlay / venue",
    summary: "Reserve the court in PodPlay, select DeMario as coach, and complete the venue payment and waiver flow there.",
    studentAction: "Open PodPlay for Dallas Indoor",
    ctaLabel: "Open PodPlay",
    href: "https://dallaspickleclub.podplay.app/coach/demario-montez-8l4j",
  },
  {
    name: "The Grove Pickleball",
    shortName: "The Grove",
    mode: "platform-required",
    bookingOwner: "PodPlay",
    paymentOwner: "PodPlay",
    waiverOwner: "PodPlay / venue",
    summary: "Book through The Grove's PodPlay flow so the court, coach selection, payment, and waiver stay with the venue system.",
    studentAction: "Open PodPlay for The Grove",
    ctaLabel: "Open PodPlay",
    href: "https://grove.podplay.app/coach/demario-montez-v0m3",
  },
  {
    name: "Life Time Fitness",
    shortName: "Life Time",
    mode: "platform-required",
    bookingOwner: "Life Time",
    paymentOwner: "Life Time",
    waiverOwner: "Life Time",
    summary: "Life Time sessions are for active members and must be booked inside Life Time's own system.",
    studentAction: "Book through your Life Time account, or text Mario if you need help choosing the right path.",
  },
  {
    name: "TeachMe.To",
    shortName: "TeachMe.To",
    mode: "platform-required",
    bookingOwner: "TeachMe.To",
    paymentOwner: "TeachMe.To",
    waiverOwner: "TeachMe.To",
    summary: "Use TeachMe.To when you want their packages, payment flow, waiver, and marketplace protections.",
    studentAction: "Open TeachMe.To",
    ctaLabel: "Open TeachMe.To",
    href: "https://teachme.to/listings/pickleball/pickleball-with-demario-montez?latitude=32.92651&longitude=-96.89612",
  },
];

export const HYBRID_BY_REQUEST_VENUES: VenueRule[] = [
  {
    name: "Samuel-Grand Tennis Center",
    shortName: "Samuel-Grand",
    mode: "hybrid-by-request",
    bookingOwner: "Impact Activities",
    paymentOwner: "Court through Impact; coaching fee to DeMario",
    waiverOwner: "Impact / venue plus DeMario's site terms when applicable",
    summary: "Reserve the court through Impact Activities, then coordinate the coaching fee and lesson details with Mario.",
    studentAction: "Reserve through Impact, then text Mario",
  },
];

export const INDOOR_ROUTING_OPTIONS: VenueRule[] = [
  ...PLATFORM_REQUIRED_VENUES.slice(0, 3),
  ...HYBRID_BY_REQUEST_VENUES,
  PLATFORM_REQUIRED_VENUES[3],
];

export const REQUIRED_BOOKING_PATHS: VenueRule[] = [
  ...PLATFORM_REQUIRED_VENUES,
  ...HYBRID_BY_REQUEST_VENUES,
];

export const COURT_SETUP_HINTS: Record<string, string> = {
  "Indoor / weather-proof": "Indoor and reserved courts use their required venue platforms first. We will route you before showing site times.",
  "Outdoor public court": "Public courts can be scheduled here. Mario confirms the exact court after checking weather and court traffic.",
  "Help me choose": "Book a time here and Mario will recommend the cleanest public-court or partner-platform path.",
};

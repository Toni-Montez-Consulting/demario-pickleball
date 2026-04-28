export const COURT_SETUP_OPTIONS = [
  "Indoor / weather-proof",
  "Outdoor public court",
  "Help me choose",
] as const;

export type CourtSetup = (typeof COURT_SETUP_OPTIONS)[number];

export interface ParsedBookingNotes {
  courtSetup: string | null;
  preferredArea: string | null;
  raw: string | null;
}

export function isCourtSetup(value: unknown): value is CourtSetup {
  return (
    typeof value === "string" &&
    COURT_SETUP_OPTIONS.includes(value as CourtSetup)
  );
}

export function formatBookingNotes({
  courtSetup,
  preferredArea,
}: {
  courtSetup: CourtSetup;
  preferredArea?: string;
}): string {
  const lines = [`Preferred court setup: ${courtSetup}`];
  const trimmedArea = preferredArea?.trim();
  if (trimmedArea) {
    lines.push(`Preferred area or court: ${trimmedArea.slice(0, 160)}`);
  }
  return lines.join("\n");
}

export function parseBookingNotes(notes: string | null | undefined): ParsedBookingNotes {
  const trimmed = typeof notes === "string" ? notes.trim() : "";
  if (!trimmed) return { courtSetup: null, preferredArea: null, raw: null };

  let courtSetup: string | null = null;
  let preferredArea: string | null = null;

  for (const line of trimmed.split(/\r?\n/)) {
    const [label, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (/^preferred court setup$/i.test(label.trim())) {
      courtSetup = value || null;
    }
    if (/^preferred area or court$/i.test(label.trim())) {
      preferredArea = value || null;
    }
  }

  return { courtSetup, preferredArea, raw: trimmed };
}

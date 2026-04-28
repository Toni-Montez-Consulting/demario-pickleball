import { describe, expect, it } from "vitest";
import { generateGoogleCalendarUrl, generateIcs } from "./ics";

const booking = {
  id: "12345678-1234-1234-1234-123456789abc",
  name: "Jane Student",
  email: "jane@example.com",
  lesson_type: "beginner",
  lesson_date: "2026-05-04",
  lesson_time: "9:00 AM",
  phone: "(469) 371-9220",
  notes: "Preferred court setup: Indoor / weather-proof\nPreferred area or court: The Grove",
};

function unfoldIcs(ics: string): string {
  return ics.replace(/\r\n /g, "");
}

describe("calendar helpers", () => {
  it("generates a request ICS with Chicago timezone and booking ID", () => {
    const { ics, filename } = generateIcs({
      booking,
      method: "REQUEST",
      organizerEmail: "coach@example.com",
    });

    expect(filename).toBe("invite.ics");
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("TZID:America/Chicago");
    expect(ics).toContain("UID:booking-12345678-1234-1234-1234-123456789abc@demariomontezpb.com");
    expect(ics).toContain("Booking ID: 12345678");
    expect(unfoldIcs(ics)).toContain("Court: Mario will confirm the exact court after booking.");
  });

  it("generates a Google Calendar template URL", () => {
    const url = new URL(generateGoogleCalendarUrl({ booking }));

    expect(url.origin).toBe("https://calendar.google.com");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("ctz")).toBe("America/Chicago");
    expect(url.searchParams.get("details")).toContain("Booking ID: 12345678");
    expect(url.searchParams.get("details")).toContain("Court: Mario will confirm the exact court after booking.");
  });
});

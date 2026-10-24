import { describe, expect, it } from "vitest";
import { generateCoachCalendarUrl, generateGoogleCalendarUrl, generateIcs } from "./ics";

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

  it("runs a 90-minute drilling session for 90 minutes and prints the group's quote", () => {
    const group = {
      ...booking,
      lesson_type: "drill_90",
      lesson_time: "5:00 PM",
      group_size: 3,
      quoted_per_person_cents: 3500,
      quoted_total_cents: 10500,
    };
    const ics = unfoldIcs(generateIcs({ booking: group, method: "REQUEST", organizerEmail: "coach@example.com" }).ics);

    expect(ics).toContain("DTSTART;TZID=America/Chicago:20260504T170000");
    expect(ics).toContain("DTEND;TZID=America/Chicago:20260504T183000");
    expect(ics).toContain("Drilling Session\\, 90 min");
    expect(ics).toContain("Price: $35 per person · 3 players · $105 total");

    const url = new URL(generateGoogleCalendarUrl({ booking: group }));
    expect(url.searchParams.get("dates")).toBe("20260504T170000/20260504T183000");
    expect(url.searchParams.get("details")).toContain("Price: $35 per person · 3 players · $105 total");
  });

  it("blocks one hour for Play with the Pro", () => {
    const { ics } = generateIcs({
      booking: { ...booking, lesson_type: "play_pro", group_size: 2, quoted_per_person_cents: 4000, quoted_total_cents: 8000 },
      method: "REQUEST",
      organizerEmail: "coach@example.com",
    });
    expect(ics).toContain("DTEND;TZID=America/Chicago:20260504T100000");
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

describe("generateCoachCalendarUrl", () => {
  it("names the student for Mario and carries the phone and court setup", () => {
    const url = new URL(
      generateCoachCalendarUrl({
        id: "12345678-1234-1234-1234-123456789abc",
        name: "Jane Student",
        email: "jane@example.com",
        phone: "(469) 555-0100",
        lesson_type: "beginner",
        lesson_date: "2026-10-24",
        lesson_time: "9:00 AM",
        court_setup: "Outdoor public court",
      })
    );
    expect(url.searchParams.get("text")).toBe("Lesson: Jane S. · Foundations");
    expect(url.searchParams.get("dates")).toBe("20261024T090000/20261024T100000");
    expect(url.searchParams.get("ctz")).toBe("America/Chicago");
    expect(url.searchParams.get("details")).toContain("Phone: (469) 555-0100");
    expect(url.searchParams.get("details")).toContain("Court setup: Outdoor public court");
    // The student's email is not his to need on a calendar entry.
    expect(url.toString()).not.toContain("jane%40example.com");
  });
});

import { describe, expect, it } from "vitest";
import { adminNotificationHtml, studentRequestedHtml } from "./templates";

const booking = {
  id: "12345678-1234-1234-1234-123456789abc",
  name: "Jane Student",
  email: "jane@example.com",
  phone: "(469) 371-9220",
  lesson_type: "beginner",
  lesson_date: "2026-05-04",
  lesson_time: "9:00 AM",
  notes: "Preferred court setup: Outdoor public court\nPreferred area or court: Lake Highlands",
};

describe("email templates", () => {
  it("tells students Mario will confirm the exact court", () => {
    const html = studentRequestedHtml(booking);

    expect(html).toContain("Mario will confirm the exact court");
    expect(html).toContain("Outdoor public court");
    expect(html).toContain("Lake Highlands");
    expect(html).toContain("Lesson fee");
    expect(html).toContain("Court reservation fees, if any, are confirmed separately");
  });

  it("includes phone and court preference in the admin notification", () => {
    const html = adminNotificationHtml(booking);

    expect(html).toContain("(469) 371-9220");
    expect(html).toContain("Outdoor public court");
    expect(html).toContain("Text the student to confirm the exact court");
  });
});

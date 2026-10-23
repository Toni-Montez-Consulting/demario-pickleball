import { describe, expect, it } from "vitest";
import { isDueForReminder, reminderLessonDate } from "./lesson-reminders";

// 10:00 AM in Dallas (CDT) on Friday, Oct 23, 2026.
const NOW = new Date("2026-10-23T15:00:00Z");

const booking = {
  id: "11111111-1111-1111-1111-111111111111",
  status: "pending",
  lesson_date: "2026-10-24",
  created_at: "2026-10-20T18:00:00Z",
  reminder_sent_at: null,
};

describe("isDueForReminder", () => {
  it("reminds a pending lesson tomorrow in Dallas time", () => {
    expect(reminderLessonDate(NOW)).toBe("2026-10-24");
    expect(isDueForReminder(booking, NOW)).toEqual({ due: true });
  });

  it("uses the Dallas date, not the UTC one, late in the evening", () => {
    // 9:30 PM Friday in Dallas is already Saturday in UTC.
    expect(reminderLessonDate(new Date("2026-10-24T02:30:00Z"))).toBe("2026-10-24");
  });

  it("skips cancelled, already reminded, other days, and just-booked lessons", () => {
    expect(isDueForReminder({ ...booking, status: "cancelled" }, NOW)).toMatchObject({ due: false });
    expect(isDueForReminder({ ...booking, reminder_sent_at: "2026-10-23T14:00:00Z" }, NOW)).toMatchObject({
      due: false,
      reason: "already reminded",
    });
    expect(isDueForReminder({ ...booking, lesson_date: "2026-10-25" }, NOW)).toMatchObject({ due: false });
    expect(isDueForReminder({ ...booking, created_at: "2026-10-23T09:00:00Z" }, NOW)).toMatchObject({
      due: false,
      reason: "booked in the last 12 hours",
    });
  });

  it("does not guess when the booking time is unreadable", () => {
    expect(isDueForReminder({ ...booking, created_at: "not a date" }, NOW)).toMatchObject({
      due: false,
      reason: "unparseable created_at",
    });
  });
});

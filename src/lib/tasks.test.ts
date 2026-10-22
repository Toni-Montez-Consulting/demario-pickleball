import { describe, expect, it } from "vitest";
import { advanceDueDate, isValidDateString } from "./tasks";

describe("task date helpers", () => {
  it("validates ISO date-shaped strings", () => {
    expect(isValidDateString("2026-05-04")).toBe(true);
    expect(isValidDateString("05/04/2026")).toBe(false);
  });

  it("advances recurring due dates", () => {
    expect(advanceDueDate("2026-05-04", "daily")).toBe("2026-05-05");
    expect(advanceDueDate("2026-05-04", "weekly")).toBe("2026-05-11");
    expect(advanceDueDate("2026-05-04", "biweekly")).toBe("2026-05-18");
    expect(advanceDueDate("2026-05-04", "monthly")).toBe("2026-06-04");
    expect(advanceDueDate("2026-12-15", "monthly")).toBe("2027-01-15");
    expect(advanceDueDate("2026-05-04", "none")).toBeNull();
  });

  // A monthly task due on the 31st lands on the next month's last day, not
  // in the month after it.
  it("keeps a monthly task in the next month when that month is shorter", () => {
    expect(advanceDueDate("2026-10-31", "monthly")).toBe("2026-11-30");
    expect(advanceDueDate("2027-01-31", "monthly")).toBe("2027-02-28");
    expect(advanceDueDate("2028-01-31", "monthly")).toBe("2028-02-29");
    expect(advanceDueDate("2026-08-31", "monthly")).toBe("2026-09-30");
  });
});

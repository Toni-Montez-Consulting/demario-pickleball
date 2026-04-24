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
    expect(advanceDueDate("2026-05-04", "none")).toBeNull();
  });
});

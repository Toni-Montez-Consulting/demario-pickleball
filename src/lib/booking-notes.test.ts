import { describe, expect, it } from "vitest";
import {
  formatBookingNotes,
  isCourtSetup,
  parseBookingNotes,
} from "./booking-notes";

describe("booking notes helpers", () => {
  it("formats and parses court preference notes", () => {
    const notes = formatBookingNotes({
      courtSetup: "Indoor / weather-proof",
      preferredArea: "The Grove",
    });

    expect(notes).toBe(
      "Preferred court setup: Indoor / weather-proof\nPreferred area or court: The Grove"
    );
    expect(parseBookingNotes(notes)).toMatchObject({
      courtSetup: "Indoor / weather-proof",
      preferredArea: "The Grove",
    });
  });

  it("identifies supported court setup options", () => {
    expect(isCourtSetup("Outdoor public court")).toBe(true);
    expect(isCourtSetup("Somewhere else")).toBe(false);
  });
});

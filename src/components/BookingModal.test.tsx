import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import BookingModal from "./BookingModal";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("BookingModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires waiver agreement and submits it to the booking API", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/time-slots") {
        return jsonResponse([{ display_label: "9:00 AM" }]);
      }
      if (url.startsWith("/api/availability")) {
        return jsonResponse({ allDay: false, unavailable: [] });
      }
      if (url === "/api/bookings") {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toMatchObject({
          name: "Jane Student",
          email: "jane@example.com",
          lesson_type: "beginner",
          lesson_time: "9:00 AM",
          waiver_accepted: true,
        });
        return jsonResponse({
          id: "12345678-1234-1234-1234-123456789abc",
          name: "Jane Student",
          email: "jane@example.com",
          lesson_type: "beginner",
          lesson_date: "2026-05-04",
          lesson_time: "9:00 AM",
        }, 201);
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<BookingModal isOpen onClose={() => undefined} />);

    await userEvent.type(screen.getByLabelText(/your name/i), "Jane Student");
    await userEvent.type(screen.getByLabelText(/email/i), "jane@example.com");
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await screen.findByText(/you're booked/i);
    expect(screen.getByText(/Lesson 12345678/i)).toBeInTheDocument();
  });

  it("shows a clear no-times empty state", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/time-slots") return jsonResponse([]);
      if (url.startsWith("/api/availability")) return jsonResponse({ allDay: false, unavailable: [] });
      throw new Error(`Unexpected fetch ${url}`);
    }));

    render(<BookingModal isOpen onClose={() => undefined} />);

    await userEvent.type(screen.getByLabelText(/your name/i), "Jane Student");
    await userEvent.type(screen.getByLabelText(/email/i), "jane@example.com");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/No lesson times available yet/i)).toBeInTheDocument();
    });
  });
});

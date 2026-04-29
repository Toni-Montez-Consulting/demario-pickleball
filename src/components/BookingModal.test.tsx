import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("requires waiver agreement and submits direct public-court bookings to the booking API", async () => {
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
          phone: "(469) 371-9220",
          lesson_type: "beginner",
          lesson_time: "9:00 AM",
          notes: "Preferred court setup: Outdoor public court\nPreferred area or court: Lake Highlands",
          waiver_accepted: true,
          company: "",
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

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Jane Student" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "(469) 371-9220" } });
    fireEvent.change(screen.getByLabelText(/preferred court setup/i), { target: { value: "Outdoor public court" } });
    fireEvent.change(screen.getByLabelText(/preferred area or court/i), { target: { value: "Lake Highlands" } });
    expect(screen.getByRole("button", { name: /continue to available times/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /continue to available times/i }));

    fireEvent.click(await screen.findByRole("button", { name: /reserve/i }));

    await screen.findByText(/you're booked/i);
    expect(screen.getByText(/Lesson 12345678/i)).toBeInTheDocument();
    expect(screen.getByText(/Mario will confirm the exact court/i)).toBeInTheDocument();
  }, 15000);

  it("routes indoor students to partner booking paths before showing site times", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/time-slots") return jsonResponse([{ display_label: "9:00 AM" }]);
      if (url.startsWith("/api/availability")) return jsonResponse({ allDay: false, unavailable: [] });
      throw new Error(`Unexpected fetch ${url}`);
    }));

    render(<BookingModal isOpen onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Jane Student" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "(469) 371-9220" } });
    fireEvent.change(screen.getByLabelText(/preferred court setup/i), { target: { value: "Indoor / weather-proof" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /see indoor booking paths/i }));

    expect(await screen.findByText(/Indoor courts use partner booking/i)).toBeInTheDocument();
    expect(screen.getByText("Dallas Indoor Pickleball Club")).toBeInTheDocument();
    expect(screen.getByText("The Grove Pickleball")).toBeInTheDocument();
    expect(screen.getByText("Life Time Fitness")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /choose a time/i })).not.toBeInTheDocument();
  });

  it("shows a clear no-times empty state", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/time-slots") return jsonResponse([]);
      if (url.startsWith("/api/availability")) return jsonResponse({ allDay: false, unavailable: [] });
      throw new Error(`Unexpected fetch ${url}`);
    }));

    render(<BookingModal isOpen onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Jane Student" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "(469) 371-9220" } });
    fireEvent.change(screen.getByLabelText(/preferred court setup/i), { target: { value: "Outdoor public court" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /continue to available times/i }));

    await waitFor(() => {
      expect(screen.getByText(/No lesson times available yet/i)).toBeInTheDocument();
    });
  });

  it("lets help-me-choose students continue to available times", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/time-slots") return jsonResponse([{ display_label: "9:00 AM" }]);
      if (url.startsWith("/api/availability")) return jsonResponse({ allDay: false, unavailable: [] });
      throw new Error(`Unexpected fetch ${url}`);
    }));

    render(<BookingModal isOpen onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Jane Student" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "(469) 371-9220" } });
    fireEvent.change(screen.getByLabelText(/preferred court setup/i), { target: { value: "Help me choose" } });
    expect(screen.getByText("Book a time here and Mario will recommend the cleanest public-court or partner-platform path.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /continue to available times/i }));

    expect(await screen.findByRole("heading", { name: /choose a time/i })).toBeInTheDocument();
  });
});

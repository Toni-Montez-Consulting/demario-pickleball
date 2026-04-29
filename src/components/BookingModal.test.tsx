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

  it("defers availability loading until a student continues to site-bookable times", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/time-slots") {
        return jsonResponse([{ display_label: "9:00 AM" }]);
      }
      if (url.startsWith("/api/availability")) {
        return jsonResponse({ allDay: false, unavailable: [] });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<BookingModal isOpen onClose={() => undefined} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/time-slots");
    });
    expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith("/api/availability"))).toBe(false);

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Jane Student" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "(469) 371-9220" } });
    fireEvent.change(screen.getByLabelText(/preferred court setup/i), { target: { value: "Outdoor public court" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /continue to available times/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith("/api/availability"))).toBe(true);
    });
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
    const continueButton = await screen.findByRole("button", { name: /continue to available times/i });
    expect(continueButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(continueButton);

    fireEvent.click(await screen.findByRole("button", { name: /reserve/i }));

    await screen.findByText(/you're booked/i);
    expect(screen.getByText(/Lesson 12345678/i)).toBeInTheDocument();
    expect(screen.getByText(/Mario will confirm the exact court/i)).toBeInTheDocument();
    expect(screen.getByAltText(/PayPal QR code/i)).toHaveAttribute("src", "/img/paypal-qr-tight.png");
    expect(screen.getByRole("link", { name: /^PayPal/i })).toHaveAttribute(
      "href",
      "https://www.paypal.com/paypalme/DemarioMontez"
    );
    expect(screen.getByRole("link", { name: /open paypal app payment link/i })).toHaveAttribute(
      "href",
      "https://www.paypal.com/paypalme/DemarioMontez"
    );
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

    expect(screen.getByRole("link", { name: /Dallas Indoor Pickleball Club/i })).toHaveAttribute(
      "href",
      "https://dallaspickleclub.podplay.app/coach/demario-montez-8l4j"
    );
    expect(screen.getByRole("link", { name: /The Grove Pickleball/i })).toHaveAttribute(
      "href",
      "https://grove.podplay.app/coach/demario-montez-v0m3"
    );
    expect(screen.getByText("Life Time Fitness").closest("a")).toBeNull();
    expect(screen.getByText("Samuel-Grand Tennis Center").closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: /text mario/i })).toHaveAttribute(
      "href",
      "sms:4693719220"
    );
  });

  it("shows terms inside the modal and keeps typed booking details when returning", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/time-slots") return jsonResponse([{ display_label: "9:00 AM" }]);
      throw new Error(`Unexpected fetch ${url}`);
    }));

    render(<BookingModal isOpen onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Jane Student" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "(469) 371-9220" } });
    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: "advanced" } });
    fireEvent.change(screen.getByLabelText(/preferred court setup/i), { target: { value: "Outdoor public court" } });
    fireEvent.change(screen.getByLabelText(/preferred area or court/i), { target: { value: "Lake Highlands" } });

    fireEvent.click(screen.getByRole("button", { name: /coaching agreement/i }));
    expect(screen.getByRole("heading", { name: /coaching agreement/i })).toBeInTheDocument();
    expect(screen.getByText(/Assumption of Risk/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back to booking/i }));

    expect(screen.getByLabelText(/your name/i)).toHaveValue("Jane Student");
    expect(screen.getByLabelText(/email/i)).toHaveValue("jane@example.com");
    expect(screen.getByLabelText(/phone/i)).toHaveValue("(469) 371-9220");
    expect(screen.getByLabelText(/lesson type/i)).toHaveValue("advanced");
    expect(screen.getByLabelText(/preferred court setup/i)).toHaveValue("Outdoor public court");
    expect(screen.getByLabelText(/preferred area or court/i)).toHaveValue("Lake Highlands");
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
    fireEvent.click(await screen.findByRole("button", { name: /continue to available times/i }));

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
    fireEvent.click(await screen.findByRole("button", { name: /continue to available times/i }));

    expect(await screen.findByRole("heading", { name: /choose a time/i })).toBeInTheDocument();
  });
});

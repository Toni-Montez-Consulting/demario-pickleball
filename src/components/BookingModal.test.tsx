import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function fillDetails() {
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Jane Student" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "(469) 371-9220" } });
    fireEvent.change(screen.getByLabelText(/preferred court setup/i), { target: { value: "Outdoor public court" } });
    fireEvent.click(screen.getByRole("checkbox"));
  }

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
        // A one-on-one lesson carries no group size.
        expect(JSON.parse(String(init?.body))).not.toHaveProperty("group_size");
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

    // Reserve renders disabled until availability loads. A click before then is
    // ignored, which made this test fail whenever the runner was slow.
    const reserve = await screen.findByRole("button", { name: /reserve/i });
    await waitFor(() => expect(reserve).toBeEnabled());
    fireEvent.click(reserve);

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

  it("quotes a drilling group live and books the size and length it showed", async () => {
    let posted: Record<string, unknown> | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/time-slots") return jsonResponse([{ display_label: "9:00 AM" }]);
      if (url.startsWith("/api/availability")) return jsonResponse({ allDay: false, unavailable: [] });
      if (url === "/api/bookings") {
        posted = JSON.parse(String(init?.body));
        return jsonResponse({ id: "12345678-1234-1234-1234-123456789abc" }, 201);
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<BookingModal isOpen onClose={() => undefined} initialLessonType="drill" />);

    // One player and 60 minutes to start.
    expect(screen.getByLabelText(/lesson type/i)).toHaveValue("drill");
    expect(screen.getByText("$60 per person · 1 player · $60 total")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fewer players/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "90 min" }));
    fireEvent.click(screen.getByRole("button", { name: /more players/i }));
    fireEvent.click(screen.getByRole("button", { name: /more players/i }));
    expect(screen.getByText("$35 per person · 3 players · $105 total")).toBeInTheDocument();
    expect(screen.getByText(/Court fees, if any, are separate/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Jane Student" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "(469) 371-9220" } });
    fireEvent.change(screen.getByLabelText(/preferred court setup/i), { target: { value: "Outdoor public court" } });
    fireEvent.click(screen.getByRole("checkbox"));
    // Labelled "Loading lesson times..." until the times arrive.
    fireEvent.click(await screen.findByRole("button", { name: /continue to available times/i }));

    const reserve = await screen.findByRole("button", { name: /reserve/i });
    await waitFor(() => expect(reserve).toBeEnabled());
    const availability = fetchMock.mock.calls.find(([input]) => String(input).startsWith("/api/availability"));
    expect(String(availability?.[0])).toContain("lesson_type=drill_90");
    expect(screen.getAllByText(/Drilling Session, 90 min · 3 players/).length).toBeGreaterThan(0);
    fireEvent.click(reserve);

    await screen.findByText(/you're booked/i);
    expect(posted).toMatchObject({ lesson_type: "drill_90", group_size: 3 });
    expect(screen.getByText("3 players · $35 per person")).toBeInTheDocument();
    // The person booking pays the group's total.
    expect(screen.getAllByText("$105.00")).toHaveLength(2);
  }, 15000);

  it("holds the stepper to each format's limits and clamps on a switch", () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/time-slots") return jsonResponse([{ display_label: "9:00 AM" }]);
      throw new Error(`Unexpected fetch ${url}`);
    }));

    render(<BookingModal isOpen onClose={() => undefined} initialLessonType="drill" />);

    // Three taps before React renders again all count.
    const more = screen.getByRole("button", { name: /more players/i });
    act(() => {
      more.click();
      more.click();
      more.click();
    });
    expect(screen.getByText("4 players")).toBeInTheDocument();

    for (let i = 0; i < 10; i++) fireEvent.click(more);
    expect(screen.getByText("8 players")).toBeInTheDocument();
    expect(more).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: "play_pro" } });
    expect(screen.getByText("4 players")).toBeInTheDocument();
    expect(screen.getByText("$30 per person · 4 players · $120 total")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "90 min" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: "clinic" } });
    expect(screen.queryByRole("button", { name: /more players/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/per person ·/)).not.toBeInTheDocument();
  });

  it("accepts a dotted phone number and explains a bad one once the field is left", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/time-slots") return jsonResponse([{ display_label: "9:00 AM" }]);
      throw new Error(`Unexpected fetch ${url}`);
    }));

    render(<BookingModal isOpen onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Jane Student" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText(/preferred court setup/i), { target: { value: "Outdoor public court" } });
    fireEvent.click(screen.getByRole("checkbox"));

    const phone = screen.getByLabelText(/phone/i);
    fireEvent.change(phone, { target: { value: "214-555" } });
    // Nothing is said while the student is still typing.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.blur(phone);
    expect(screen.getByRole("alert")).toHaveTextContent(/at least 7 digits/i);

    fireEvent.change(phone, { target: { value: "214.555.0134" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /continue to available times/i })).toBeEnabled();
  });

  it("ignores a slow availability answer for a day the student already left", async () => {
    const pending: Array<(body: unknown) => void> = [];
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/time-slots") return Promise.resolve(jsonResponse([{ display_label: "9:00 AM" }]));
      if (url.startsWith("/api/availability")) {
        return new Promise<Response>((resolve) => pending.push((body) => resolve(jsonResponse(body))));
      }
      throw new Error(`Unexpected fetch ${url}`);
    }));

    render(<BookingModal isOpen onClose={() => undefined} />);
    fillDetails();
    fireEvent.click(await screen.findByRole("button", { name: /continue to available times/i }));

    const days = screen.getAllByRole("button").filter((button) => button.classList.contains("slot"));
    fireEvent.click(days[1]);
    fireEvent.click(days[2]);
    expect(pending).toHaveLength(3);

    // The day on screen answers first; the two abandoned days answer later.
    await act(async () => pending[2]({ allDay: false, unavailable: [] }));
    await act(async () => pending[1]({ allDay: true, unavailable: [] }));
    await act(async () => pending[0]({ allDay: true, unavailable: [] }));

    expect(screen.queryByText(/DeMario is unavailable on this date/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "9:00 AM" })).toBeEnabled();
  });

  it("says when the lesson times failed to load, and retries them", async () => {
    let timeSlotCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/time-slots") {
        timeSlotCalls += 1;
        return timeSlotCalls === 1 ? new Response("{}", { status: 500 }) : jsonResponse([{ display_label: "9:00 AM" }]);
      }
      if (url.startsWith("/api/availability")) return jsonResponse({ allDay: false, unavailable: [] });
      throw new Error(`Unexpected fetch ${url}`);
    }));

    render(<BookingModal isOpen onClose={() => undefined} />);
    fillDetails();
    fireEvent.click(await screen.findByRole("button", { name: /continue to available times/i }));

    expect(await screen.findByText(/Could not load lesson times/i)).toBeInTheDocument();
    expect(screen.queryByText(/No lesson times available yet/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByRole("button", { name: "9:00 AM" })).toBeInTheDocument();
    expect(timeSlotCalls).toBe(2);
  });

  it("rebuilds the day strip when the form stayed open past midnight", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T04:50:00Z")); // 11:50 PM Central, Oct 19
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/time-slots") return jsonResponse([{ display_label: "9:00 AM" }]);
      if (url.startsWith("/api/availability")) return jsonResponse({ allDay: false, unavailable: [] });
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<BookingModal isOpen onClose={() => undefined} />);
    fillDetails();
    const continueButton = await screen.findByRole("button", { name: /continue to available times/i });

    // Oct 20 was the first bookable day when the form opened. At 12:05 AM it
    // is today, and the server refuses today.
    vi.setSystemTime(new Date("2026-10-20T05:05:00Z"));
    fireEvent.click(continueButton);

    const availabilityDates = () =>
      fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url.startsWith("/api/availability"))
        .map((url) => new URL(url, "https://example.test").searchParams.get("date"));
    await waitFor(() => expect(availabilityDates()).toEqual(["2026-10-21"]));
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

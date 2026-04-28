import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminDashboard from "./AdminDashboard";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AdminDashboard availability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows booking phone and court preference in the booking row", () => {
    render(
      <AdminDashboard
        initialBookings={[
          {
            id: "booking-1",
            created_at: "2026-04-27T12:00:00Z",
            name: "Jane Student",
            email: "jane@example.com",
            phone: "(469) 371-9220",
            lesson_type: "beginner",
            lesson_date: "2026-05-05",
            lesson_time: "9:00 AM",
            status: "pending",
            notes: "Preferred court setup: Outdoor public court\nPreferred area or court: Lake Highlands",
            paid_at: null,
          },
        ]}
        initialInquiries={[]}
      />
    );

    expect(screen.getByText("(469) 371-9220")).toBeVisible();
    expect(screen.getByText("Court: Outdoor public court")).toBeVisible();
    expect(screen.getByText("Area: Lake Highlands")).toBeVisible();
  });

  it("does not allow a cancelled booking to be confirmed again", () => {
    render(
      <AdminDashboard
        initialBookings={[
          {
            id: "booking-1",
            created_at: "2026-04-27T12:00:00Z",
            name: "Jane Student",
            email: "jane@example.com",
            phone: "(469) 371-9220",
            lesson_type: "beginner",
            lesson_date: "2026-05-05",
            lesson_time: "9:00 AM",
            status: "cancelled",
            notes: "Preferred court setup: Outdoor public court",
            paid_at: null,
          },
        ]}
        initialInquiries={[]}
      />
    );

    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeDisabled();
  });

  it("loads the control center and adds a manual block with mocked admin APIs", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/blocked-slots" && !init) {
        return jsonResponse([
          {
            id: "block-1",
            date: "2026-05-05",
            time: "9:00 AM",
            all_day: false,
            created_at: "2026-04-27T12:00:00Z",
          },
          {
            id: "block-2",
            date: "2026-05-05",
            time: null,
            all_day: true,
            created_at: "2026-04-27T12:00:00Z",
          },
        ]);
      }

      if (url === "/api/time-slots?all=true") {
        return jsonResponse([
          { id: "slot-1", display_label: "9:00 AM", sort_key: 900, active: true },
          { id: "slot-2", display_label: "10:00 AM", sort_key: 1000, active: true },
          { id: "slot-3", display_label: "6:00 PM", sort_key: 1800, active: false },
        ]);
      }

      if (url === "/api/recurring-blocks" && !init) {
        return jsonResponse([
          { id: "rec-1", day_of_week: 1, time: "10:00 AM", created_at: "2026-04-27T12:00:00Z" },
        ]);
      }

      if (url === "/api/calendar-sync") {
        return jsonResponse({
          enabled: true,
          configured: true,
          calendarId: "primary",
          checkedDate: "2026-05-04",
          ok: true,
          busyCount: 2,
          error: null,
        });
      }

      if (url === "/api/blocked-slots" && init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toMatchObject({
          date: "2026-05-07",
          time: "10:00 AM",
        });
        return jsonResponse(
          {
            id: "block-3",
            date: "2026-05-07",
            time: "10:00 AM",
            all_day: false,
            created_at: "2026-04-27T12:00:00Z",
          },
          201
        );
      }

      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminDashboard initialBookings={[]} initialInquiries={[]} />);

    await user.click(screen.getByRole("button", { name: /availability/i }));

    await expect(screen.findByText(/Google Calendar Connected/i)).resolves.toBeVisible();
    expect(screen.getByText(/Lesson times students can book/i)).toBeVisible();
    expect(screen.getByText(/Block a date or time/i)).toBeVisible();
    expect(screen.getByText(/Weekly recurring blocks/i)).toBeVisible();
    expect(screen.getByText(/Currently blocked upcoming times/i)).toBeVisible();
    expect(screen.getByText(/Tue, May 5/i)).toBeVisible();
    expect(screen.getAllByText(/Whole day/i).length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText(/date to block/i), "2026-05-07");
    await user.selectOptions(screen.getByLabelText(/time to block/i), "10:00 AM");
    await user.click(screen.getByRole("button", { name: /^block time$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Thu, May 7/i)).toBeVisible();
    });
  });
});

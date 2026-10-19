import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
}));

import { sendBookingCreatedEmails, sendInquiryNotificationEmail } from "./client";

const sent = { data: { id: "email-id" }, error: null };
const failure = (name: string) => ({
  data: null,
  error: { name, message: `${name} from Resend`, statusCode: 422 },
});

const booking = {
  id: "12345678-1234-1234-1234-123456789abc",
  name: "Jane\r\nStudent",
  email: "jane@example.com",
  lesson_type: "beginner",
  lesson_date: "2026-05-04",
  lesson_time: "9:00 AM",
};

describe("email client", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("ADMIN_EMAIL", "mario@example.com, tonio@example.com");
    vi.stubEnv("EMAIL_FROM", "DeMario Pickleball <bookings@example.com>");
    mocks.send.mockReset();
    mocks.send.mockResolvedValue(sent);
    mocks.captureException.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("sendInquiryNotificationEmail", () => {
    const inquiry = { name: "Jane\nStudent", email: "jane@example.com", message: "Hi" };

    it("emails Mario with Reply-To set to the student and a one-line subject", async () => {
      await sendInquiryNotificationEmail(inquiry);

      expect(mocks.send).toHaveBeenCalledTimes(1);
      expect(mocks.send.mock.calls[0][0]).toMatchObject({
        to: "mario@example.com",
        replyTo: "jane@example.com",
        subject: "New message — Jane Student",
      });
      expect(mocks.captureException).not.toHaveBeenCalled();
    });

    it("sends again without Reply-To when Resend rejects the address", async () => {
      mocks.send.mockResolvedValueOnce(failure("validation_error"));

      await sendInquiryNotificationEmail(inquiry);

      expect(mocks.send).toHaveBeenCalledTimes(2);
      expect(mocks.send.mock.calls[1][0].replyTo).toBeUndefined();
      expect(mocks.send.mock.calls[1][0].to).toBe("mario@example.com");
      expect(mocks.captureException).not.toHaveBeenCalled();
    });

    it("reports any other failure to Sentry without retrying", async () => {
      mocks.send.mockResolvedValueOnce(failure("daily_quota_exceeded"));

      await sendInquiryNotificationEmail(inquiry);

      expect(mocks.send).toHaveBeenCalledTimes(1);
      expect(mocks.captureException).toHaveBeenCalledWith(expect.any(Error), {
        tags: { email: "inquiry alert", resend_error: "daily_quota_exceeded" },
      });
    });

    it("reports when the retry without Reply-To also fails", async () => {
      mocks.send.mockResolvedValue(failure("validation_error"));

      await sendInquiryNotificationEmail(inquiry);

      expect(mocks.send).toHaveBeenCalledTimes(2);
      expect(mocks.captureException).toHaveBeenCalledTimes(1);
    });

    it("sends nothing without an API key", async () => {
      vi.stubEnv("RESEND_API_KEY", "");
      vi.spyOn(console, "warn").mockImplementation(() => {});

      await sendInquiryNotificationEmail(inquiry);

      expect(mocks.send).not.toHaveBeenCalled();
    });
  });

  describe("sendBookingCreatedEmails", () => {
    it("confirms to the student and alerts Mario on one-line subjects", async () => {
      await sendBookingCreatedEmails(booking);

      expect(mocks.send).toHaveBeenCalledTimes(2);
      const [student, alert] = mocks.send.mock.calls.map((call) => call[0]);
      expect(student).toMatchObject({ to: "jane@example.com", replyTo: "mario@example.com" });
      expect(alert).toMatchObject({
        to: "mario@example.com",
        replyTo: "jane@example.com",
        subject: "New booking — Jane Student · 2026-05-04 9:00 AM",
      });
    });

    it("still alerts Mario when the student confirmation fails, and reports it", async () => {
      mocks.send.mockResolvedValueOnce(failure("validation_error"));

      await sendBookingCreatedEmails(booking);

      expect(mocks.send).toHaveBeenCalledTimes(2);
      expect(mocks.send.mock.calls[1][0].to).toBe("mario@example.com");
      expect(mocks.captureException).toHaveBeenCalledWith(expect.any(Error), {
        tags: { email: "student confirmation", resend_error: "validation_error" },
      });
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  adminNotificationHtml,
  greetingName,
  studentRequestedHtml,
  reviewRequestHtml,
  inquiryNotificationHtml,
  lessonOutcomeDigestHtml,
  lessonReminderHtml,
  reviewNotificationHtml,
} from "./templates";

describe("reviewNotificationHtml", () => {
  const review = {
    displayName: "Sam P.",
    rating: 2,
    body: "Too much talking.",
    verified: true,
    live: true,
    actionUrl: "https://demariomontezpb.com/review-action/abc.def",
  };

  it("tells DeMario a verified review is live and offers the takedown, with the rule", () => {
    const html = reviewNotificationHtml(review);
    expect(html).toContain("A new review is live on your site");
    expect(html).toContain("★★☆☆☆");
    expect(html).toContain("Take it down");
    expect(html).toContain("https://demariomontezpb.com/review-action/abc.def");
    expect(html).toContain("abusive, fake, or says something untrue");
    expect(html).toContain("Low ratings stay up");
  });

  it("offers Publish for a waiting public review", () => {
    const html = reviewNotificationHtml({ ...review, verified: false, live: false });
    expect(html).toContain("A new review is waiting for you");
    expect(html).toContain("Publish it");
    expect(html).toContain("from the public review page");
  });

  it("points to Admin when one-tap links are not set up", () => {
    const html = reviewNotificationHtml({ ...review, actionUrl: null });
    expect(html).toContain("Open Admin, then Reviews");
    expect(html).not.toContain("/review-action/");
  });

  it("escapes what a student wrote", () => {
    const html = reviewNotificationHtml({ ...review, displayName: "<b>x</b>", body: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>x</b>");
  });
});

const booking = {
  id: "12345678-1234-1234-1234-123456789abc",
  name: "Jane Student",
  email: "jane@example.com",
  phone: "(469) 371-9220",
  lesson_type: "beginner",
  lesson_date: "2026-05-04",
  lesson_time: "9:00 AM",
  notes: "Preferred court setup: Outdoor public court\nPreferred area or court: Lake Highlands",
};

describe("email templates", () => {
  it("tells students Mario will confirm the exact court", () => {
    const html = studentRequestedHtml(booking);

    expect(html).toContain("Mario will confirm the exact court");
    expect(html).toContain("Outdoor public court");
    // The free-text note goes to Mario, not back to an address nobody has confirmed.
    expect(html).not.toContain("Lake Highlands");
    expect(adminNotificationHtml(booking)).toContain("Lake Highlands");
    expect(html).toContain("Lesson fee");
    expect(html).toContain("Court reservation fees, if any, are confirmed separately");
  });

  it("includes phone and court preference in the admin notification", () => {
    const html = adminNotificationHtml(booking);

    expect(html).toContain("(469) 371-9220");
    expect(html).toContain("Outdoor public court");
    expect(html).toContain("Text the student to confirm the exact court");
  });

  it("shows a group booking's players and the total the booker pays", () => {
    const group = {
      ...booking,
      lesson_type: "drill_90",
      group_size: 3,
      quoted_per_person_cents: 3500,
      quoted_total_cents: 10500,
    };

    const student = studentRequestedHtml(group);
    expect(student).toContain("Drilling Session, 90 min");
    expect(student).toContain("3 players · $35 per person");
    expect(student).toContain("$105 total");

    const admin = adminNotificationHtml(group);
    expect(admin).toContain("3 players · $35 per person");
    expect(admin).toContain("Booker pays");
    expect(admin).toContain("$105 total");
  });

  it("tells Mario where the student found him, and says so when nobody knows", () => {
    expect(adminNotificationHtml({ ...booking, arrival_source: "card" })).toContain("QR card");
    expect(adminNotificationHtml(booking)).toContain("No tagged link");
    // The student's own email never carries it.
    expect(studentRequestedHtml({ ...booking, arrival_source: "card" } as typeof booking)).not.toContain("QR card");
  });

  it("keeps a one-on-one lesson's fee and adds no group rows", () => {
    const html = studentRequestedHtml(booking);
    expect(html).toContain("$70");
    expect(html).not.toContain("Players");
    expect(adminNotificationHtml(booking)).not.toContain("Booker pays");
  });

  it("greets by a plain first name only", () => {
    expect(greetingName("Jane Student")).toBe("Jane");
    expect(greetingName("José María")).toBe("José");
    expect(greetingName("Mary-Kate O'Neil")).toBe("Mary-Kate");
    expect(greetingName("evil.example/pay now")).toBe("there");
    expect(greetingName("https://evil.example")).toBe("there");
    expect(greetingName("   ")).toBe("there");
    expect(studentRequestedHtml({ ...booking, name: "evil.example/pay" })).toContain("You're booked, there.");
  });

  it("escapes a student's name everywhere, including the <title>", () => {
    const html = adminNotificationHtml({
      ...booking,
      name: '</title><a href="https://evil.example">Verify payment</a>',
    });
    expect(html).not.toContain("</title><a");
    expect(html).not.toContain('<a href="https://evil.example"');
    expect(html).toContain("&lt;/title&gt;");
  });
});

describe("lessonReminderHtml", () => {
  it("gives tomorrow's details, how to reach DeMario, and what to do if plans changed", () => {
    const html = lessonReminderHtml(booking);
    expect(html).toContain("See you tomorrow, Jane.");
    expect(html).toContain("Mon, May 4");
    expect(html).toContain("9:00 AM CT");
    expect(html).toContain('href="sms:4693719220"');
    expect(html).toContain("If you and DeMario already changed plans, you can ignore this email.");
    // It never repeats the student's free-text note or claims a court.
    expect(html).not.toContain("Lake Highlands");
  });

  it("shows a group's players", () => {
    const html = lessonReminderHtml({
      ...booking,
      lesson_type: "drill_90",
      group_size: 3,
      quoted_per_person_cents: 3500,
      quoted_total_cents: 10500,
    });
    expect(html).toContain("3 players · $35 per person");
  });

  it("escapes the student's name", () => {
    expect(lessonReminderHtml({ ...booking, name: "<b>x</b>" })).not.toContain("<b>x</b>");
  });
});

describe("reviewRequestHtml", () => {
  it("includes the review link and the lesson details", () => {
    const html = reviewRequestHtml({
      name: "Rachel Kim",
      lessonName: "Foundations",
      lessonDate: "2026-07-23",
      reviewUrl: "https://demariomontezpb.com/review/abc123",
    });
    expect(html).toContain("https://demariomontezpb.com/review/abc123");
    // A second, quieter link for the student's next booking.
    expect(html).toContain("/book-again");
    expect(html).toContain("Book your next lesson");
    expect(html).toContain("Foundations");
    expect(html).toContain("Rachel");
  });

  it("escapes a name containing markup", () => {
    const html = reviewRequestHtml({
      name: "<script>alert(1)</script>",
      lessonName: "Foundations",
      lessonDate: "2026-07-23",
      reviewUrl: "https://example.com/review/x",
    });
    expect(html).not.toContain("<script>");
  });

  it("falls back gracefully when the name is blank", () => {
    const html = reviewRequestHtml({
      name: "   ",
      lessonName: "Group Clinic",
      lessonDate: "2026-07-23",
      reviewUrl: "https://example.com/review/x",
    });
    expect(html).toContain("How was it, there?");
  });
});

describe("inquiryNotificationHtml", () => {
  it("shows who wrote, how to reach them, and what they asked", () => {
    const html = inquiryNotificationHtml({
      name: "Jane Student",
      email: "jane@example.com",
      message: "Do you have clinics this weekend?",
    });
    expect(html).toContain("Jane Student");
    expect(html).toContain('href="mailto:jane@example.com"');
    expect(html).toContain("Do you have clinics this weekend?");
    expect(html).toContain("Reply to this email to answer Jane directly");
    expect(html).toContain("/admin");
  });

  it("escapes markup a stranger typed into the public form", () => {
    const html = inquiryNotificationHtml({
      name: '<img src=x onerror="alert(1)">',
      email: "jane@example.com",
      message: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("lessonOutcomeDigestHtml", () => {
  const lesson = (name: string, id: string) => ({
    name,
    lessonName: "Foundations",
    when: "Sun, Oct 18 · 9:00 AM CT",
    courtSetup: "Outdoor public court",
    links: {
      confirmed: `https://demariomontezpb.com/lesson-outcome/${id}-yes`,
      no_show: `https://demariomontezpb.com/lesson-outcome/${id}-noshow`,
      cancelled: `https://demariomontezpb.com/lesson-outcome/${id}-no`,
    },
  });

  it("gives every lesson its three outcome buttons", () => {
    const html = lessonOutcomeDigestHtml([lesson("Jane Student", "a"), lesson("Sam Player", "b")]);
    expect(html).toContain("2 lessons need an outcome");
    for (const id of ["a", "b"]) {
      expect(html).toContain(`/lesson-outcome/${id}-yes`);
      expect(html).toContain(`/lesson-outcome/${id}-noshow`);
      expect(html).toContain(`/lesson-outcome/${id}-no"`);
    }
    expect(html).toContain("Nothing is sent to the student for No-show or Didn't happen");
  });

  it("names a group's size next to its format", () => {
    const html = lessonOutcomeDigestHtml([
      { ...lesson("Jane Student", "a"), lessonName: "Play with the Pro", players: "3 players" },
    ]);
    expect(html).toContain("Play with the Pro · 3 players");
  });

  it("uses a singular heading for one lesson", () => {
    expect(lessonOutcomeDigestHtml([lesson("Jane Student", "a")])).toContain("Did this lesson happen?");
  });

  it("escapes a student name, which came from a public form", () => {
    const html = lessonOutcomeDigestHtml([lesson('<a href="https://evil.example">x</a>', "a")]);
    expect(html).not.toContain('<a href="https://evil.example"');
  });
});

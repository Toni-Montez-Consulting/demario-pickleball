import { expect, test, type Page } from "@playwright/test";

const DEFAULT_TIMES = [
  { display_label: "9:00 AM" },
  { display_label: "10:00 AM" },
  { display_label: "11:00 AM" },
];

async function mockBookingFlow(
  page: Page,
  options: {
    times?: Array<{ display_label: string }>;
    availability?: { allDay: boolean; unavailable: string[] };
    bookingStatus?: number;
    refreshAvailability?: { allDay: boolean; unavailable: string[] };
    availabilityStatus?: number;
    onBooking?: (body: Record<string, unknown>) => void;
  } = {}
) {
  let availabilityCalls = 0;

  await page.route("**/api/time-slots", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(options.times ?? DEFAULT_TIMES),
    });
  });
  await page.route("**/api/availability?**", async (route) => {
    availabilityCalls += 1;
    if (options.availabilityStatus) {
      await route.fulfill({ status: options.availabilityStatus, body: "{}" });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        availabilityCalls > 1 && options.refreshAvailability
          ? options.refreshAvailability
          : options.availability ?? { allDay: false, unavailable: [] }
      ),
    });
  });
  await page.route("**/api/bookings", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = route.request().postDataJSON();
    options.onBooking?.(body);
    expect(body).toMatchObject({
      phone: "(469) 371-9220",
      notes: "Preferred court setup: Outdoor public court\nPreferred area or court: Lake Highlands",
    });
    if (options.bookingStatus === 409) {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "That time slot is not available." }),
      });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "12345678-1234-1234-1234-123456789abc",
        name: "Jane Student",
        email: "jane@example.com",
        lesson_type: "beginner",
        lesson_date: "2026-05-04",
        lesson_time: "9:00 AM",
      }),
    });
  });
}

async function openBookingPicker(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /book a lesson/i }).first().click();
  const dialog = page.getByRole("dialog", { name: /book a lesson/i });
  await dialog.getByLabel(/your name/i).fill("Jane Student");
  await dialog.getByLabel(/email/i).fill("jane@example.com");
  await dialog.getByLabel(/phone/i).fill("(469) 371-9220");
  await dialog.getByLabel(/preferred court setup/i).selectOption("Outdoor public court");
  await dialog.getByLabel(/preferred area or court/i).fill("Lake Highlands");
  const waiver = dialog.getByRole("checkbox");
  await waiver.check();
  await expect(waiver).toBeChecked();
  const continueButton = dialog.getByRole("button", { name: /continue to available times/i });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();

  const pickerDialog = page.getByRole("dialog");
  await expect(pickerDialog.getByRole("heading", { name: /choose a time/i })).toBeVisible();
  return pickerDialog;
}

test("homepage loads and booking modal can reach payment options", async ({ page }) => {
  await mockBookingFlow(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /train smarter/i })).toBeVisible();

  const dialog = await openBookingPicker(page);
  await expect(dialog.getByRole("heading", { name: /choose a time/i })).toBeVisible();
  await expect(dialog.getByText(/central time/i)).toBeVisible();
  await dialog.getByRole("button", { name: /reserve/i }).click();

  const confirmedDialog = page.getByRole("dialog", { name: /you're booked/i });
  await expect(confirmedDialog.getByText(/Lesson 12345678/i)).toBeVisible();
  await expect(confirmedDialog.getByText(/Mario will confirm the exact court/i)).toBeVisible();
  await expect(confirmedDialog.getByText(/Cash App/i)).toBeVisible();
  await expect(confirmedDialog.getByRole("link", { name: /open paypal app payment link/i })).toHaveAttribute(
    "href",
    "https://www.paypal.com/paypalme/DemarioMontez"
  );
});

test("a tagged bio link lands on the homepage and the booking says where it came from", async ({ page }) => {
  let posted: Record<string, unknown> | null = null;
  await mockBookingFlow(page, { onBooking: (body) => (posted = body) });

  await page.goto("/ig");
  await expect(page).toHaveURL(/\/\?utm_source=instagram&utm_medium=bio$/);
  await expect(page.getByRole("heading", { name: /train smarter/i })).toBeVisible();

  // openBookingPicker loads "/" again, untagged: the tab still remembers the tag.
  const dialog = await openBookingPicker(page);
  await dialog.getByRole("button", { name: /reserve/i }).click();
  await expect(page.getByRole("dialog", { name: /you're booked/i })).toBeVisible();
  expect(posted).toMatchObject({ arrival_source: "instagram" });
});

test("indoor students are routed to partner booking paths", async ({ page }) => {
  await mockBookingFlow(page);

  await page.goto("/");
  await page.getByRole("button", { name: /book a lesson/i }).first().click();
  const dialog = page.getByRole("dialog", { name: /book a lesson/i });
  await dialog.getByLabel(/your name/i).fill("Jane Student");
  await dialog.getByLabel(/email/i).fill("jane@example.com");
  await dialog.getByLabel(/phone/i).fill("(469) 371-9220");
  await dialog.getByLabel(/preferred court setup/i).selectOption("Indoor / weather-proof");
  await dialog.getByRole("checkbox").check();

  const routeButton = dialog.getByRole("button", { name: /see indoor booking paths/i });
  await expect(routeButton).toBeEnabled();
  await routeButton.click();

  const routeDialog = page.getByRole("dialog", { name: /indoor courts use partner booking/i });
  await expect(routeDialog.getByRole("heading", { name: /indoor courts use partner booking/i })).toBeVisible();
  await expect(routeDialog.getByText("Dallas Indoor Pickleball Club")).toBeVisible();
  await expect(routeDialog.getByText("The Grove Pickleball")).toBeVisible();
  await expect(routeDialog.getByText("Life Time Fitness")).toBeVisible();
  await expect(routeDialog.getByText("Samuel-Grand Tennis Center")).toBeVisible();
  await expect(routeDialog.getByRole("link", { name: /Dallas Indoor Pickleball Club/i })).toHaveAttribute(
    "href",
    /dallaspickleclub\.podplay\.app/
  );
  await expect(routeDialog.getByRole("link", { name: /The Grove Pickleball/i })).toHaveAttribute(
    "href",
    /grove\.podplay\.app/
  );
  await expect(routeDialog.getByText("Use Life Time app")).toBeVisible();
  await expect(routeDialog.getByText("Reserve through Impact")).toBeVisible();
  const lifeTimeHref = await routeDialog.getByText("Life Time Fitness").evaluate((el) => el.closest("a")?.getAttribute("href") ?? null);
  const samuelGrandHref = await routeDialog.getByText("Samuel-Grand Tennis Center").evaluate((el) => el.closest("a")?.getAttribute("href") ?? null);
  expect(lifeTimeHref).toBeNull();
  expect(samuelGrandHref).toBeNull();
});

test("booking terms stay in-flow and mobile modal does not overflow or trigger tiny input zoom", async ({ page }) => {
  await mockBookingFlow(page);

  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/");
    await page.getByRole("button", { name: /book a lesson/i }).first().click();
    const dialog = page.getByRole("dialog", { name: /book a lesson/i });

    await dialog.getByLabel(/your name/i).fill("Jane Student");
    await dialog.getByLabel(/email/i).fill("jane@example.com");
    await dialog.getByLabel(/phone/i).fill("(469) 371-9220");
    await dialog.getByLabel(/preferred court setup/i).selectOption("Outdoor public court");
    await dialog.getByLabel(/preferred area or court/i).fill("Lake Highlands");

    const metrics = await page.evaluate(() => {
      const input = document.querySelector<HTMLElement>(".modal-input");
      const modal = document.querySelector<HTMLElement>('[role="dialog"]');
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        inputFontSize: input ? window.getComputedStyle(input).fontSize : "0px",
        modalWidth: modal?.getBoundingClientRect().width ?? 0,
        innerWidth: window.innerWidth,
      };
    });
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.modalWidth).toBeLessThanOrEqual(metrics.innerWidth);
    expect(Number.parseFloat(metrics.inputFontSize)).toBeGreaterThanOrEqual(16);

    await dialog.getByRole("button", { name: /coaching agreement/i }).click();
    const termsDialog = page.getByRole("dialog", { name: /coaching agreement/i });
    await expect(termsDialog.getByRole("heading", { name: /coaching agreement/i })).toBeVisible();
    await termsDialog.getByRole("button", { name: /back to booking/i }).click();

    const returnedDialog = page.getByRole("dialog", { name: /book a lesson/i });
    await expect(returnedDialog.getByLabel(/your name/i)).toHaveValue("Jane Student");
    await expect(returnedDialog.getByLabel(/email/i)).toHaveValue("jane@example.com");
    await expect(returnedDialog.getByLabel(/phone/i)).toHaveValue("(469) 371-9220");
    await expect(returnedDialog.getByLabel(/preferred court setup/i)).toHaveValue("Outdoor public court");
    await expect(returnedDialog.getByLabel(/preferred area or court/i)).toHaveValue("Lake Highlands");
  }
});

test("drilling and Play with the Pro quote the group live and book its total", async ({ page }) => {
  await mockBookingFlow(page);
  const posted = page.waitForRequest(
    (request) => request.url().endsWith("/api/bookings") && request.method() === "POST"
  );

  await page.goto("/");
  const lessons = page.locator("#lessons");
  await lessons.getByRole("button", { name: "Drilling", exact: true }).click();
  await expect(lessons.getByRole("heading", { name: "Drilling Session" })).toBeVisible();
  await expect(lessons.getByText("from $15 per player")).toBeVisible();
  await expect(lessons.getByRole("table")).toContainText("90 min");
  await lessons.getByRole("button", { name: /book this lesson/i }).click();

  const dialog = page.getByRole("dialog", { name: /book a lesson/i });
  await expect(dialog.getByLabel(/lesson type/i)).toHaveValue("drill");
  await expect(dialog.getByText("$60 per person · 1 player · $60 total")).toBeVisible();

  await dialog.getByRole("button", { name: "90 min" }).click();
  const more = dialog.getByRole("button", { name: "More players" });
  for (let players = 1; players < 8; players++) await more.click();
  await expect(dialog.getByText("$18 per person · 8 players · $144 total")).toBeVisible();
  await expect(more).toBeDisabled();

  // Play with the Pro takes four at most, so the group is clamped to four.
  await dialog.getByLabel(/lesson type/i).selectOption("play_pro");
  await expect(dialog.getByText("$30 per person · 4 players · $120 total")).toBeVisible();
  await dialog.getByRole("button", { name: "Fewer players" }).click();
  await expect(dialog.getByText("$35 per person · 3 players · $105 total")).toBeVisible();

  await dialog.getByLabel(/your name/i).fill("Jane Student");
  await dialog.getByLabel(/email/i).fill("jane@example.com");
  await dialog.getByLabel(/phone/i).fill("(469) 371-9220");
  await dialog.getByLabel(/preferred court setup/i).selectOption("Outdoor public court");
  await dialog.getByLabel(/preferred area or court/i).fill("Lake Highlands");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: /continue to available times/i }).click();

  const picker = page.getByRole("dialog");
  await expect(picker.getByText("Play with the Pro · 3 players", { exact: true })).toBeVisible();
  await expect(picker.getByText("$105.00", { exact: true })).toBeVisible();
  await picker.getByRole("button", { name: /reserve/i }).click();

  const confirmed = page.getByRole("dialog", { name: /you're booked/i });
  await expect(confirmed.getByText("3 players · $35 per person")).toBeVisible();
  await expect(confirmed.locator(".pay-amount")).toHaveText("$105.00");
  expect((await posted).postDataJSON()).toMatchObject({ lesson_type: "play_pro", group_size: 3 });
});

test("the lesson tabs and the group quote fit a 320px phone", async ({ page }) => {
  await mockBookingFlow(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");

  // Five tabs wrap instead of running off the card: the three lessons on one
  // row, the two group formats on the next.
  const tabs = page.locator(".lesson-tabs");
  await tabs.scrollIntoViewIfNeeded();
  expect(await tabs.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  const rows = await tabs.evaluate((el) => {
    const counts = new Map<number, number>();
    for (const tab of Array.from(el.children)) {
      const top = Math.round(tab.getBoundingClientRect().top);
      counts.set(top, (counts.get(top) ?? 0) + 1);
    }
    return Array.from(counts.values());
  });
  expect(rows).toEqual([3, 2]);

  await page.getByRole("button", { name: /book a lesson/i }).first().click();
  const dialog = page.getByRole("dialog", { name: /book a lesson/i });
  await dialog.getByLabel(/lesson type/i).selectOption("drill");
  const quote = dialog.locator(".quote-line");
  await quote.scrollIntoViewIfNeeded();
  await expect(quote).toHaveText("$60 per person · 1 player · $60 total");
  expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);

  for (const name of ["Fewer players", "More players", "60 min", "90 min"]) {
    const box = await dialog.getByRole("button", { name, exact: true }).boundingBox();
    expect(box?.height, name).toBeGreaterThanOrEqual(44);
    expect(box?.width, name).toBeGreaterThanOrEqual(44);
  }
});

test("keyboard focus stays inside the booking dialog in both directions", async ({ page }) => {
  await mockBookingFlow(page);
  await page.goto("/");
  await page.getByRole("button", { name: /book a lesson/i }).first().click();
  const dialog = page.getByRole("dialog", { name: /book a lesson/i });
  await expect(dialog).toBeVisible();

  // More presses than the dialog has stops, so the walk must wrap at least once.
  for (const key of ["Tab", "Shift+Tab"]) {
    let previous: string | undefined;
    const visited = new Set<string>();
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press(key);
      const focus = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return { inside: false, id: "" };
        // Tag each element once so the test can tell whether focus moved.
        el.dataset.focusProbe ??= String(document.querySelectorAll("[data-focus-probe]").length);
        return { inside: !!el.closest('[role="dialog"]'), id: el.dataset.focusProbe };
      });
      expect(focus.inside, `${key} press ${i + 1} left the dialog`).toBe(true);
      // Focus stranded on one control stays "inside" but is just as broken. The
      // old Shift+Tab bug did exactly that.
      expect(focus.id, `${key} press ${i + 1} did not move focus`).not.toBe(previous);
      previous = focus.id;
      visited.add(focus.id);
    }
    expect(visited.size, `${key} reached too few controls`).toBeGreaterThan(2);
  }
});

test("booking funnel events carry codes only, never what the student typed", async ({ page }) => {
  // Keep the dev-mode analytics script out, so events stay in the window.vaq
  // queue where the test can read them.
  await page.route("https://va.vercel-scripts.com/**", (route) => route.abort());
  await mockBookingFlow(page);
  const picker = await openBookingPicker(page);
  await picker.getByRole("button", { name: /reserve/i }).click();
  await expect(page.getByRole("dialog", { name: /you're booked/i })).toBeVisible();

  const events = await page.evaluate(() => {
    const queue = (window as unknown as { vaq?: [string, { name: string; data?: object }][] }).vaq ?? [];
    return queue.filter(([kind]) => kind === "event").map(([, event]) => event);
  });
  const named = (name: string) => events.filter((event) => event.name === name).map((e) => e.data);

  expect(named("book_cta_click")).toHaveLength(1);
  expect(["nav", "hero"]).toContain((named("book_cta_click")[0] as { source: string }).source);
  // Each step counts once per opening, so a straight run is exactly the funnel.
  expect(named("booking_step_viewed")).toEqual([
    { step: "details" },
    { step: "picker", court_setup: "outdoor" },
    { step: "confirmed" },
  ]);

  const sent = JSON.stringify(events);
  for (const typed of ["Jane", "jane@example.com", "371-9220", "Lake Highlands"]) {
    expect(sent).not.toContain(typed);
  }
});

test("payment page exposes a tappable PayPal link and QR large enough to scan", async ({ page }) => {
  await page.goto("/pay");

  await expect(page.getByRole("link", { name: /^PayPal/i })).toHaveAttribute(
    "href",
    "https://www.paypal.com/paypalme/DemarioMontez"
  );
  const qrLink = page.getByRole("link", { name: /open paypal app payment link/i });
  await expect(qrLink).toHaveAttribute("href", "https://www.paypal.com/paypalme/DemarioMontez");
  const qrImage = qrLink.getByAltText(/PayPal QR code/i);
  await expect(qrImage).toBeVisible();
  const box = await qrImage.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(250);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(250);
});

test("booking modal explains when a day is fully unavailable", async ({ page }) => {
  await mockBookingFlow(page, {
    availability: { allDay: true, unavailable: [] },
  });

  const dialog = await openBookingPicker(page);
  await expect(dialog.getByText(/unavailable on this date/i)).toBeVisible();
  await expect(dialog.getByRole("button", { name: /reserve/i })).toBeDisabled();
});

test("booking modal explains when no lesson times exist", async ({ page }) => {
  await mockBookingFlow(page, {
    times: [],
    availability: { allDay: false, unavailable: [] },
  });

  const dialog = await openBookingPicker(page);
  await expect(dialog.getByText(/no lesson times available yet/i)).toBeVisible();
  await expect(dialog.getByRole("button", { name: /reserve/i })).toBeDisabled();
});

test("booking modal shows an availability retry state", async ({ page }) => {
  await mockBookingFlow(page, { availabilityStatus: 500 });

  const dialog = await openBookingPicker(page);
  await expect(dialog.getByText(/could not load availability/i)).toBeVisible();
  await expect(dialog.getByRole("button", { name: /retry/i })).toBeVisible();
});

test("booking modal refreshes availability when a slot is taken", async ({ page }) => {
  await mockBookingFlow(page, {
    bookingStatus: 409,
    refreshAvailability: { allDay: false, unavailable: ["9:00 AM"] },
  });

  const dialog = await openBookingPicker(page);
  await dialog.getByRole("button", { name: /reserve/i }).click();

  await expect(dialog.getByText(/that time was just taken/i)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "9:00 AM", exact: true })).toBeDisabled();
});

test("admin route is gated when unauthenticated", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: /coach login/i })).toBeVisible();
});

test("contact form submits with normal visible fields", async ({ page }) => {
  await page.route("**/api/inquiries", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({
      name: "Jane Student",
      email: "jane@example.com",
      message: "Do you offer beginner clinics?",
      company: "",
    });
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc" }),
    });
  });

  await page.goto("/");
  await page.getByLabel(/your name/i).fill("Jane Student");
  await page.getByLabel(/email/i).fill("jane@example.com");
  await page.getByLabel(/message/i).fill("Do you offer beginner clinics?");
  await page.getByRole("button", { name: /send message/i }).click();

  await expect(page.getByText(/message sent/i)).toBeVisible();
});

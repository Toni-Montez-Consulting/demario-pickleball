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

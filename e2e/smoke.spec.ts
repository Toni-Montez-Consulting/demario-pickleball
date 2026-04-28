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
      notes: "Preferred court setup: Indoor / weather-proof\nPreferred area or court: The Grove",
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
  await dialog.getByLabel(/preferred court setup/i).selectOption("Indoor / weather-proof");
  await dialog.getByLabel(/preferred area or court/i).fill("The Grove");
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

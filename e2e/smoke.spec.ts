import { expect, test } from "@playwright/test";

test("homepage loads and booking modal can reach payment options", async ({ page }) => {
  await page.route("**/api/time-slots", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([{ display_label: "9:00 AM" }]),
    });
  });
  await page.route("**/api/availability?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ allDay: false, unavailable: [] }),
    });
  });
  await page.route("**/api/bookings", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
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

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /train smarter/i })).toBeVisible();

  await page.getByRole("button", { name: /book a lesson/i }).first().click();
  const dialog = page.getByRole("dialog", { name: /book a lesson/i });
  await dialog.getByLabel(/your name/i).fill("Jane Student");
  await dialog.getByLabel(/email/i).fill("jane@example.com");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: /next/i }).click();
  await dialog.getByRole("button", { name: /confirm/i }).click();

  const confirmedDialog = page.getByRole("dialog", { name: /you're booked/i });
  await expect(confirmedDialog.getByText(/Lesson 12345678/i)).toBeVisible();
  await expect(confirmedDialog.getByText(/Cash App/i)).toBeVisible();
});

test("admin route is gated when unauthenticated", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: /coach login/i })).toBeVisible();
});

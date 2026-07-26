import { expect, test, type Page } from "@playwright/test";

/** The form disables submit until the client hydrates. Wait for that signal. */
async function submitButton(page: Page) {
  const button = page.getByRole("button", { name: /submit review/i });
  await expect(button).toBeEnabled();
  return button;
}

test.describe("public review page", () => {
  test("renders the form", async ({ page }) => {
    await page.goto("/review");
    await expect(page.getByRole("heading", { name: /how was your lesson/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: "5 stars" })).toBeAttached();
    await expect(page.getByRole("button", { name: /submit review/i })).toBeEnabled();
  });

  test("asks for a rating instead of submitting an empty review", async ({ page }) => {
    let called = false;
    await page.route("**/api/reviews", async (route) => {
      called = true;
      await route.fulfill({ status: 201, contentType: "application/json", body: "{}" });
    });

    await page.goto("/review");
    await (await submitButton(page)).click();

    await expect(page.locator("p.review-error")).toHaveText(/pick a star rating/i);
    expect(called).toBe(false);
  });

  test("asks for consent before submitting", async ({ page }) => {
    let called = false;
    await page.route("**/api/reviews", async (route) => {
      called = true;
      await route.fulfill({ status: 201, contentType: "application/json", body: "{}" });
    });

    await page.goto("/review");
    await page.getByRole("radio", { name: "5 stars" }).check();
    await page.getByLabel(/how your name should appear/i).fill("Jamie R.");
    await (await submitButton(page)).click();

    await expect(page.locator("p.review-error")).toHaveText(/check the box/i);
    expect(called).toBe(false);
  });

  test("posts the rating, consent and honeypot, then shows the thank-you state", async ({
    page,
  }) => {
    let payload: Record<string, unknown> | null = null;

    await page.route("**/api/reviews", async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, verified: false }),
      });
    });

    await page.goto("/review");
    await page.getByRole("radio", { name: "4 stars" }).check();
    await page.getByLabel(/anything you want to add/i).fill("Sharp coaching, clear homework.");
    await page.getByLabel(/how your name should appear/i).fill("Jamie R.");
    await page.getByRole("checkbox").check();
    await (await submitButton(page)).click();

    await expect(page.getByRole("heading", { name: /thank you/i })).toBeVisible();
    await expect(page.getByText(/with demario for approval/i)).toBeVisible();

    expect(payload).toMatchObject({
      rating: 4,
      displayName: "Jamie R.",
      consent: true,
      company: "",
    });
  });

  test("surfaces a server-side rejection instead of claiming success", async ({ page }) => {
    await page.route("**/api/reviews", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Consent to publish is required" }),
      });
    });

    await page.goto("/review");
    await page.getByRole("radio", { name: "3 stars" }).check();
    await page.getByLabel(/how your name should appear/i).fill("Jamie R.");
    await page.getByRole("checkbox").check();
    await (await submitButton(page)).click();

    await expect(page.getByText("Consent to publish is required")).toBeVisible();
    await expect(page.getByRole("heading", { name: /thank you/i })).toBeHidden();
  });
});

test("an unknown review token 404s", async ({ page }) => {
  const res = await page.goto("/review/not-a-real-token");
  expect(res?.status()).toBe(404);
});

test("admin reviews page redirects an unauthenticated visitor", async ({ page }) => {
  await page.goto("/admin/reviews");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("cron endpoint rejects an unauthenticated request", async ({ request }) => {
  const res = await request.get("/api/cron/review-requests");
  expect(res.status()).toBe(401);
});

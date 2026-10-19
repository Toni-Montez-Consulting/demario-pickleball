import { expect, test } from "@playwright/test";

// Pages students and Mario open directly. Each must arrive with the security
// headers and render without the browser reporting a CSP violation.
const PAGES = ["/", "/pay", "/privacy", "/terms", "/review", "/admin/login"];

type CspWindow = { __cspViolations?: string[] };

test("security headers are sent and no page trips the Content Security Policy", async ({ page }) => {
  // next dev compiles each route on first visit.
  test.setTimeout(120_000);
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const w = window as unknown as CspWindow;
      w.__cspViolations = [...(w.__cspViolations ?? []), `${event.violatedDirective} ${event.blockedURI}`];
    });
  });

  for (const path of PAGES) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBeLessThan(400);
    const headers = response?.headers() ?? {};
    expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(headers["strict-transport-security"], path).toContain("includeSubDomains");
    await page.waitForLoadState("load");
    const reported = await page.evaluate(() => (window as unknown as CspWindow).__cspViolations ?? []);
    violations.push(...reported.map((violation) => `${path}: ${violation}`));
  }

  expect(violations).toEqual([]);
});

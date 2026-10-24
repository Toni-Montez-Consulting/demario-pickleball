import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every page and layout under app/admin/(protected) must check the admin
 * session itself, before it reads anything. A layout's check does not cover
 * the pages under it, so a new page that forgets the check fails here.
 * https://nextjs.org/docs/app/guides/authentication#layouts-and-auth-checks
 */
const PROTECTED = path.resolve(process.cwd(), "src/app/admin/(protected)");

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return /^(page|layout)\.tsx$/.test(entry.name) ? [full] : [];
  });
}

const files = routeFiles(PROTECTED);

describe("admin pages check the session themselves", () => {
  it("finds the admin pages", () => {
    // Dashboard, reviews, roadmap, site roadmap, tasks, and the layout.
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  it.each(files.map((file) => [path.relative(PROTECTED, file), file]))(
    "%s calls requireAdminPage before reading data",
    (_label, file) => {
      const source = readFileSync(file, "utf8");
      const check = source.indexOf("await requireAdminPage()");
      expect(check).toBeGreaterThan(-1);
      // The data client comes from the check, never on its own.
      expect(source).not.toContain("createServiceRoleClient(");
      const firstRead = source.indexOf(".from(");
      if (firstRead > -1) expect(check).toBeLessThan(firstRead);
    }
  );
});

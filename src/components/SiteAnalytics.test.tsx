import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ vercelTrack: vi.fn() }));
vi.mock("@vercel/analytics", () => ({ track: mocks.vercelTrack }));
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));

import SiteAnalytics from "./SiteAnalytics";
import { eventAttributes } from "@/lib/analytics";

describe("SiteAnalytics click reporting", () => {
  it("reports a click on a marked link, including on a child element", () => {
    const { unmount } = render(<SiteAnalytics />);
    const link = document.createElement("a");
    link.href = "#";
    for (const [k, v] of Object.entries(
      eventAttributes("payment_link_click", { method: "zelle", surface: "pay_page" })
    )) {
      link.setAttribute(k, v);
    }
    const icon = document.createElement("span");
    link.appendChild(icon);
    document.body.appendChild(link);

    icon.click();

    expect(mocks.vercelTrack).toHaveBeenCalledWith("payment_link_click", {
      method: "zelle",
      surface: "pay_page",
    });
    link.remove();
    unmount();
  });

  it("ignores clicks on unmarked elements", () => {
    mocks.vercelTrack.mockClear();
    const { unmount } = render(<SiteAnalytics />);
    const button = document.createElement("button");
    document.body.appendChild(button);

    button.click();

    expect(mocks.vercelTrack).not.toHaveBeenCalled();
    button.remove();
    unmount();
  });
});

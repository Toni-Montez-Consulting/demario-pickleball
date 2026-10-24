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

  it("reports a middle click, which opens the link in a new tab, but not a right click", () => {
    mocks.vercelTrack.mockClear();
    const { unmount } = render(<SiteAnalytics />);
    const link = document.createElement("a");
    link.href = "#";
    for (const [k, v] of Object.entries(
      eventAttributes("venue_link_click", { venue: "the_grove", surface: "modal" })
    )) {
      link.setAttribute(k, v);
    }
    document.body.appendChild(link);

    link.dispatchEvent(new MouseEvent("auxclick", { button: 2, bubbles: true }));
    expect(mocks.vercelTrack).not.toHaveBeenCalled();
    link.dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true }));
    expect(mocks.vercelTrack).toHaveBeenCalledWith("venue_link_click", {
      venue: "the_grove",
      surface: "modal",
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

describe("SiteAnalytics tagged arrival", () => {
  it("counts a tagged landing and remembers it for the rest of the visit", () => {
    mocks.vercelTrack.mockClear();
    window.history.replaceState({}, "", "/?utm_source=tiktok&utm_medium=bio");
    const { unmount } = render(<SiteAnalytics />);
    expect(window.sessionStorage.getItem("dm_arrival_source")).toBe("tiktok");
    expect(mocks.vercelTrack).toHaveBeenCalledWith("tagged_arrival", { source: "tiktok" });
    unmount();
    window.history.replaceState({}, "", "/");
    window.sessionStorage.clear();
  });

  it("counts nothing for an untagged visit", () => {
    mocks.vercelTrack.mockClear();
    window.history.replaceState({}, "", "/");
    const { unmount } = render(<SiteAnalytics />);
    expect(mocks.vercelTrack).not.toHaveBeenCalled();
    unmount();
  });
});

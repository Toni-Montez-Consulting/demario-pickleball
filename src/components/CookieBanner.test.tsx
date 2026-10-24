import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import CookieBanner from "./CookieBanner";

describe("CookieBanner", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("shows the notice on a first visit and remembers the dismissal", async () => {
    render(<CookieBanner />);
    await screen.findByRole("region", { name: /cookie notice/i });
    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(screen.queryByRole("region", { name: /cookie notice/i })).not.toBeInTheDocument();
    expect(window.localStorage.getItem("cookie_consent")).toBe("1");
  });

  it("stays hidden once dismissed", () => {
    window.localStorage.setItem("cookie_consent", "1");
    render(<CookieBanner />);
    expect(screen.queryByRole("region", { name: /cookie notice/i })).not.toBeInTheDocument();
  });

  it("still shows and dismisses when the browser blocks site data", async () => {
    // The banner sits on every page, so a throw here took the homepage down.
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    try {
      render(<CookieBanner />);
      await screen.findByRole("region", { name: /cookie notice/i });
      fireEvent.click(screen.getByRole("button", { name: /got it/i }));
      expect(screen.queryByRole("region", { name: /cookie notice/i })).not.toBeInTheDocument();
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
      else delete (window as { localStorage?: Storage }).localStorage;
    }
  });
});

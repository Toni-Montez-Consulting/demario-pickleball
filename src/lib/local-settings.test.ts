import { afterEach, describe, expect, it, vi } from "vitest";
import { readLocalSetting, saveLocalSetting } from "./local-settings";

describe("local settings", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("reads back what was saved, and null when nothing was", () => {
    expect(readLocalSetting("cookie_consent")).toBeNull();
    saveLocalSetting("cookie_consent", "1");
    expect(readLocalSetting("cookie_consent")).toBe("1");
  });

  it("never throws when the browser blocks site data", () => {
    // What blocking browsers do: the accessor itself throws. Shadow it, then
    // put it back.
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    try {
      expect(() => saveLocalSetting("cookie_consent", "1")).not.toThrow();
      expect(readLocalSetting("cookie_consent")).toBeNull();
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
      else delete (window as { localStorage?: Storage }).localStorage;
    }
  });

  it("never throws when the store refuses a read or a write", () => {
    // Older Safari private windows: the accessor works, but writes throw.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    expect(() => saveLocalSetting("admin-dashboard-tab", "inquiries")).not.toThrow();
    expect(readLocalSetting("admin-dashboard-tab")).toBeNull();
  });
});

// localStorage throws, instead of returning null, when a browser blocks site
// data (Safari "Block All Cookies", Chrome "Don't allow sites to save data").
// What is kept here is a convenience: when storage is blocked the setting is
// simply not remembered, and the page must still work.
function deviceStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The saved value, or null when nothing is saved or storage is blocked. */
export function readLocalSetting(key: string): string | null {
  try {
    return deviceStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Saves the value when the browser allows it; otherwise it is not remembered. */
export function saveLocalSetting(key: string, value: string): void {
  try {
    deviceStorage()?.setItem(key, value);
  } catch {
    // Swallowed on purpose: a blocked or full store only means it is asked again.
  }
}

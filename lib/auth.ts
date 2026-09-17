"use client";

// The app password gates /api/analyze so strangers cannot spend your
// Anthropic quota. It is stored on this device only.
const KEY = "kcal:app-key";

export function getAppKey(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAppKey(value: string) {
  try {
    if (value) window.localStorage.setItem(KEY, value);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Ignore: the user will be asked again next time.
  }
}
